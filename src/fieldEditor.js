var findIndex = require('lodash/array/findIndex')
var create = require('lodash/object/create')

var compose = require('ksf/utils/compose');
var Value = require('ksf/observable/Value')
var bindValue = require('ksf/observable/bindValue');

var _ContentDelegate = require('absolute/_ContentDelegate');
var VScroll = require('absolute/VScroll');
var HFlex = require('absolute/HFlex');
var VFlex = require('absolute/VFlex');
var Label = require('absolute/Label');
var LabelInput = require('absolute/LabelInput');
var BooleanInput = require('absolute/InputElementBoolean');
var NumberInput = require('absolute/InputElementNumber');
var Background = require('absolute/Background');
var Clickable = require('absolute/Clickable');
var Button = require('absolute/Button');
var VPile = require('absolute/VPile');
var El = require('absolute/Element')
var Space = require('absolute/Space')

var createPagingControls = require('./createPagingControls')

var pageSize = 100

var getViewsByType = function (arch, fieldName) {
	var fieldElement = arch.querySelector('field[name="'+fieldName+'"]')
	var viewTypes = fieldElement.getAttribute('mode').split(',')
	var viewIds = fieldElement.getAttribute('view_ids').split(',')
	var viewsByType = viewTypes.reduce(function(o, type, i){
		o[type] = viewIds[i]
		return o
	}, {})
	return viewsByType
}

var ChoiceList = compose(_ContentDelegate, function (args) {
	var fromItem = new Value(0)
	var query = []
	var container = new VPile().content([new Label().value("Chargement...")]);
	this._content = new HFlex([
		new VScroll(container),
		[new VPile().content(createPagingControls(create(args, {
			fromItem: fromItem,
			pageSize: pageSize,
			query: query,
		}))).width(args.defaultButtonSize), 'fixed'],
	])
	bindValue(fromItem, (fromItemValue) => {
		args.request({method: "model."+args.modelId+".search_read", params: [
			query,
			fromItemValue,
			pageSize,
			null,
			['rec_name'],
		]}).then(function(items) {
			container.content(items.map(function(item) {
				var itemId = item.id;
				var recName = item['rec_name']
				return new Clickable(new Background(
					new Label().value(recName)
				).color(itemId === args.activeItem ? 'lightblue' : 'lightgrey')
					.border('1px solid'))
					.onAction(args.onInput.bind(null, item))
					.height(args.defaultButtonSize)
			}))
		}, function(err) {
			console.log("erreur", err);
			container.content([new Label().value("Erreur lors du chargement de la liste")])
		})
	})
})

var ModalChoiceList = compose(_ContentDelegate, function (args) {
	this._content = new Background(new HFlex([
		new Space(),
		[new VFlex([
			[new Space().height(30), 'fixed'],
			new Background(new ChoiceList(create(args, {
				onInput: (item) => {
					args.onInput(item)
					args.onClose()
				},
			}))).color('white').opacity(1),
			[new Button().value("Annuler").onAction(args.onClose).height(60), 'fixed'],
			[new Space().height(30), 'fixed'],
		]).width(400), 'fixed'],
		new Space(),
	])).color('lightgrey').opacity(0.8)
})

