var create = require('lodash/object/create')
var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var VFlex = require('absolute/VFlex');
var HFlex = require('absolute/HFlex');
var VPile = require('absolute/VPile');
var VScroll = require('absolute/VScroll');
var Margin = require('absolute/Margin');
var Button = require('absolute/Button');
var Reactive = require('absolute/Reactive');
var Background = require('absolute/Background');
var Space = require('absolute/Space');
var AnimatedPageSwitch = require('absolute/AnimatedPageSwitch');

var Value = require('ksf/observable/Value');


function displayMenu (args) {
	var menuItemId = args.menuItemId
	var message = args.message
	var request = args.request
	message.value('loading...');
	request({
		"method": "model.ir.ui.menu.search",
		"params": [
			[["parent", "=", menuItemId]],
			0,
			1000,
			null,
		],
	}).then(function(res) {
		var menuContainer = new VPile();
		var menuPage = new Margin(new VScroll(menuContainer), 10);
		args.container.content(menuPage, 'left');
		if (menuItemId) {
			menuContainer.add('back', new Margin(new Button().value('<').onAction(function() {
				args.container.content(args.previous, 'right');
			}), 10).height(args.defaultButtonSize+20));
		}
		res.forEach(function(childMenuItemId) {
			var menuItemLabel = new Value(childMenuItemId + '');
			var menuItem = new HFlex([
				[new Button().width(args.defaultButtonSize).value('+').onAction(function() {
					displayMenu(create(args, {
						menuItemId: childMenuItemId,
						previous: menuPage,
					}));
				}), 'fixed'],
				new VFlex([
					new Reactive({
						value: menuItemLabel,
						content: new Button().color('transparent').value(childMenuItemId+'').onAction(function() {
							message.value("looking for list view...");
							args.saver.ensureChangesAreSaved().then(function () {
								return request({
									"method": "model.ir.action.keyword.get_keyword",
									"params": [
										"tree_open",
										["ir.ui.menu", childMenuItemId],
									],
								}).then(function(res) {
									if (res.length) {
										message.value('');
										var views = res[0].views;
										var viewId;
										var formViewId;
										for (var i=0; i<views.length; i++) {
											var view = views[i];
											if (view[1] === 'tree') {
												viewId = view[0];
											}
											if (view[1] === 'form') {
												formViewId = view[0];
											}
										}
										var modelId = res[0]["res_model"];
										args.onDisplayModel(modelId, viewId, formViewId);
									} else {
										message.value('no list view');
									}
									message.value("error");
								}, function(err) {
									console.log("erreur lors de la recherche d'une vue de type liste pour le menu", childMenuItemId, err);
								})
							}, function () {
								// il y a eu une erreur lors de l'enregistrement des données, on ne change pas de page
							})
						}),
					}),
					[new Background(new Space()).height(1).color('#eee'), 'fixed'],
				]),
			]).height(args.defaultButtonSize);
			menuContainer.add(childMenuItemId+'', menuItem);
			request({
				"method":"model.ir.ui.menu.read",
				"params":[
					[childMenuItemId],
					["childs", "name", "parent", "favorite", "active", "icon", "parent.rec_name", "rec_name", "_timestamp"],
				],
			}).then(function(res) {
				menuItemLabel.value(res[0].name);
			}, function() {
				console.log("error retreiving label for", childMenuItemId);
			});
		});
		message.value('done');
	}, function(err) {
		message.value("erreur");
		console.log("erreur", err);
	}).done();
}


/**
@params args {
	request
	message
	onDisplayModel
	saver
}
*/
module.exports = compose(_ContentDelegate, function(args) {
	this._content = new AnimatedPageSwitch();

	displayMenu(create(args, {
		container: this._content,
	}))
});
