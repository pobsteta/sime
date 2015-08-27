var create = require('lodash/object/create');

var compose = require('ksf/utils/compose');
var bindValue = require('ksf/observable/bindValue');
var on = require('ksf/utils/on')

var _ContentDelegate = require('absolute/_ContentDelegate');
var _Destroyable = require('ksf/base/_Destroyable');
var Value = require('ksf/observable/Value')
var MappedValue = require('ksf/observable/MappedValue')
var CompositeValue = require('ksf/observable/CompositeValue')
var ValueFromPromise = require('ksf/observable/ValueFromPromise')
var Reactive = require('absolute/Reactive')
var Promised = require('absolute/Promised')
var Label = require('absolute/Label');
var IconButton = require('./IconButton');
var HFlex = require('absolute/HFlex');
var VPile = require('absolute/VPile');
var VScroll = require('absolute/VScroll');
var Margin = require('absolute/Margin');
var Background = require('absolute/Background');
var Clickable = require('absolute/Clickable');

var getFieldIdsToRequest = require('./utils/getFieldIdsToRequest');
var createFieldDisplayer = require('./fieldDisplayer')
var getFieldsFromView = require('./utils/getFieldsFromView')

import {
	newDoc as iconNew,
	next as iconNext,
	previous as iconPrevious
} from './icons/index'

var pageSize = 100

/**
@params args {
	modelId
	query
	request
}
*/
module.exports = compose(_ContentDelegate, _Destroyable, function(args) {
	var container = new VPile()
	var fromItem = new Value(0)
	var itemsCount = args.request({method: 'model.'+args.modelId+'.search_count', params: [[]]})
	var fromItemAndItemsCount = new CompositeValue({
		fromItem: fromItem,
		itemsCount: new ValueFromPromise(itemsCount),
	})
	var listArgs = create(args, {
		container: container,
		listViewDef: args.request({
			"method": "model."+args.modelId+".fields_view_get",
			"params": [args.listViewId || null, "tree"],
		}),
		fromItem: fromItem,
	})

	var refreshList = function () {
		container.content([])
		var message = args.message
		message.value("loading list ...")
		displayList(listArgs).then(
			() => message.value("list loaded"),
			(err) => {
				message.value("error during list loding")
				console.warn("error during list loding", err)
			}
		)
	}

	this._content = new HFlex([
		new VScroll(container),
		[new VPile().content([
			new IconButton().icon(iconNew).title("Ajouter un élément").height(args.defaultButtonSize).onAction(function () {
				args.activeItem.value('new')
				if (args.onAction) {args.onAction()}
			}),
			new Reactive({
				value: new MappedValue(fromItem, not),
				content: new IconButton().icon(iconPrevious).title("Page précédente").disabled(args.fromItem === 0).onAction(() => {
						changeValue(fromItem, add(-pageSize))
						refreshList(listArgs)
					}).height(args.defaultButtonSize),
				prop: 'disabled',
			}),
			new Reactive({
				content: new Label().hAlign('center'),
				value: new MappedValue(fromItem, seq(add(1), toString)),
			}).height(args.defaultButtonSize/2),
			new Label().value("à").hAlign('center').height(args.defaultButtonSize/2),
			new Reactive({
				content: new Label().hAlign('center'),
				value: new MappedValue(fromItemAndItemsCount, seq(call2(min,
					seq(get('fromItem'), add(pageSize)),
					get('itemsCount')
				), ifNotNull(toString))),
			}).height(args.defaultButtonSize/2),
			new Label().value("sur").hAlign('center').height(args.defaultButtonSize/2),
			new Promised({
				content: new Label().hAlign('center').height(args.defaultButtonSize/2),
				value: itemsCount.then(toString),
			}),
			new Reactive({
				value: new MappedValue(fromItemAndItemsCount, call2(gte,
					seq(get('fromItem'), add(pageSize)),
					get('itemsCount')
				)),
				content: new IconButton().icon(iconNext).title("Page suivante").onAction(() => {
					changeValue(fromItem, add(pageSize))
					refreshList(listArgs)
				}).height(args.defaultButtonSize),
				prop: 'disabled',
			}),
		]).width(args.defaultButtonSize), 'fixed'],
	]);

	this._own(on(args.saver, 'itemDestroyed', refreshList))
	this._own(on(args.saver, 'itemCreated', refreshList))
	this._own(on(args.saver, 'attrsChanged', refreshList))

	refreshList() // first display
});

function displayList (args) {
	var query = args.query || [];
	var modelId = args.modelId;
	var request = args.request;

	return args.listViewDef.then(function(viewDef) {
		var arch = new DOMParser().parseFromString(viewDef.arch, 'application/xml')
		var fieldIds = getFieldsFromView(arch)
		return request({method: "model."+modelId+".search_read", params: [
			query,
			args.fromItem.value(),
			pageSize,
			null,
			getFieldIdsToRequest(viewDef.fields),
		]}).then(function(items) {
			items.forEach(function(item) {
				var itemId = item.id
				var itemView = new Background(new VPile().content(fieldIds.map(function(fieldId) {
					return new HFlex([
						[new Label().value(viewDef.fields[fieldId].string).width(150), 'fixed'],
						createFieldDisplayer(item, viewDef.fields[fieldId]),
					]).height(30);
				}))).color('transparent').border('1px solid');
				// TODO : remplacer ces listeners inividuels par un listener global...
				// TODO: détruite le handler de activeItem
				bindValue(args.activeItem, function(activeItemId) {
					itemView.color(activeItemId === itemId ? 'lightblue' : 'transparent');
				});
				args.container.add(itemId, new Margin(new Clickable(itemView).onAction(function() {
					args.activeItem.value(itemId);
					if (args.onAction) {args.onAction(itemId)}
				}), 10).height(fieldIds.length*30+20));
			});
		})
	})
}

function toString(argument) {
	return argument.toString()
}
function not (argument) {
	return !argument
}
function gte(a, b) {
	return a >= b
}
function min(a, b) {
	return a < b ? a : b
}


function add(qty) {
	return (val) => val + qty
}
function get(prop) {
	return (obj) => obj[prop]
}
function seq() {
	var fns = Array.prototype.slice.call(arguments)
	return (startVal) => fns.reduce((val, fn) => fn(val), startVal)
}
function call2(fn, fn1, fn2) {
	return (val) => fn(fn1(val), fn2(val))
}
function ifNotNull(fn) {
	return (val) => val !== null ? fn(val) : null
}

function changeValue(observable, fn) {
	observable.value(fn(observable.value()))
}
