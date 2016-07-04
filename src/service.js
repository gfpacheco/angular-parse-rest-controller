(function(angular) {
  angular
    .module('parse.restController')
    .service('rest', rest);

  rest.$inject = ['$http', '$timeout'];

  function rest($http, $timeout) {
    var self = this;

    var CoreManager = Parse.CoreManager;
    var ParsePromise = Parse.Promise;
    var ParseError = Parse.Error;

    this.ajax = function ajax(method, url, data, headers) {
      headers = headers || {};
      headers['Accept'] = undefined;
      headers['Content-Type'] = undefined;

      var promise = new ParsePromise();
      var attempts = 0;
      var request = {
        method: method,
        url: url,
        data: data,
        headers: headers
      };

      function dispatch() {
        $http(request).then(function success(response) {
          if (angular.isObject(response.data)) {
            promise.resolve(response.data, response.status);
          } else {
            promise.reject('Response is not a valid JSON');
          }
        }, function error(response) {
          // heavily inspired by Parse's RESTController
          if (response.status >= 500 || response.status === 0) {
            attempts += 1;
            // retry on 5XX or node-xmlhttprequest error
            if (attempts < CoreManager.get('REQUEST_ATTEMPT_LIMIT')) {
              // Exponentially-growing random delay
              var delay = Math.round(
                Math.random() * 125 * Math.pow(2, attempts)
              );
              $timeout(dispatch, delay);
            } else if (response.status === 0) {
              promise.reject('Unable to connect to the Parse API');
            } else {
              // After the retry limit is reached, fail
              promise.reject({
                status: response.status,
                responseText: JSON.stringify(response.data || {})
              });
            }
          } else if (angular.isObject(response.data)) {
            promise.reject({
              status: response.status,
              responseText: JSON.stringify(response.data)
            });
          } else {
            promise.reject({
              status: response.status,
              responseText: response.data
            });
          }
        });
      }

      dispatch();

      return promise;
    };

    this.request = function request(method, path, data, options) {
      // heavily inspired by Parse's RESTController
      var url = CoreManager.get('SERVER_URL');
      if (url[url.length - 1] !== '/') {
        url += '/';
      }
      url += path;

      var payload = {};
      if (data && typeof data === 'object') {
        for (var k in data) {
          payload[k] = data[k];
        }
      }

      if (method !== 'POST') {
        payload._method = method;
        method = 'POST';
      }

      payload._ApplicationId = CoreManager.get('APPLICATION_ID');
      var jsKey = CoreManager.get('JAVASCRIPT_KEY');
      if (jsKey) {
        payload._JavaScriptKey = jsKey;
      }
      payload._ClientVersion = CoreManager.get('VERSION');

      var useMasterKey = options.useMasterKey;
      if (typeof useMasterKey === 'undefined') {
        useMasterKey = CoreManager.get('USE_MASTER_KEY');
      }
      if (useMasterKey) {
        if (CoreManager.get('MASTER_KEY')) {
          delete payload._JavaScriptKey;
          payload._MasterKey = CoreManager.get('MASTER_KEY');
        } else {
          throw new Error('Cannot use the Master Key, it has not been provided.');
        }
      }

      if (CoreManager.get('FORCE_REVOCABLE_SESSION')) {
        payload._RevocableSession = '1';
      }

      var installationId = options.installationId;
      var installationIdPromise;
      if (installationId && typeof installationId === 'string') {
        installationIdPromise = ParsePromise.as(installationId);
      } else {
        var installationController = CoreManager.getInstallationController();
        installationIdPromise = installationController.currentInstallationId();
      }

      return installationIdPromise.then(function(iid) {
        payload._InstallationId = iid;
        var userController = CoreManager.getUserController();
        if (options && typeof options.sessionToken === 'string') {
          return ParsePromise.as(options.sessionToken);
        } else if (userController) {
          return userController.currentUserAsync().then(function(user) {
            if (user) {
              return ParsePromise.as(user.getSessionToken());
            }
            return ParsePromise.as(null);
          });
        }
        return ParsePromise.as(null);
      }).then(function(token) {
        if (token) {
          payload._SessionToken = token;
        }

        var payloadString = JSON.stringify(payload);

        return self.ajax(method, url, payloadString);
      }).fail(function(response) {
        // Transform the error into an instance of ParseError by trying to parse
        // the error string as JSON
        var error;
        if (response && response.responseText) {
          try {
            var errorJSON = JSON.parse(response.responseText);
            error = new ParseError(errorJSON.code, errorJSON.error);
          } catch (e) {
            // If we fail to parse the error text, that's okay.
            error = new ParseError(
              ParseError.INVALID_JSON,
              'Received an error with invalid JSON from Parse: ' +
                response.responseText
            );
          }
        } else {
          error = new ParseError(
            ParseError.CONNECTION_FAILED,
            'XMLHttpRequest failed: ' + JSON.stringify(response)
          );
        }

        return ParsePromise.error(error);
      });
    };
  }
})(angular);
