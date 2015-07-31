var compose = require('ksf/utils/compose');
var _Destroyable = require('ksf/base/_Destroyable');
var create = require('lodash/object/create');
var _ContentDelegate = require('absolute/_ContentDelegate');
var VFlex = require('absolute/VFlex');
var Switch = require('absolute/Switch');
var Label = require('absolute/Label');
var Button = require('absolute/Button');

var ModelView = require('./ModelView');
var Menu = require('./Menu');
var Saver = require('./utils/Saver');
var SidePanelContainer = require('./SidePanelContainer');

/**
Vue qui affiche le menu et une zone principale
@params args {
	request
}
*/
module.exports = compose(_ContentDelegate, _Destroyable, function(args) {
	var self = this
	var commonArgs = create(args, {
		changes: {
			geom: null,
			attrs: {},
		},
	});
	commonArgs.saver = new Saver(commonArgs)
	var mainArea = new Switch();
	var message = new Label();
	this._content = new SidePanelContainer({
		panel: new VFlex([
				[new Button().value("logout").onAction(args.logout).height(30), 'fixed'],
				this._menu = new Menu(create(commonArgs, {
					onDisplayModel: function(modelId, listViewId, formViewId) {
						mainArea.content(self._own(new ModelView(create(commonArgs, {
							modelId: modelId,
							listViewId: listViewId,
							formViewId: formViewId,
							message: message,
						})), 'mainView'));
					},
					message: message,
				})).width(300),
				[message.height(30), 'fixed'],
			]),
		options: {
			panelPosition: 'left',
		},
		main: mainArea.depth(100),
	});
});
