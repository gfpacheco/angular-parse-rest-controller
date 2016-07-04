'use strict';

describe('parse.restController.service', function() {

  var CoreManager = Parse.CoreManager;
  var ParsePromise = Parse.Promise;
  var $httpBackend;
  var $timeout;
  var rest;

  beforeEach(module('parse.restController'));

  beforeEach(inject(function(_$httpBackend_, _$timeout_, _rest_) {
    ParsePromise.disableAPlusCompliant();

    $httpBackend = _$httpBackend_;
    $timeout = _$timeout_;
    rest = _rest_;

    CoreManager.setInstallationController({
      currentInstallationId: function() {
        return ParsePromise.as('iid');
      }
    });
    CoreManager.set('APPLICATION_ID', 'A');
    CoreManager.set('JAVASCRIPT_KEY', 'B');
    CoreManager.set('VERSION', 'V');
  }));

  afterEach(function() {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  it('opens a http request with the correct verb and headers', function() {
    $httpBackend.expect('GET', 'users/me', {}, { 'X-Parse-Session-Token': '123' }).respond(200);
    rest.ajax('GET', 'users/me', {}, { 'X-Parse-Session-Token': '123' });
    $httpBackend.flush();
  });

  it('resolves with the result of the AJAX request', function() {
    var callback = sinon.spy();
    $httpBackend.expect('POST', 'users', {}).respond(200, { success: true });
    rest.ajax('POST', 'users', {}).then(callback);
    $httpBackend.flush();
    expect(callback).to.have.been.calledOnce;
    expect(callback).to.have.been.calledWith({ success: true }, 200);
  });

  it('retries on 5XX errors', function() {
    var callback = sinon.spy();
    $httpBackend.expect('POST', 'users', {}).respond(500);
    rest.ajax('POST', 'users', {}).then(callback);
    $httpBackend.flush();
    $httpBackend.expect('POST', 'users', {}).respond(500);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.expect('POST', 'users', {}).respond(200, { success: true });
    $timeout.flush();
    $httpBackend.flush();
    expect(callback).to.have.been.calledOnce;
    expect(callback).to.have.been.calledWith({ success: true }, 200);
  });

  it('retries on connection failure', function() {
    var callback = sinon.spy();
    $httpBackend.expect('GET', 'users', {}, { sessionToken: '1234' }).respond(0);
    rest.ajax('GET', 'users', {}, { sessionToken: '1234' }).then(null, callback);
    $httpBackend.flush();
    $httpBackend.expect('GET', 'users', {}, { sessionToken: '1234' }).respond(0);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.expect('GET', 'users', {}, { sessionToken: '1234' }).respond(0);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.expect('GET', 'users', {}, { sessionToken: '1234' }).respond(0);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.expect('GET', 'users', {}, { sessionToken: '1234' }).respond(0);
    $timeout.flush();
    $httpBackend.flush();
    expect(callback).to.have.been.calledOnce;
    expect(callback).to.have.been.calledWith('Unable to connect to the Parse API');
  });

  it('aborts after too many failures', function() {
    var callback = sinon.spy();
    $httpBackend.expect('GET', 'users').respond(500);
    rest.ajax('GET', 'users', {}).then(null, callback);
    $httpBackend.flush();
    $httpBackend.expect('GET', 'users').respond(500);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.expect('GET', 'users').respond(500);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.expect('GET', 'users').respond(500);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.expect('GET', 'users').respond(500);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.when('GET', 'users').respond(200, { success: true });
    expect(callback).to.have.been.calledOnce;
    expect(callback.getCall(0).args[0]).to.be.ok;
  });

  it('rejects 1XX status codes', function() {
    var callback = sinon.spy();
    $httpBackend.expect('POST', 'users', {}).respond(100);
    rest.ajax('POST', 'users', {}).then(null, callback);
    $httpBackend.flush();
    expect(callback).to.have.been.calledOnce;
    expect(callback.getCall(0).args[0]).to.be.ok;
  });

  it('can make formal JSON requests', function() {
    $httpBackend.expect('POST', 'https://api.parse.com/1/classes/MyObject', {
      _method: 'GET',
      _ApplicationId: 'A',
      _JavaScriptKey: 'B',
      _ClientVersion: 'V',
      _InstallationId: 'iid',
      _SessionToken: '1234'
    }).respond(200);
    rest.request('GET', 'classes/MyObject', {}, { sessionToken: '1234' });
    $httpBackend.flush();
  });

  it('handles request errors', function(done) {
    $httpBackend.expect('POST', 'https://api.parse.com/1/classes/MyObject').respond(400, {
      code: -1,
      error: 'Something bad'
    });
    rest.request('GET', 'classes/MyObject', {}, {}).then(null, function(error) {
      expect(error.code).to.be.equal(-1);
      expect(error.message).to.be.equal('Something bad');
      done();
    });
    $httpBackend.flush();
  });

  it('handles invalid responses', function(done) {
    $httpBackend.expect('POST', 'https://api.parse.com/1/classes/MyObject').respond(200, '{');
    rest.request('GET', 'classes/MyObject', {}, {}).then(null, function(error) {
      expect(error.code).to.be.equal(100);
      expect(error.message).to.be.equal('XMLHttpRequest failed: "Response is not a valid JSON"');
      done();
    });
    $httpBackend.flush();
  });

  it('handles invalid errors', function(done) {
    $httpBackend.expect('POST', 'https://api.parse.com/1/classes/MyObject').respond(400, '{');
    rest.request('GET', 'classes/MyObject', {}, {}).then(null, function(error) {
      expect(error.code).to.be.equal(107);
      expect(error.message).to.be.equal('Received an error with invalid JSON from Parse: {');
      done();
    });
    $httpBackend.flush();
  });

  it('attaches the session token of the current user', function() {
    CoreManager.setUserController({
      currentUserAsync: function() {
        return ParsePromise.as({
          getSessionToken: function() {
            return '5678';
          }
        });
      },
      setCurrentUser: function() {},
      currentUser: function() {},
      signUp: function() {},
      logIn: function() {},
      become: function() {},
      logOut: function() {},
      requestPasswordReset: function() {},
      upgradeToRevocableSession: function() {},
      linkWith: function() {}
    });
    $httpBackend.expect('POST', 'https://api.parse.com/1/classes/MyObject', {
      _method: 'GET',
      _ApplicationId: 'A',
      _JavaScriptKey: 'B',
      _ClientVersion: 'V',
      _InstallationId: 'iid',
      _SessionToken: '5678'
    }).respond(200);
    rest.request('GET', 'classes/MyObject', {}, {});
    $httpBackend.flush();
    CoreManager.set('UserController', undefined);
  });

  it('attaches no session token when there is no current user', function() {
    CoreManager.setUserController({
      currentUserAsync: function() {
        return ParsePromise.as(null);
      },
      setCurrentUser: function() {},
      currentUser: function() {},
      signUp: function() {},
      logIn: function() {},
      become: function() {},
      logOut: function() {},
      requestPasswordReset: function() {},
      upgradeToRevocableSession: function() {},
      linkWith: function() {}
    });
    $httpBackend.expect('POST', 'https://api.parse.com/1/classes/MyObject', {
      _method: 'GET',
      _ApplicationId: 'A',
      _JavaScriptKey: 'B',
      _ClientVersion: 'V',
      _InstallationId: 'iid'
    }).respond(200);
    rest.request('GET', 'classes/MyObject', {}, {});
    $httpBackend.flush();
    CoreManager.set('UserController', undefined);
  });

  it('sends the revocable session upgrade header when the config flag is set', function() {
    CoreManager.set('FORCE_REVOCABLE_SESSION', true);
    $httpBackend.expect('POST', 'https://api.parse.com/1/classes/MyObject', {
      _method: 'GET',
      _ApplicationId: 'A',
      _JavaScriptKey: 'B',
      _ClientVersion: 'V',
      _InstallationId: 'iid',
      _RevocableSession: '1'
    }).respond(200);
    rest.request('GET', 'classes/MyObject', {}, {});
    $httpBackend.flush();
    CoreManager.set('FORCE_REVOCABLE_SESSION', false);
  });

  it('sends the master key when requested', function() {
    CoreManager.set('MASTER_KEY', 'M');
    $httpBackend.expect('POST', 'https://api.parse.com/1/classes/MyObject', {
      _method: 'GET',
      _ApplicationId: 'A',
      _MasterKey: 'M',
      _ClientVersion: 'V',
      _InstallationId: 'iid'
    }).respond(200);
    rest.request('GET', 'classes/MyObject', {}, { useMasterKey: true });
    $httpBackend.flush();
    CoreManager.set('MASTER_KEY', undefined);
  });

  it('throws when attempted to use an unprovided master key', function() {
    expect(function() {
      rest.request('GET', 'classes/MyObject', {}, { useMasterKey: true });
    }).to.throw(
      'Cannot use the Master Key, it has not been provided.'
    );
  });

});
