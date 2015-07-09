var compose = require('ksf/utils/compose');
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
	this._content = new Margin(new VFlex([
		new VScroll(new Reactive({
			value: new MappedValue(args.activeItem, function(itemId) {
				var container = new VPile();
				displayForm(args.modelId, itemId, container, args.message, args.request);
				return container;
			}),
			content: new Switch(),
			prop: 'content',
		})),
	]), 10);

});

// TODO: load 'fields_view_get' only once
function displayForm (modelId, itemId, container, message, request) {
	message.value('loading...');
	request({
		"method":"model."+modelId+".fields_view_get",
		"params":[null, "form"],
	}).then(function(res) {
		var changes = {};
		var fieldIds = Object.keys(res.fields);
		container.add('save', new Button().value('Enregistrer').height(60).onAction(function() {
			message.value('enregistrement...');
			request({
				method: "model."+modelId+".write",
				params: [[itemId], changes],
			}).then(function() {
				message.value("Enregistré");
			}, function(err) {
				message.value("Erreur lors de l'enregistrement");
				console.log("Erreur lors de l'enregistrement", err);
			});
		}));
		return request({
			"method":"model."+modelId+".read",
			"params":[[itemId], getFieldIdsToRequest(res.fields)],
		}).then(function(dataRes) {
			fieldIds.forEach(function(fieldId) {
				var propDisplayer = new HFlex([
					[new Label().value(res.fields[fieldId].string).width(150), 'fixed'],
					editFieldValue(dataRes[0], res.fields[fieldId], changes, container, message, request),
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
	boolean: function(item, field) {
		return new Label().value(item[field.name] ? 'oui' : 'non'); // TODO: remplacer par le bon widget		
	},
	integer: function(item, field) {
		return new Label().value(item[field.name]+'');	
	},
	biginteger: function(item, field) {
		return new Label().value(item[field.name]+'');	
	},
	char: function(item, field, changes) {
		return new LabelInput().value(item[field.name]).onInput(function(newValue) {
			changes[field.name] = newValue;
		});	
	},
	text: function(item, field) {
		return new Label().value(item[field.name]);	
	},
	float: function(item, field) {
		return new Label().value(item[field.name]+'');	
	},
	numeric: function(item, field) {
		return new Label().value(item[field.name]+'');	
	},
	date: function(item, field) {
		return new Label().value(item[field.name]);	
	},
	datetime: function(item, field) {
		return new Label().value(item[field.name]);	
	},
	time: function(item, field) {
		return new Label().value(item[field.name]);	
	},
	many2one: function(item, field, changes, container, message, request) {
		return new Button().value(item[field.name+'.rec_name']).onAction(function() {
			container.next(createChoiceList(item[field.name], field, changes, message, request, function (itemId) {
				changes[field.name] = itemId;
				container.back();
			}));
		});
	},
	one2many: function(item, field, changes, container, message, request) {
		return new Button().value('( ' + item[field.name].length + ' )').onAction(function() {
			var viewId = field.views.tree['view_id'];
			var modelId = field.relation;
			var formViewId = null;
			var query = [field['relation_field'], '=', item.id];
			displayList(viewId, modelId, formViewId, container, message, request, query);
		});	
	},
	many2many: function(item, field) {
		return new Label().value('( ' + item[field.name].length + ' )');	
	},
	// selection
	// reference
	// function
	// property
};
function editFieldValue (item, field, changes, container, message, request, currentPage) {
	if (field.type in editFieldFactories) {
		return editFieldFactories[field.type](item, field, changes, container, message, request, currentPage);
	}
	return new Label().value(JSON.stringify(item[field.name]));
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
