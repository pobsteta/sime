// var create = require('lodash/object/create');
var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var HFlex = require('absolute/HFlex');

var MapView = require('./MapView');
var FormView = require('./FormView');

/**
@params args {
	modelId
	query
	request
}
*/
module.exports = compose(_ContentDelegate, function(args) {
	this._content = new HFlex([
		new MapView(args),
		new FormView(args),
	]);
});