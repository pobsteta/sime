var compose = require('ksf/utils/compose');
var on = require('ksf/utils/on')
var create = require('lodash/object/create');

var _ContentDelegate = require('absolute/_ContentDelegate');
var _Destroyable = require('ksf/base/_Destroyable');
var Label = require('absolute/Label');
var LabelInput = require('absolute/LabelInput');
var MappedValue = require('ksf/observable/MappedValue');
var Reactive = require('absolute/Reactive');
var VFlex = require('absolute/VFlex');
var HFlex = require('absolute/HFlex');
var VPile = require('absolute/VPile');
var VScroll = require('absolute/VScroll');
var Margin = require('absolute/Margin');
var Background = require('absolute/Background');
var Clickable = require('absolute/Clickable');
var Switch = require('absolute/Switch');
var Align = require('absolute/Align');
var Button = require('absolute/Button');

var getFieldIdsToRequest = require('./getFieldIdsToRequest');

var editFieldFactories = {
	boolean: function(args) {
		return new Label().value(args.itemValue[args.field.name] ? 'oui' : 'non'); // TODO: remplacer par le bon widget
	},
	integer: function(args) {
		return new Label().value(args.itemValue[args.field.name]+'');
	},
	biginteger: function(args) {
		return new Label().value(args.itemValue[args.field.name]+'');
	},
	char: function(args) {
		return new LabelInput().value(args.itemValue[args.field.name]).onInput(function(newValue) {
			args.changes.attrs[args.field.name] = newValue;
		});
	},
	text: function(args) {
		return new Label().value(args.itemValue[args.field.name]);
	},
	float: function(args) {
		return new Label().value(args.itemValue[args.field.name]+'');
	},
	numeric: function(args) {
		return new Label().value(args.itemValue[args.field.name]+'');
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
		var item = args.itemValue;
		return new Button().value(item[field.name+'.rec_name']).onAction(function() {
			var modelId = field.relation;
			var itemId = item[field.name];
			args.nextItem(modelId, itemId);
			// createChoiceList(item[field.name], field, changes, message, request, function (itemId) {
			// 	changes[field.name] = itemId;
			// });
		});
	},
	one2many: function(args) {
		var field = args.field;
		var item = args.itemValue;
		return new Button().value('( ' + item[field.name].length + ' )').onAction(function() {
			var modelId = field.relation;
			var query = [field['relation_field'], '=', item.id];

			// TODO: à sortir dans un utilitaire ?
			var fieldElement = args.arch.querySelector('field[name="'+field.name+'"]')
			var viewTypes = fieldElement.getAttribute('mode').split(',')
			var viewIds = fieldElement.getAttribute('view_ids').split(',')
			var viewsByType = viewTypes.reduce(function(o, type, i){
				o[type] = viewIds[i]
				return o
			}, {})

			args.nextCollection(modelId, query, viewsByType.tree, viewsByType.form);
		});
	},
	many2many: function(args) {
		return new Label().value('( ' + args.itemValue[args.field.name].length + ' )');
	},
	// selection
	// reference
	// function
	// property
};
function editFieldValue (args) {
	var field = args.field;
	if (field.type in editFieldFactories) {
		return editFieldFactories[field.type](args);
	}
	return new Label().value(JSON.stringify(args.itemValue[field.name]));
}

function createChoiceList (selectedItemId, field, changes, message, request, onInput) {
	message.value('loading...');
	var modelId = field.relation;
	var list = new VPile();
	request({method: "model."+modelId+".search_read", params: [
		[],
		0,
		10,
		null,
		['rec_name'],
	],
	}).then(function(items) {
		items.forEach(function(item) {
			var itemId = item.id;
			var itemView = new Clickable(new Background(
				new Label().value(item['rec_name'])
			).color(itemId === selectedItemId ? 'lightblue' : 'lightgrey').border('1px solid')).onAction(function() {
				onInput(itemId);
			}).height(30);
			list.add(itemId, itemView);
		});
		message.value('loaded');
	}, function(err) {
		message.value("erreur");
		console.log("erreur", err);
	});
	return list;
}

// simple fomrulaire non réactif mais qui écrit dans changes.attrs
var ItemValueEditor = compose(_ContentDelegate, function (args) {
	var container = this._content = new VPile()

	args.viewDef.then(function(viewDef) {
		var arch = new DOMParser().parseFromString(viewDef.arch, 'application/xml')
		var fieldIds = Object.keys(viewDef.fields);
		fieldIds.forEach(function(fieldId) {
			var propDisplayer = new HFlex([
				[new Label().value(viewDef.fields[fieldId].string).width(150), 'fixed'],
				editFieldValue(create(args, {
					field: viewDef.fields[fieldId],
					arch: arch,
				})),
			]).height(30);
			container.add(fieldId, propDisplayer);
		});
	})

})

