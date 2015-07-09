var create = require('lodash/object/create');
var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var Switch = require('absolute/Switch');
var VFlex = require('absolute/VFlex');
var Button = require('absolute/Button');
var Value = require('ksf/observable/Value');
var MappedValue = require('ksf/observable/MappedValue');
var Reactive = require('absolute/Reactive');

var ListView = require('./ListView');
var FormView = require('./FormView');

/**
@params args {
	modelId
	query
	request
}
*/
module.exports = compose(_ContentDelegate, function(args) {
	var mode = new Value('list');
	var listView = new ListView(create(args, {
		onAction: toggleMode.bind(null, mode),
	}));
	var formView = new VFlex([
		[new Button().value('basculer').height(60).onAction(toggleMode.bind(null, mode)), 'fixed'],
		new FormView(args),
	]);

	this._content = new Reactive({
		value: new MappedValue(mode, function(modeValue) {
			if (modeValue === 'list') {
				return listView;
			}
			if (modeValue === 'form') {
				return formView;
			}
		}),
		content: new Switch(),
		prop: 'content',
	});
});

function toggleMode (mode) {
	mode.value(mode.value() === 'list' ? 'form' : 'list');
}