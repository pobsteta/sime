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
var IconButton = require('./IconButton');
var Label = require('absolute/Label');
var Background = require('absolute/Background');
var Space = require('absolute/Space');
var AnimatedPageSwitch = require('absolute/AnimatedPageSwitch');

var getMenuChildren = require('./utils/getMenuChildren')

import * as icons from './icons/index'
import getIconSvg from './utils/getIconSvg'

function displayMenu (args) {
	var menuItemId = args.menuItemId
	var message = args.message
	var request = args.request
	message.value('loading...')

	var menuChildrenContainer = new VPile()
	var menuPage = new VFlex([
		[new HFlex([
			[new Space().width(args.defaultButtonSize), 'fixed'],
			[new IconButton().icon(icons.up).title('Retour').disabled(!args.previous).onAction(function() {
				args.container.content(args.previous, 'right')
			}).width(args.defaultButtonSize), 'fixed'],
			new Label().value(args.menuItemCompleteName),
		]).height(args.defaultButtonSize), 'fixed'],
		new Margin(new VScroll(menuChildrenContainer), 10),
	])
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
			var clickAction = function() {
				args.onItemSelect(childMenuItemId)
				// auto drill down when there is no action
				if (!childMenuItem.action) {
					drillDown()
				}
			}

			var itemIcon = new IconButton().onAction(clickAction)
			getIconSvg(request, childMenuItem['icon']).then(svg => {
				itemIcon.icon('data:image/svg+xml;utf8,' + svg)
			})
			return new HFlex([
				[new IconButton().icon(icons.next).width(args.defaultButtonSize).title('Déplier').disabled(childMenuItem.childs.length === 0).onAction(drillDown), 'fixed'],
				[itemIcon.width(args.defaultButtonSize), 'fixed'],
				new VFlex([
					new Button().color('transparent').value(childMenuItem.name).onAction(clickAction),
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
