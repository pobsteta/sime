var create = require('lodash/object/create');
var compose = require('ksf/utils/compose');
var _Destroyable = require('ksf/base/_Destroyable');
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
module.exports = compose(_ContentDelegate, _Destroyable, function(args) {
	var self = this
	this.mode = new Value('list');
	var listView = this._own(new ListView(create(args, {
		onAction: this.toggleMode.bind(this),
	})));
	var formView = new VFlex([
		[new Button().value('basculer').height(60).onAction(function () {
			args.saver.ensureChangesAreSaved().then(self.toggleMode.bind(self))
		}), 'fixed'],
		this._own(new FormView(args)),
	]);

	this._content = new Reactive({
		value: new MappedValue(this.mode, function(modeValue) {
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
}, {
	toggleMode: function () {
		var mode = this.mode
		mode.value(mode.value() === 'list' ? 'form' : 'list');
	},
});
