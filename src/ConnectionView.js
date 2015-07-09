var compose = require('ksf/utils/compose');
var create = require('lodash/object/create');
var _ContentDelegate = require('absolute/_ContentDelegate');
var VFlex = require('absolute/VFlex');
var HFlex = require('absolute/HFlex');
var Switch = require('absolute/Switch');
var Label = require('absolute/Label');
var Button = require('absolute/Button');

var ModelView = require('./ModelView');
var Menu = require('./Menu');

/**
Vue qui affiche le menu et une zone principale
@params args {
	request
}
*/
module.exports = compose(_ContentDelegate, function(args) {
	var mainArea  = new Switch();
	var message = new Label();
	this._content = new HFlex([
		[new VFlex([
			[new Button().value("logout").onAction(args.logout).height(30), 'fixed'],
			this._menu = new Menu(create(args, {
				onDisplayModel: function(modelId) {
					mainArea.content(new ModelView(create(args, {
						modelId: modelId,
						message: message
					})));					
				},
				message: message,
			})).width(300),
			[message.height(30), 'fixed']
		]).width(300), 'fixed'],
		mainArea,
	]);
});