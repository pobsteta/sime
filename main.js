var when = require('when');
var find = require('lodash/collection/find');

var DeepStore = require('ksf/observable/deep/Store2');
var Leaf = require('ksf/observable/deep/Leaf2');

var FullScreen = require('absolute/FullScreen');
var VFlex = require('absolute/VFlex');
var HFlex = require('absolute/HFlex');
var VPile = require('absolute/VPile');
var Label = require('absolute/Label');
var Editor = require('absolute/Editor');
var LabelInput = require('absolute/LabelInput');
var Button = require('absolute/Button');
var Switch = require('absolute/Switch');
var Clickable = require('absolute/Clickable');
var Background = require('absolute/Background');
var Space = require('absolute/Space');

var Reactive = require('absolute/Reactive');

var Value = require('ksf/observable/Value');

// json rpc client
var rest = require('rest/browser');
var mime = require('rest/interceptor/mime');
var errorCode = require('rest/interceptor/errorCode');
var request = rest.wrap(mime, { mime: 'application/json-rpc'}).wrap(errorCode, { code: 400 });

var registry = require('rest/mime/registry');
registry.register('application/json-rpc', {
    read: function(str) {
        return JSON.parse(str);
    },
    write: function(obj) {
    	return JSON.stringify(obj);
    }
});
var interceptor = require('rest/interceptor');
var rpcInterceptor = interceptor({
    request: function (request, config, meta) {
        request.params.unshift(config.token);
        request.params.unshift(config.session);
        request.params.push(config.user);
        return {entity: request};
    },
    response: function (response, config, meta) {
        return response.entity.result;
    },
});
var defaultRequest = require('rest/interceptor/defaultRequest');


function displayMenu (menuItemId, container, message, request, previous) {
	message.value('loading...');
	request({
		"method":"model.ir.ui.menu.search",
		"params":[
			[["parent","=",menuItemId]],
			0,
			1000,
			null,
		]
	}).then(function(res) {
		var menuContainer = new VPile();
		container.content(menuContainer);
		if (menuItemId !== null) {
			menuContainer.add('back', new Button().value('<-').height(60).onAction(function() {
				container.content(previous);
			}));
		}
		res.forEach(function(childMenuItemId) {
			var menuItemLabel = new Value(childMenuItemId+'');
			var menuItem = new HFlex([
				[new Button().width(30).value('+').onAction(function() {
					displayMenu(childMenuItemId, container, message, request, menuContainer);
				}), 'fixed'],
				new VFlex([
					new Reactive({
						value: menuItemLabel,
						content: new Button().color('transparent').value(childMenuItemId+'').onAction(function() {
							message.value("looking for list view...");
							request({
								"method":"model.ir.action.keyword.get_keyword",
								"params":[
									"tree_open",
									["ir.ui.menu", childMenuItemId]
								]
							}).then(function(res) {
								if (res.length) {
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
									displayList(viewId, modelId, formViewId, container, message, request, menuContainer);
								} else {
									message.value('no list view');
								}
							}, function(err) {
								message.value("error");
								console.log("erreur lors de la recherche d'une vue de type liste pour le menu", childMenuItemId, err);
							}).done();
						})
					}),
					[new Background(new Space()).height(1).color('#eee'), 'fixed']
				]),
			]).height(60);
			menuContainer.add(childMenuItemId+'', menuItem);
			request({
				"method":"model.ir.ui.menu.read",
				"params":[
					[childMenuItemId],
					["childs", "name", "parent", "favorite", "active", "icon", "parent.rec_name", "rec_name", "_timestamp"],
				]
			}).then(function(res) {
				menuItemLabel.value(res[0].name);
			}, function(err) {
				console.log("error retreiving label for", childMenuItemId);
			});
		});
		message.value('done');
	}, function(err) {
		message.value("erreur");
		console.log("erreur", err);
	}).done();
}

function displayList (viewId, modelId, formViewId, container, message, request, previous) {
	message.value('loading...');
	when.all([request({
		"method":"model."+modelId+".fields_view_get",
		"params":[viewId, "tree"],
	}), request({
		"method":"model."+modelId+".search",
		"params":[[], 0, 1000, null],
	})]).then(function(res) {
		var fieldsRes = res[0];
		var itemIds = res[1];
		var fieldIds = Object.keys(fieldsRes.fields);
		var list = new VPile();
		container.content(list);
		list.add('back', new Button().value('<-').height(60).onAction(function() {
			container.content(previous);
		}));
		return request({
			"method":"model."+modelId+".read",
			"params":[itemIds, fieldIds],
		}).then(function(dataRes) {
			itemIds.forEach(function(itemId) {
				var item = find(dataRes, {id: itemId});
				var itemView = new Clickable(new Background(new VPile().content(fieldIds.map(function(fieldId) {
					return new HFlex([
						[new Label().value(fieldsRes.fields[fieldId].string).width(150), 'fixed'],
						new Label().value(JSON.stringify(item[fieldId])),
					]).height(30);
				}))).color('lightgrey').border('1px solid')).onAction(function() {
					displayForm(formViewId, modelId, itemId, container, message, request, list);
				}).height(fieldIds.length*30);
				list.add(itemId, itemView);
			});
			message.value('loaded');
		}, function(err) {
			message.value("erreur");
			console.log("erreur", err);
		});
	}).done();
}

function displayForm (viewId, modelId, itemId, container, message, request, previous) {
	message.value('loading...');
	request({
		"method":"model."+modelId+".fields_view_get",
		"params":[viewId, "form"],
	}).then(function(res) {
		var fieldIds = Object.keys(res.fields);
		var form = new VPile();
		container.content(form);
		form.add('back', new Button().value('<-').height(60).onAction(function() {
			container.content(previous);
		}));
		return request({
			"method":"model."+modelId+".read",
			"params":[[itemId], fieldIds],
		}).then(function(dataRes) {
			fieldIds.forEach(function(fieldId) {
				var propDisplayer = new HFlex([
					[new Label().value(res.fields[fieldId].string).width(150), 'fixed'],
					new Label().value(JSON.stringify(dataRes[0][fieldId])),
				]).height(30);
				form.add(fieldId, propDisplayer);
			});
			form.height(fieldIds.length*30);
			message.value('loaded');
		}, function(err) {
			message.value("erreur");
			console.log("erreur", err);
		});
	}).done();
}

var pageContainer = new Switch();
var message = new Label();
new FullScreen(new VFlex([
	[message.height(20), 'fixed'],
	pageContainer,
]));

request = request.wrap(defaultRequest, {
	path: 'http://cg94.bioecoforests.teclib.net:8000/tryton1',
	method: 'POST',
});
request({ entity: {
	"method":"common.db.login",
	"params":[
		"admin",
		"admin"
	]
}}).entity().then(function(res) {
	request = request.wrap(rpcInterceptor, {
		token: res.result[1],
		session: res.result[0],
		user: {"employee":null,"groups":[5,10,13,14,11,8,9],"language":"en_US","locale":{"date":"%m/%d/%Y","thousands_sep":",","decimal_point":".","grouping":[3,3,0]},"language_direction":"ltr","company":1,"company.rec_name":"Michael Scott Paper Company"},		
	});
	displayMenu(null, pageContainer, message, request);

}, function(err) {
	message.value('login error');
	console.log('login error', err);
});

