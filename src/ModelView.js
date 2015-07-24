var compose = require('ksf/utils/compose');
var create = require('lodash/object/create');
var _ContentDelegate = require('absolute/_ContentDelegate');
var HPile = require('absolute/HPile');
var VFlex = require('absolute/VFlex');
var Background = require('absolute/Background');
var Switch = require('absolute/Switch');
var Label = require('absolute/Label');
var Button = require('absolute/Button');
var Reactive = require('absolute/Reactive');
var Value = require('ksf/observable/Value');
var TransformedValue = require('ksf/observable/TransformedValue');

var CollectionView = require('./CollectionView');
var ItemView = require('./ItemView');

var PathElement = compose(_ContentDelegate, function(args) {
	var modelName;
	this._content = new Background(new HPile().content([
		modelName = new Label().value(args.modelId).width(100),
		new Label().value('/').width(20),
		new Reactive({
			value: new TransformedValue(args.activeItem, function(itemId) {
				var itemName = this;
				if (itemId) {
					itemName.value(itemId+''); // initialise avec l'id
					args.request({ method: "model."+args.modelId+".read", params: [
						[itemId],
						['rec_name'],
					]}).then(function(res) {
						itemName.value(res[0]['rec_name']); // puis affiche le nom
					});
				} else {
					itemName.value('');
				}
			}),
			content: new Label().width(100),
		}),
	])).width(220).color('lightgrey').border('1px solid black');

	// TODO : display model name
	// args.request({ method: 'model.read', params: [
	// ]}).then(function(res) {
	// 	modelName.value(res.modelName);
	// });
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
	this._nextCollection(args.modelId, null, args.listViewId, args.formViewId);
}, {
	_nextCollection: function(modelId, query, listViewId, formViewId) {
		var args = create(this._args, {
			modelId: modelId,
			query: query,
			listViewId: listViewId,
			formViewId: formViewId,
			activeItem: new Value(),
			nextCollection: this._nextCollection.bind(this),
			nextItem: this._nextItem.bind(this),
		});
		var view = new CollectionView(args);
		var pathElement = new PathElement(args);

		this._next(view, pathElement, {modelId: modelId, query: query});
	},
	_nextItem: function(modelId, itemId, formViewId) {
		var args = create(this._args, {
			modelId: modelId,
			formViewId: formViewId,
			activeItem: new Value(itemId),
			nextCollection: this._nextCollection.bind(this),
			nextItem: this._nextItem.bind(this),
		});
		var view = new ItemView(args);
		var pathElement = new PathElement(args);

		this._next(view, pathElement, {modelId: modelId, itemId: itemId});
	},
	_next: function(view, pathElement, params) {
		this._mainArea.content(view);
		this._pathBar.add(this._stack.length+'', pathElement);
		this._stack.push({
			type: 'collection',
			params: params,
			main: view,
			pathElement: pathElement,
		});
	},
	_back: function() {
		var stack = this._stack;
		if (stack.length>1) {
			stack.pop();
			this._mainArea.content(stack[stack.length-1].main);
			this._pathBar.remove(this._stack.length+'');
		}
	},
});