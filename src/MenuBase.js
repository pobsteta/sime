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

var getMenuChildren = require('./utils/getMenuChildren')

function displayMenu (args) {
	var menuItemId = args.menuItemId
	var message = args.message
	var request = args.request
	message.value('loading...');
	getMenuChildren(request, menuItemId).then(function(res) {
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
							args.onItemSelect(childMenuItemId)
						}),
					}),
					[new Background(new Space()).height(1).color('#eee'), 'fixed'],
				]),
			]).height(args.defaultButtonSize);
			menuContainer.add(childMenuItemId+'', menuItem);

			request({
				"method": "model.ir.ui.menu.read",
				"params": [
					[childMenuItemId],
					["childs", "name", "parent", "favorite", "active", "icon", "parent.rec_name", "rec_name", "_timestamp"],
				],
			}).then(function(resp) {
				menuItemLabel.value(resp[0].name);
			}, function() {
				console.log("error retreiving label for", childMenuItemId);
			});

		});
		message.value('done');
	}, function(err) {
		message.value("erreur");
		console.log("erreur", err);
	})
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
