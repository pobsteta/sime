var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var VScroll = require('absolute/VScroll');
var VFlex = require('absolute/VFlex');
var HFlex = require('absolute/HFlex');
var Label = require('absolute/Label');
var LabelInput = require('absolute/LabelInput');
var Background = require('absolute/Background');
var Clickable = require('absolute/Clickable');
var Button = require('absolute/Button');
var VPile = require('absolute/VPile');

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
	var container = new VPile().content([new Label().value("Chargement...")]);
	this._content = new VScroll(container)
	args.request({method: "model."+args.modelId+".search_read", params: [
		[],
		0,
		10,
		null,
		['rec_name'],
	]}).then(function(items) {
		container.content(items.map(function(item) {
			var itemId = item.id;
			var recName = item['rec_name']
			return new Clickable(new Background(
				new Label().value(recName)
			).color(itemId === args.activeItem ? 'lightblue' : 'lightgrey').border('1px solid')).onAction(function() {
				args.onInput(itemId, recName);
			}).height(60);
		}))
	}, function(err) {
		console.log("erreur", err);
		container.content([new Label().value("Erreur lors du chargement de la liste")])
	});
})


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
		var modelId = field.relation;
		var itemId = item[field.name];
		var selectButton
		return new HFlex([
			selectButton = new Button().value(item[field.name+'.rec_name']).onAction(function() {
				var currentValue = args.changes.attrs[field.name] || itemId
				args.modal(new VPile().content([
					new ChoiceList({
						modelId: modelId,
						activeItem: currentValue,
						onInput: function (newItemId, recName) {
							args.changes.attrs[field.name] = newItemId
							selectButton.value(recName)
							args.modal(null)
						},
						request: args.request,
					}).height(500),
					new Button().value("Annuler").onAction(function () {
						args.modal(null)
					}).height(60),
				]).width(200))
			}),
			[new Button().value(">").onAction(function () {
				args.saver.ensureChangesAreSaved().then(function () {
					var viewsByType = getViewsByType(args.arch, field.name)
					args.nextItem(modelId, itemId, viewsByType.form);
				})
			}).width('60'), 'fixed'],
		])
	},
	one2many: function(args) {
		var field = args.field;
		var item = args.itemValue;

		if (!item[field.name]) {
			return new Label().value("( 0 )")
		}

		return new Button().value('( ' + item[field.name].length + ' )').onAction(function() {
			var modelId = field.relation;
			var query = [field['relation_field'], '=', item.id];

			var viewsByType = getViewsByType(args.arch, field.name)
			args.nextCollection(modelId, query, viewsByType.tree, viewsByType.form);
		});
	},
	// TODO: pour l'instant c'est du copier/coller de one2many mais il faut corriger la query
	many2many: function(args) {
		var field = args.field;
		var item = args.itemValue;

		if (!item[field.name]) {
			return new Label().value("( 0 )")
		}

		return new Button().value('( ' + item[field.name].length + ' )').onAction(function() {
			var modelId = field.relation;
			var query = [field['relation_field'], '=', item.id];

			var viewsByType = getViewsByType(args.arch, field.name)
			args.nextCollection(modelId, query, viewsByType.tree, viewsByType.form);
		});
	},
	// selection
	// reference
	// function
	// property
};
module.exports = function createFieldEditor (args) {
	var field = args.field;
	if (field.type in editFieldFactories) {
		return editFieldFactories[field.type](args);
	}
	return new Label().value(JSON.stringify(args.itemValue[field.name]));
}
