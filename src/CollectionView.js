var create = require('lodash/object/create');
var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var HFlex = require('absolute/HFlex');
var Value = require('ksf/observable/Value');

var MapView = require('./MapView');
var ListView = require('./ListView');
var FormView = require('./FormView');

/**
@params args {
	modelId
	query
	request
}
*/
module.exports = compose(_ContentDelegate, function(args) {
	var commonArgs = create(args, {
		activeItem: new Value(null),
	});
	this._content = new HFlex([
		new MapView(commonArgs),
		new ListView(commonArgs),
		new FormView(commonArgs),
	]);
});