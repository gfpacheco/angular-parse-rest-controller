'use strict';

describe('parse.restController.run', function() {

  var rest;

  beforeEach(module('parse.restController'));

  beforeEach(inject(function(_rest_) {
    rest = _rest_;
  }));

  it('changes the default parse rest controller', function() {
    expect(Parse.CoreManager.getRESTController()).to.equal(rest);
  });

});