var ItemEditor = compose(_ContentDelegate, _Destroyable, function (args) {
	var self = this
	this._args = args
	var formContainer = this._formContainer = new Switch()
	args.viewDef.then(function (viewDef) {
		args.request({
			"method": "model."+args.modelId+".read",
			"params": [[args.itemId], getFieldIdsToRequest(viewDef.fields)],
		}).then(function (res) {
			self._itemValue = res[0]
			self._displayForm()
		})
	})

	this._content = new VFlex([
		new VScroll(formContainer),
		[new HFlex([
			new Button().value("Enregistrer").onAction(this._save.bind(this)),
			new Button().value("Annuler").onAction(this._cancel.bind(this)),
			new Button().value("Supprimer").onAction(this._destroyItem.bind(this)),
		]).height(60), 'fixed'],
	])

	this._own(on(args.saver, 'save', this._save.bind(this)))
	this._own(on(args.saver, 'cancel', this._cancel.bind(this)))
}, {
	_save: function () {
		var args = this._args
		return args.request({method: 'model.'+args.modelId+'.write', params: [
			[args.itemId],
			args.changes.attrs,
		]}).then(function () {
			args.changes.attrs = {}
			args.saver.emit('attrsChanged')
		})
	},
	_cancel: function () {
		var args = this._args
		args.changes.attrs = {}
		this._displayForm()
	},
	_displayForm: function () {
		this._formContainer.content(new ItemValueEditor(create(this._args, {
			itemValue: this._itemValue,
		})))
	},
	_destroyItem: function () {
		var args = this._args
		args.confirm("Etes-vous sûr ?").then(function (res) {
			if (res) {
				args.request({method: 'model.'+args.modelId+'.delete', params: [
					[args.itemId],
				]}).then(function () {
					args.saver.emit('itemDestroyed')
					args.activeItem.value(null)
				})
			}
		})
	},
})


var ItemCreator = compose(_ContentDelegate, _Destroyable, function (args) {
	this._args = args
	var formContainer = new Switch()
	args.viewDef.then(function (viewDef) {
		args.request({method: 'model.'+args.modelId+'.default_get', params: [
			Object.keys(viewDef.fields),
		]}).then(function (itemValue) {
			if (args.query) {
				// pour l'instant les query ne servent qu'aux relations parent-enfant mais ça ne va peut-être pas rester le cas
				var relationField = args.query[0]
				var parentId = args.query[2]
				itemValue[relationField] = parentId
			}
			args.changes.attrs = itemValue
			formContainer.content(new ItemValueEditor(create(args, {
				itemValue: itemValue,
			})))
		})
	})

	this._content = new VFlex([
		new VScroll(formContainer),
		[new HFlex([
			new Button().value("Créer").onAction(this._save.bind(this)),
			new Button().value("Annuler").onAction(function () {
				args.changes.attrs = {}
				args.activeItem.value(null)
			}),
		]).height(60), 'fixed'],
	])

	this._own(on(args.saver, 'save', this._save.bind(this)))
}, {
	_save: function () {
		var args = this._args
		return args.request({method: 'model.'+args.modelId+'.create', params: [
			[args.changes.attrs],
		]}).then(function (res) {
			args.changes.attrs = {}
			args.saver.emit('itemCreated')
			args.activeItem.value(res[0])
		}, function (err) {
			args.message.value(JSON.stringify(err))
			return new Error(err)
		})
	},
})

/**
@params args {
	modelId
	query
	request
}
*/
module.exports = compose(_Destroyable, _ContentDelegate, function(args) {
	var self = this
	var viewDef = args.request({
		"method": "model."+args.modelId+".fields_view_get",
		"params": [args.formViewId || null, "form"],
	});
	this._content = new Margin(this._own(new Reactive({
		value: new MappedValue(args.activeItem, function(itemId) {
			var formArgs = create(args, {
				itemId: itemId,
				viewDef: viewDef,
			})
			if (itemId === 'new') {
				return self._own(new ItemCreator(formArgs), 'form')
			} else if (itemId) {
				return self._own(new ItemEditor(formArgs), 'form')
			} else {
				self._destroy('form')
				return new Align(
					new Label().value("Aucun élément sélectionné").width(200).height(60),
				'middle', 'middle');
			}
		}),
		content: new Switch(),
		prop: 'content',
	})), 10);
});
