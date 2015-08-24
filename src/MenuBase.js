var create = require('lodash/object/create')
var sortBy = require('lodash/collection/sortBy')
var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var VFlex = require('absolute/VFlex');
var HFlex = require('absolute/HFlex');
var VPile = require('absolute/VPile');
var VScroll = require('absolute/VScroll');
var Margin = require('absolute/Margin');
var Button = require('absolute/Button');
var Label = require('absolute/Label');
var Background = require('absolute/Background');
var Space = require('absolute/Space');
var AnimatedPageSwitch = require('absolute/AnimatedPageSwitch');

var getMenuChildren = require('./utils/getMenuChildren')

function displayMenu (args) {
	var menuItemId = args.menuItemId
	var message = args.message
	var request = args.request
	message.value('loading...')

	var menuChildrenContainer = new VPile()
	var menuPage = new Margin(new VFlex([
		[new Margin(new HFlex([
			[new Button().value('<').disabled(!args.previous).onAction(function() {
				args.container.content(args.previous, 'right')
			}).width(args.defaultButtonSize), 'fixed'],
			new Label().value(args.menuItemCompleteName),
		]), 10).height(args.defaultButtonSize+20), 'fixed'],
		new VScroll(menuChildrenContainer),
	]), 10)
	args.container.content(menuPage, 'left');

	getMenuChildren(request, menuItemId).then(function(childMenuItems) {
		menuChildrenContainer.content(sortBy(childMenuItems, 'sequence').map(function(childMenuItem) {
			var childMenuItemId = childMenuItem.id
			var drillDown = function() {
				displayMenu(create(args, {
					menuItemId: childMenuItemId,
					menuItemCompleteName: childMenuItem['complete_name'],
					previous: menuPage,
				}));
			}
			return new HFlex([
				[new Button().width(args.defaultButtonSize).value('+').disabled(childMenuItem.childs.length === 0).onAction(drillDown), 'fixed'],
				new VFlex([
					new Button().color('transparent').value(childMenuItem.name).onAction(function() {
						args.onItemSelect(childMenuItemId)
						// auto drill down when there is no action
						if (!childMenuItem.action) {
							drillDown()
						}
					}),
					[new Background(new Space()).height(1).color('#eee'), 'fixed'],
				]),
			]).height(args.defaultButtonSize);
		}))
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
		menuItemCompleteName: '',
	}))
});
