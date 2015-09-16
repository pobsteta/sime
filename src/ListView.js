var create = require('lodash/object/create');

var compose = require('ksf/utils/compose');
var bindValue = require('ksf/observable/bindValue');
var _Destroyable = require('ksf/base/_Destroyable');
var Value = require('ksf/observable/Value')
var on = require('ksf/utils/on')

var _ContentDelegate = require('absolute/_ContentDelegate');
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
var getVisibleFieldsFromView = require('./utils/getVisibleFieldsFromView')
var createPagingControls = require('./createPagingControls')

import {newDoc as iconNew} from './icons/index'

var pageSize = 10

/**
@params args {
	modelId
	query
	request
}
*/
module.exports = compose(_ContentDelegate, _Destroyable, function(args) {
	var query = args.query || [];
	var fromItem = new Value(0)
	var container = new VPile()
	var listArgs = create(args, {
		container: container,
		query: query,
		listViewDef: args.request({
			"method": "model."+args.modelId+".fields_view_get",
			"params": [args.listViewId || null, "tree"],
		}),
		fromItem: fromItem,
		pageSize: pageSize,
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
		].concat(createPagingControls(create(args, {
			fromItem: fromItem,
			query: query,
			pageSize: pageSize,
		})))).width(args.defaultButtonSize), 'fixed'],
	]);

	this._own(on(args.saver, 'itemDestroyed', refreshList))
	this._own(on(args.saver, 'itemCreated', refreshList))
	this._own(on(args.saver, 'attrsChanged', refreshList))

	bindValue(fromItem, refreshList)
});

function displayList (args) {
	var modelId = args.modelId;
	var request = args.request;

	return args.listViewDef.then(function(viewDef) {
		var arch = new DOMParser().parseFromString(viewDef.arch, 'application/xml')
		var fieldIds = getVisibleFieldsFromView(arch)
		return request({method: "model."+modelId+".search_read", params: [
			args.query,
			args.fromItem.value(),
			args.pageSize,
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
					itemView.color(activeItemId === itemId ? args.selectedItemBackgroundColor : 'transparent');
				});
				args.container.add(itemId, new Margin(new Clickable(itemView).onAction(function() {
					args.activeItem.value(itemId);
					if (args.onAction) {args.onAction(itemId)}
				}), 10).height(fieldIds.length*30+20));
			});
		})
	})
}
