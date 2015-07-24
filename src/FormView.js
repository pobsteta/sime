var compose = require('ksf/utils/compose');
var create = require('lodash/object/create');

var _ContentDelegate = require('absolute/_ContentDelegate');
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
var Button = require('absolute/Button');

var getFieldIdsToRequest = require('./getFieldIdsToRequest');


/**
@params args {
	modelId
	query
	request
}
*/
module.exports = compose(_ContentDelegate, function(args) {
	this._args = args;
	// load fields def early and only once
	var fields = args.request({
		"method":"model."+args.modelId+".fields_view_get",
		"params":[args.formViewId || null, "form"],
	});
	this._content = new Margin(new VFlex([
		new VScroll(new Reactive({
			value: new MappedValue(args.activeItem, function(itemId) {
				if (itemId) {
					var container = new VPile();
					displayForm(create(args, {
						itemId: itemId,
						fields: fields,
						container: container,
					}));
					return container;
				} else {
					return new Label().value("Aucun élément sélectionné");
				}
			}),
			content: new Switch(),
			prop: 'content',
		})),

	]), 10);

});

function displayForm (args) {
	var message = args.message;
	var container = args.container;
	message.value('loading form view ...');
	args.fields.then(function(res) {
		var arch = new DOMParser().parseFromString(res.arch, 'application/xml')
		var changes = {};
		var fieldIds = Object.keys(res.fields);
		container.add('save', new Button().value('Enregistrer').height(60).onAction(function() {
			message.value('enregistrement...');
			args.request({
				method: "model."+args.modelId+".write",
				params: [[args.itemId], changes],
			}).then(function() {
				message.value("Enregistré");
			}, function(err) {
				message.value("Erreur lors de l'enregistrement");
				console.log("Erreur lors de l'enregistrement", err);
			});
		}));
		return args.request({
			"method":"model."+args.modelId+".read",
			"params":[[args.itemId], getFieldIdsToRequest(res.fields)],
		}).then(function(dataRes) {
			fieldIds.forEach(function(fieldId) {
				var propDisplayer = new HFlex([
					[new Label().value(res.fields[fieldId].string).width(150), 'fixed'],
					editFieldValue(create(args, {
						item: dataRes[0],
						field: res.fields[fieldId],
						changes: changes,
						arch: arch,
					}))
				]).height(30);
				container.add(fieldId, propDisplayer);
			});
			message.value('loaded');
		}, function(err) {
			message.value("erreur");
			console.log("erreur", err);
		});
	}).done();
}

var editFieldFactories = {
	boolean: function(args) {
		return new Label().value(args.item[args.field.name] ? 'oui' : 'non'); // TODO: remplacer par le bon widget
	},
	integer: function(args) {
		return new Label().value(args.item[args.field.name]+'');
	},
	biginteger: function(args) {
		return new Label().value(args.item[args.field.name]+'');
	},
	char: function(args) {
		return new LabelInput().value(args.item[args.field.name]).onInput(function(newValue) {
			args.changes[args.field.name] = newValue;
		});
	},
	text: function(args) {
		return new Label().value(args.item[args.field.name]);
	},
	float: function(args) {
		return new Label().value(args.item[args.field.name]+'');
	},
	numeric: function(args) {
		return new Label().value(args.item[args.field.name]+'');
	},
	date: function(args) {
		return new Label().value(args.item[args.field.name]);
	},
	datetime: function(args) {
		return new Label().value(args.item[args.field.name]);
	},
	time: function(args) {
		return new Label().value(args.item[args.field.name]);
	},
	many2one: function(args) {
		var field = args.field;
		var item = args.item;
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
		var item = args.item;
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
		return new Label().value('( ' + args.item[args.field.name].length + ' )');
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
	return new Label().value(JSON.stringify(args.item[field.name]));
}

function createChoiceList (selectedItemId, field, changes, message, request, onInput) {
	message.value('loading...');
	var modelId = field.relation;
	var list = new VPile();
	request({
		"method":"model."+modelId+".search_read",
		"params":[[], 0, 10, null, ['rec_name']],
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