var editFieldFactories = {
	boolean: function(args) {
		return new BooleanInput()
			.value(args.itemValue[args.field.name])
			.prop('disabled', args.field.readonly)
			.onInput(function (newValue) {
				args.changes.attrs[args.field.name] = newValue;
			})
	},
	integer: function(args) {
		return new NumberInput()
			.value(args.itemValue[args.field.name])
			.prop('disabled', args.field.readonly)
			.onInput(function (newValue) {
				args.changes.attrs[args.field.name] = newValue;
			})
	},
	biginteger: function(args) {
		return new NumberInput()
			.value(args.itemValue[args.field.name])
			.prop('disabled', args.field.readonly)
			.onInput(function (newValue) {
				args.changes.attrs[args.field.name] = newValue;
			})
	},
	char: function(args) {
		return new LabelInput()
			.value(args.itemValue[args.field.name])
			.disabled(args.field.readonly)
			.onInput(function(newValue) {
				args.changes.attrs[args.field.name] = newValue;
			});
	},
	text: function(args) {
		return new LabelInput()
			.value(args.itemValue[args.field.name])
			.disabled(args.field.readonly)
			.onInput(function(newValue) {
				args.changes.attrs[args.field.name] = newValue;
			});
	},
	float: function(args) {
		return new NumberInput()
			.value(args.itemValue[args.field.name])
			.prop('disabled', args.field.readonly)
			.onInput(function (newValue) {
				args.changes.attrs[args.field.name] = newValue;
			})
	},
	numeric: function(args) {
		return new NumberInput()
			.value(args.itemValue[args.field.name])
			.prop('disabled', args.field.readonly)
			.onInput(function (newValue) {
				args.changes.attrs[args.field.name] = newValue;
			})
	},
	date: function(args) {
		return new Label().value(args.itemValue[args.field.name]);
	},
	datetime: function(args) {
		return new Label().value(args.itemValue[args.field.name]);
	},
	time: function(args) {
		return new Label().value(args.itemValue[args.field.name]);
	},
	many2one: function(args) {
		var field = args.field;
		var parentItem = args.itemValue;
		var modelId = field.relation;
		var itemId = parentItem[field.name];
		var itemRecName = parentItem[field.name+'.rec_name']
		var selectButton
		// en offline, le rec_name n'est pas forcément dispo sur le parentItem
		if (!args.online && itemId) {
			args.request({method: "model."+modelId+".read", params: [
				[itemId],
				['rec_name'],
			]}).then(item =>
				// si l'élément est en cache, on affiche son rec_name
				selectButton.value(item[0]['rec_name']),
				// sinon on laisse la valeur d'origine
				() => {}
			)
		}
		return new HFlex([
			selectButton = new Button()
				.value(itemRecName)
				.disabled(field.readonly)
				.onAction(function() {
					var currentValue = args.changes.attrs[field.name] || itemId
					args.popupContainer.content(new ModalChoiceList(create(args, {
						modelId: modelId,
						activeItem: currentValue,
						onInput: function (newItem) {
							args.changes.attrs[field.name] = newItem.id
							selectButton.value(newItem['rec_name'])
						},
						onClose: function () {
							args.popupContainer.content(null)
						},
					})))
				}),
			[new Button().value(">").onAction(function () {
				args.saver.ensureChangesAreSaved().then(function () {
					var viewsByType = getViewsByType(args.arch, field.name)
					args.nextItem(modelId, itemId, viewsByType.form);
				})
			}).width(args.defaultButtonSize), 'fixed'],
		])
	},
	many2many: function(args) {
		var field = args.field;
		var item = args.itemValue;
		var subModelId = field.relation;
		var subItemIds = item[field.name] ?item[field.name] : []

		var container
		var createSubItemView = (subItemId, subItemName) => {
			var button = new Button()
			subItemName.then((res) => button.value(res[0]['rec_name']))
			return new HFlex([
				button.value(subItemId).onAction(() => {
					args.saver.ensureChangesAreSaved().then(function () {
						var viewsByType = getViewsByType(args.arch, field.name)
						args.nextItem(subModelId, subItemId, viewsByType.form);
					})
				}),
				[new Button().value('-').width(30).onAction(function () {
					updateMany2manyChanges(args.changes.attrs, field.name, 'unlink', subItemId)
					container.remove(subItemId)
				})],
			]).height(30)
		}

		container = new VPile().content(subItemIds.map((subItemId =>
			[createSubItemView(subItemId, args.request({method: 'model.'+subModelId+'.read', params: [
				[subItemId],
				['rec_name'],
			]})), subItemId]))
		)
		container.add('addButton', new Button().value('+').onAction(() => {
			args.popupContainer.content(new ModalChoiceList(create(args, {
				modelId: subModelId,
				activeItem: null,
				onInput: function (selectedItem) {
					updateMany2manyChanges(args.changes.attrs, field.name, 'add', selectedItem.id)
					container.add(selectedItem.id, createSubItemView(selectedItem.id, Promise.resolve([{'rec_name': selectedItem.rec_name}])), 'addButton')
				},
				onClose: function () {
					args.popupContainer.content(null)
				},
			})))
		}).height(30))

		return new VScroll(container).height(120)
	},
	one2many: function(args) {
		var field = args.field;
		var item = args.itemValue;
		var count = 0

		if (item[field.name]) {
			count = item[field.name].length
		}

		return new Button().value('( ' + count + ' )').onAction(function() {
			var modelId = field.relation;
			var query = [field['relation_field'], '=', item.id];

			var viewsByType = getViewsByType(args.arch, field.name)
			args.nextCollection(modelId, query, viewsByType.tree, viewsByType.form);
		});
	},
	binary: function (args) {
		var field = args.field
		var value = args.itemValue[field.name]
		if (!value) {
			return new Label().value('-')
		}
		var img = new El('img').prop('src', 'data:image/png;base64,'+value.base64).height(200)
		return new VScroll(img).height(200)
	},

};
module.exports = function createFieldEditor (args) {
	var field = args.field;
	if (field.type in editFieldFactories) {
		return editFieldFactories[field.type](args);
	}
	return new Label().value(JSON.stringify(args.itemValue[field.name]));
}

function updateMany2manyChanges(changes, fieldName, method, itemId) {
	if (! (fieldName in changes)) {
		changes[fieldName] = []
	}
	var index = findIndex(changes[fieldName], (pair) => {
		return pair[1][0] === itemId
	})
	if (index >= 0) {
		let pair = changes[fieldName][index]
		// si une opération inverse (add puis delete ou delete puis add) est déjà enregistrée, on la supprime simplement
		if (method !== pair[0]) {
			changes[fieldName].splice(index, 1)
		}
		// et si c'est la même méthode, on ne fait rien pour ne pas créer un doublon
	} else {
		changes[fieldName].push([method, [itemId]])
	}
}
