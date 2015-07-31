var compose = require('ksf/utils/compose');
var on = require('ksf/utils/on')
var create = require('lodash/object/create');

var _ContentDelegate = require('absolute/_ContentDelegate');
var _Destroyable = require('ksf/base/_Destroyable');
var FromEventValue = require('ksf/observable/FromEventValue')
var Label = require('absolute/Label');
var MappedValue = require('ksf/observable/MappedValue');
var Reactive = require('absolute/Reactive');
var VFlex = require('absolute/VFlex');
var HFlex = require('absolute/HFlex');
var VPile = require('absolute/VPile');
var VScroll = require('absolute/VScroll');
var Margin = require('absolute/Margin');
var Switch = require('absolute/Switch');
var Align = require('absolute/Align');
var Button = require('absolute/Button');

var createFieldEditor = require('./fieldEditor')
var createFieldDisplayer = require('./fieldDisplayer')

var getFieldIdsToRequest = require('./getFieldIdsToRequest');
var getFieldsFromView = require('./utils/getFieldsFromView')


// simple fomrulaire non réactif mais qui écrit dans changes.attrs
var ItemValueEditor = compose(_ContentDelegate, function (args) {
	var container = this._content = new VPile()

	args.viewDef.then(function(viewDef) {
		var arch = new DOMParser().parseFromString(viewDef.arch, 'application/xml')
		var fieldIds = getFieldsFromView(arch);
		fieldIds.forEach(function(fieldId) {
			var field = viewDef.fields[fieldId]
			var fieldWidget = field.readonly ? createFieldDisplayer(args.itemValue, field) : createFieldEditor(create(args, {
				field: field,
				arch: arch,
			}))
			container.add(fieldId, new HFlex([
				[new Label().value(field.string).width(150), 'fixed'],
				fieldWidget,
			]).height(30));
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

	this._own(on(args.saver, 'save', function () {
		if (args.changes.modelId === args.modelId) {
			return self._save()
		}
	}))
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
		this._args.changes.attrs = {}
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
	var self = this
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
			new Button().value("Créer").onAction(function () {
				self._save().catch(function() {}) // done() n'existe pas
			}),
			new Button().value("Annuler").onAction(function () {
				args.changes.attrs = {}
				args.activeItem.value(null)
			}),
		]).height(60), 'fixed'],
	])

	this._own(on(args.saver, 'save', function () {
		if (args.changes.modelId === args.modelId) {
			return self._save()
		}
	}))
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
			throw new Error(err)
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
				return new Reactive({
					value: self._own(new FromEventValue(args.saver, 'attrsChanged', function () {
						return new ItemEditor(formArgs)
					}), 'form'),
					content: new Switch(),
					prop: 'content',
				})
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
