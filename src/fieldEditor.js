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
			var viewsByType = getViewsByType(args.arch, field.name)
			args.nextItem(modelId, itemId, viewsByType.form);
			// createChoiceList(item[field.name], field, changes, message, request, function (itemId) {
			// 	changes[field.name] = itemId;
			// });
		});
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
	// pour l'instant c'est du copier/coller de one2many
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
