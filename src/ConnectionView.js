var compose = require('ksf/utils/compose');
var _Destroyable = require('ksf/base/_Destroyable');
var bindValue = require('ksf/observable/bindValue');
var create = require('lodash/object/create');
var _ContentDelegate = require('absolute/_ContentDelegate');
var VFlex = require('absolute/VFlex');
var Switch = require('absolute/Switch');
var Label = require('absolute/Label');
var Button = require('absolute/Button');
import VPile from 'absolute/VPile'
var LabelInput = require('absolute/LabelInput');

var ModelView = require('./ModelView');
var Menu = require('./Menu');
var Saver = require('./utils/Saver');
var SidePanelContainer = require('./SidePanelContainer');

var sublevel = require('sublevel')
var levelPromise = require('level-promise')
var clearDb = require('./utils/clearDb')
var download = require('./utils/download')

import trytonLogin from './utils/trytonLogin'

/**
Vue qui affiche le menu et une zone principale
@params args {
	request
}
*/
module.exports = compose(_ContentDelegate, _Destroyable, function(args) {
	var self = this
	var session = args.session

	this._own(bindValue(session, function(sessionToken) {
		if (!sessionToken) {
			var passwordInput;
			var authenticationMessage = new Label();
			args.modal(new VPile().width(200).content([
				passwordInput = new LabelInput().placeholder("password").height(30),
				new Button().value("OK").height(30).onAction(function() {
					authenticationMessage.value('authenticating...');
					var pwd = passwordInput.value();
					trytonLogin(args.connectionValue, session, pwd).then(function() {
						authenticationMessage.value('authenticated');
						args.modal(null);
						args.passwordValue.value(pwd);
					}, function() {
						authenticationMessage.value('authentication error');
					});
				}),
				authenticationMessage.height(30),
			]))
		}
	}))

	var commonArgs = create(args, {
		changes: {
			geom: null,
			attrs: {},
		},
	});
	commonArgs.saver = new Saver(commonArgs)
	var mainArea = new Switch();
	var message = new Label();
	var panelContainer = this._content = new SidePanelContainer({
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
						panelContainer.focusArea('main');
					},
					message: message,
				})).width(300),
				[new Button().value("Télécharger").onAction(function () {
					message.value("Téléchargement des données en cours...")
					var rawDb = args.localDb
					clearDb(rawDb).then(() => {
						var db = sublevel(rawDb)
						levelPromise(db)
						download(args.request, args.wfsRequest, db,
							132,  // menuID
							[273503.64, 6243639.19, 274521.21, 6244408.34]  // extent in EPSG:3857 (Mercator)
						).then(
							message.value.bind(message, "Téléchargement terminé"),
							message.value.bind(message, "Erreur lors du téléchargement")
						)
					})
				}).height(args.defaultButtonSize), 'fixed'],
				[new Button().value("Passer hors ligne").onAction(args.goOffline).height(args.defaultButtonSize), 'fixed'],
				[message.height(30), 'fixed'],
			]),
		options: {
			panelPosition: 'left',
			panelOpen: true,
		},
		main: mainArea.depth(100),
	});
});
