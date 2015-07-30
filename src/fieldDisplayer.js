var Label = require('absolute/Label');

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
		if (!item[field.name]) {
			return new Label().value("( 0 )")
		}
		return new Label().value('( ' + item[field.name].length + ' )');
	},
	many2many: function(item, field) {
		if (!item[field.name]) {
			return new Label().value("( 0 )")
		}
		return new Label().value('( ' + item[field.name].length + ' )');
	},
	// function
	// property
};

module.exports = function displayFieldValue (item, field) {
	if (field.type in displayFieldFactories) {
		return displayFieldFactories[field.type](item, field);
	}
	return new Label().value(JSON.stringify(item[field.name]));
}
