var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');

var MapView = require('./MapView');
var ListFormView = require('./ListFormView');
var MaybeMapContainer = require('./MaybeMapContainer');

/**
@params args {
	modelId
	query
	request
}
*/
module.exports = compose(_ContentDelegate, function(args) {
	this._content = new MaybeMapContainer(args, ListFormView, MapView);
});