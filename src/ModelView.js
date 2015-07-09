var compose = require('ksf/utils/compose');
var create = require('lodash/object/create');
var _ContentDelegate = require('absolute/_ContentDelegate');
var HPile = require('absolute/HPile');
var VFlex = require('absolute/VFlex');
var Switch = require('absolute/Switch');
var Label = require('absolute/Label');
var Button = require('absolute/Button');

var CollectionView = require('./CollectionView');

var PathElement = compose(_ContentDelegate, function(args) {
	this._content = new Label().value(args.modelId);
});
/**
Vue de top niveau qui affiche des vues de type 'collection' ou 'item' et permet de naviguer dans les données en les enchainant
Elle maintient l'état du 'path' de navigation
@params args {
	modelId
	request
}
*/
module.exports = compose(_ContentDelegate, function(args) {
	this._args = args;
	this._content = new VFlex([
		[this._pathBar = new HPile().height(30), 'fixed'],
		this._mainArea = new Switch(),
	]);

	this._stack = [];

	this._pathBar.add('back', new Button().value('<').width(30).onAction(this._back.bind(this)));
	this._nextCollection(args.modelId);
}, {
	_nextCollection: function(modelId) {
		var args = create(this._args, {
			modelId: modelId,
		});
		var view = new CollectionView(args);
		var pathElement = new PathElement(args); // TODO: être réactif sur l'élément sélectionné

		this._mainArea.content(view);
		this._pathBar.add(this._stack.length+'', pathElement);
		this._stack.push(['collection', modelId, view, pathElement]);
	},
	_nextItem: function(modelId, itemId) {},
	_back: function() {
		var stack = this._stack;
		stack.pop();
		this._mainArea.content(stack[stack.length-1].main);
		this._pathBar.remove(this._stack.length+'');
	},
});