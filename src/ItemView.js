var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');

var MapView = require('./MapView');
var FormView = require('./FormView');
var MaybeMapContainer = require('./MaybeMapContainer');

/**
@params args {
	modelId
	query
	request
}
*/
module.exports = compose(_ContentDelegate, function(args) {
	this._content = new MaybeMapContainer(args, FormView, MapView);
});