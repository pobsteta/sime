var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var _Destroyable = require('ksf/base/_Destroyable');


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
module.exports = compose(_ContentDelegate, _Destroyable, function(args) {
	this._content = this._own(new MaybeMapContainer(args, ListFormView, MapView));
});
