var when = require('when');
var find = require('lodash/collection/find');
var create = require('lodash/object/create');

var compose = require('ksf/utils/compose');
var bindValue = require('ksf/observable/bindValue');

var _ContentDelegate = require('absolute/_ContentDelegate');
var Label = require('absolute/Label');
var VFlex = require('absolute/VFlex');
var HFlex = require('absolute/HFlex');
var VPile = require('absolute/VPile');
var VScroll = require('absolute/VScroll');
var Margin = require('absolute/Margin');
var Background = require('absolute/Background');
var Clickable = require('absolute/Clickable');

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
	var container = new VPile();
	this._content = new Margin(new VFlex([
		new VScroll(container),
	]), 10);

	displayList(create(args, {
		container: container,
	}));
});

function displayList (args) {
	var message = args.message;
	message.value('loading...');
	var query = args.query || [];
	var modelId = args.modelId;
	var request = args.request;
	return when.all([request({
		"method":"model."+modelId+".fields_view_get",
		"params":[args.listViewId || null, "tree"],
	}), request({
		"method":"model."+modelId+".search",
		"params":[query, 0, 10, null],
	})]).then(function(res) {
		var fieldsRes = res[0];
		var itemIds = res[1];
		var fieldIds = Object.keys(fieldsRes.fields);
		return request({
			"method":"model."+modelId+".read",
			"params":[itemIds, getFieldIdsToRequest(fieldsRes.fields)],
		}).then(function(dataRes) {
			itemIds.forEach(function(itemId) {
				var item = find(dataRes, {id: itemId});
				var itemView = new Background(new VPile().content(fieldIds.map(function(fieldId) {
					return new HFlex([
						[new Label().value(fieldsRes.fields[fieldId].string).width(150), 'fixed'],
						displayFieldValue(item, fieldsRes.fields[fieldId]),
					]).height(30);
				}))).color('transparent').border('1px solid');
				// TODO : remplacer ces listeners inividuels par un listener global...
				bindValue(args.activeItem, function(activeItemId) {
					itemView.color(activeItemId === itemId ? 'lightblue' : 'transparent');
				});
				args.container.add(itemId, new Clickable(itemView).onAction(function() {
					args.activeItem.value(itemId);
					args.onAction && args.onAction(itemId);
				}).height(fieldIds.length*30));
			});
			message.value('loaded');
		}, function(err) {
			message.value("erreur");
			console.log("erreur", err);
		});
	}).done();
}

var displayFieldFactories = {
	boolean: function(item, field) {
		return new Label().value(item[field.name] ? 'oui' : 'non'); // TODO: remplacer par le bon widget
	},
	integer: function(item, field) {
		return new Label().value(item[field.name]+'');
	},
	biginteger: function(item, field) {
		return new Label().value(item[field.name]+'');
	},
	char: function(item, field) {
		return new Label().value(item[field.name]);
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
	// selection
	// reference
	many2one: function(item, field) {
		return new Label().value(item[field.name+'.rec_name']);
	},
	one2many: function(item, field) {
		return new Label().value('( ' + item[field.name].length + ' )');
	},
	many2many: function(item, field) {
		return new Label().value('( ' + item[field.name].length + ' )');
	},
	// function
	// property
};
function displayFieldValue (item, field) {
	if (field.type in displayFieldFactories) {
		return displayFieldFactories[field.type](item, field);
	}
	return new Label().value(JSON.stringify(item[field.name]));
}

