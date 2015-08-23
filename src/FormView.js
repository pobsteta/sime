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
var Switch = require('absolute/Switch');
var Align = require('absolute/Align');
var Button = require('absolute/Button');
var Space = require('absolute/Space');
var Margin = require('absolute/Margin');

var createFieldEditor = require('./fieldEditor')

var getFieldIdsToRequest = require('./utils/getFieldIdsToRequest');
var getFieldsFromView = require('./utils/getFieldsFromView')

var fakeCamera = {
	getPicture: function fakeGetPicture(cb) {
		setTimeout(cb.bind(null, '/9j/4QDCRXhpZgAASUkqAAgAAAAHABIBAwABAAAAAQAAABoBBQABAAAAYgAAABsBBQABAAAAagAAACgBAwABAAAAAgAAADEBAgAOAAAAcgAAADIBAgAUAAAAgAAAAGmHBAABAAAAlAAAAGJPcmRgAAAAAQAAAGAAAAABAAAAUGhvdG9GaWx0cmUgNwAyMDE1OjA4OjIzIDA4OjExOjI3AAMAAJAHAAQAAAAwMjEwAqADAAEAAAAKAAAAA6ADAAEAAAAKAAAA/9sAQwADAgIDAgIDAwMDBAMDBAUIBQUEBAUKBwcGCAwKDAwLCgsLDQ4SEA0OEQ4LCxAWEBETFBUVFQwPFxgWFBgSFBUU/9sAQwEDBAQFBAUJBQUJFA0LDRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU/8AAEQgACgAKAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A4TTjeW0zidmZm5WEOCwUhcvjsARjAGMseg6b1RS/fiHYv0/A1LXBVn7RqVrH4fiq/wBYanypPyP/2Q=='
		), 100)
	},
}


// simple fomrulaire non réactif mais qui écrit dans changes.attrs
var ItemValueEditor = compose(_ContentDelegate, function (args) {
	var container = this._content = new VPile()

	args.viewDef.then(function(viewDef) {
		var arch = new DOMParser().parseFromString(viewDef.arch, 'application/xml')
		var fieldIds = getFieldsFromView(arch);
		fieldIds.forEach(function(fieldId) {
			var field = viewDef.fields[fieldId]
			var fieldWidget = createFieldEditor(create(args, {
				field: field,
				arch: arch,
			}))
			container.add(fieldId, new Margin(new HFlex([
				[new Label().value(field.string).width(150), 'fixed'],
				fieldWidget,
			]), 5).height((fieldWidget.height() || 30)+10));
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

	this._content = new HFlex([
		new VScroll(formContainer),
		[new VPile().content(
			(args.extraButton ? [args.extraButton.height(args.defaultButtonSize)] : []).concat([
			new Button().value("Enregistrer").height(args.defaultButtonSize).onAction(this._save.bind(this)),
			new Button().value("Annuler").height(args.defaultButtonSize).onAction(this._cancel.bind(this)),
			new Button().value("Supprimer").height(args.defaultButtonSize).onAction(this._destroyItem.bind(this)),
			new Button().value("Ajouter une photo").height(args.defaultButtonSize).onAction(this._addAttachement.bind(this)),
		])).width(100), 'fixed'],
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
		if (Object.keys(args.changes.attrs).length === 0) {
			return true
		}
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
	_addAttachement: function () {
		var args = this._args
		var camera, options
		if (navigator.camera) {
			camera = navigator.camera
			options = {
				quality: 50,
				destinationType: window.Camera.DestinationType.DATA_URL,
			}
		} else {
			camera = fakeCamera
		}
		camera.getPicture((imageData) => {
			args.request({method: 'model.ir.attachment.create', params: [
				[{
					resource: args.modelId + ',' + args.itemId,
					name: new Date().toISOString()+'.jpg',
					type: 'data',
					data: {
						'__class__': 'buffer',
						'base64': imageData,
					},
				}],
			]}).then(() => args.message.value("Photo enregistrée"))
		}, (err) => {
			args.message.value("Erreur lors de la prise de photo: "+ err)
		}, options)
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
			[new Space().width(args.defaultButtonSize+10), 'fixed'],
		]).height(args.defaultButtonSize), 'fixed'],
	])

	this._own(on(args.saver, 'save', function () {
		if (args.changes.modelId === args.modelId) {
			return self._save()
		}
	}))
}, {
	_save: function () {
		var args = this._args
		if (Object.keys(args.changes.attrs).length === 0) {
			return true
		}
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
	this._content = new Reactive({
		value: this._own(new MappedValue(args.activeItem, function(itemId) {
			var formArgs = create(args, {
				itemId: itemId,
				viewDef: viewDef,
			})
			if (itemId === 'new') {
				self._destroy('attrsChangedListener')
				return self._own(new ItemCreator(formArgs), 'form')
			} else if (itemId) {
				return new Reactive({
					value: self._own(new FromEventValue(args.saver, 'attrsChanged', function () {
						return self._own(new ItemEditor(formArgs), 'form')
					}), 'attrsChangedListener'),
					content: new Switch(),
					prop: 'content',
				})
			} else {
				self._destroy('form')
				self._destroy('attrsChangedListener')
				return new Align(
					new Label().value("Aucun élément sélectionné").width(200).height(60),
				'middle', 'middle');
			}
		})),
		content: new Switch(),
		prop: 'content',
	})

});
