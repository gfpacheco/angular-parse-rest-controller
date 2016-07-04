(function(angular) {
  angular
    .module('parse.restController')
    .run(setupRest);

  setupRest.$inject = ['rest'];

  function setupRest(rest) {
    Parse.CoreManager.setRESTController(rest);
  }
})(angular);
