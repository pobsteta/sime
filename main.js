var when = require('when');
var find = require('lodash/collection/find');


var DeepStore = require('ksf/observable/deep/Store2');
var Leaf = require('ksf/observable/deep/Leaf2');

var FullScreen = require('absolute/FullScreen');
var VFlex = require('absolute/VFlex');
var HFlex = require('absolute/HFlex');
var VPile = require('absolute/VPile');
var HPile = require('absolute/HPile');
var ZPile = require('absolute/ZPile');
var Label = require('absolute/Label');
var Editor = require('absolute/Editor');
var LabelInput = require('absolute/LabelInput');
var Button = require('absolute/Button');
var Switch = require('absolute/Switch');
var Clickable = require('absolute/Clickable');
var Background = require('absolute/Background');
var Space = require('absolute/Space');
var Align = require('absolute/Align');

var Reactive = require('absolute/Reactive');

var Value = require('ksf/observable/Value');
var bindValue = require('ksf/observable/bindValue');
var MappedValue = require('ksf/observable/MappedValue');


function createPersistableValue (name, initValue) {
	var value = new Value(JSON.parse(localStorage.getItem(name)));
	value.onChange(function(newValue) {
		localStorage.setItem(name, JSON.stringify(newValue));
	});
	return value;
}

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
// intercepteur pour une session utilis
function forgeRequest(request, config) {
	request.params = request.params || [];
	request.params.unshift(config.session.value());
	request.params.unshift(config.userId);
	request.params.push(config.preferences);
	return {entity: request};    		
}
function  unforgeRequest (request) {
	return {
		method: request.method,
		params: request.params.slice(2, request.params.length-1),
	};
}
var rpcInterceptor = interceptor({
    request: function (request, config, meta) {
    	var sessionToken = config.session.value();
    	if (sessionToken) {
    		return forgeRequest(request, config);
    	} else {
    		return when.promise(function(resolve) {
    			var cancel = config.session.onChange(function(sessionToken) {
    				cancel();
    				resolve(forgeRequest(request, config));
    			});
    		});
    	}
    },
    success: function (response, config, meta) {
    	if (response.entity.error) {
    		if (response.entity.error[0] === 'NotLogged') {
    			// ne pas remettre à null si la session a déjà été renouvelée
    			if (config.session.value() === meta.arguments[0].params[1]) {
    				config.session.value(null);
    			}
    			return meta.client(unforgeRequest(meta.arguments[0]));
    		}
    		return when.reject(response.entity.error);
    	}
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

function getFieldIdsToRequest (fields) {
	// request rec_name for many2one fields
	var fieldIdsToRequest = [];
	for (var fieldKey in fields) {
		fieldIdsToRequest.push(fieldKey);
		var fieldType = fields[fieldKey].type;
		if (fieldType === 'many2one') {
			fieldIdsToRequest.push(fieldKey+'.rec_name');
		}
	}
	return fieldIdsToRequest;
}

function displayList (viewId, modelId, formViewId, container, message, request, previous) {
	message.value('loading...');
	when.all([request({
		"method":"model."+modelId+".fields_view_get",
		"params":[viewId, "tree"],
	}), request({
		"method":"model."+modelId+".search",
		"params":[[], 0, 10, null],
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
			"params":[itemIds, getFieldIdsToRequest(fieldsRes.fields)],
		}).then(function(dataRes) {
			itemIds.forEach(function(itemId) {
				var item = find(dataRes, {id: itemId});
				var itemView = new Clickable(new Background(new VPile().content(fieldIds.map(function(fieldId) {
					return new HFlex([
						[new Label().value(fieldsRes.fields[fieldId].string).width(150), 'fixed'],
						displayFieldValue(item, fieldsRes.fields[fieldId]),
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

var displayFieldFactories = {
	boolean: function(item, field) {
		return new Label().value(item[field.name] ? 'oui' : 'non'); // TODO: remplacer par le bon widget		
	},
	integer: function(item, field) {
		return new Label().value(item[field.name]+'');	
	},
	biginteger: function(item, field) {
		return new Label().value(item[field.name]+'');	
	},
	char: function(item, field) {
		return new Label().value(item[field.name]);	
	},
	text: function(item, field) {
		return new Label().value(item[field.name]);	
	},
	float: function(item, field) {
		return new Label().value(item[field.name]+'');	
	},
	numeric: function(item, field) {
		return new Label().value(item[field.name]+'');	
	},
	date: function(item, field) {
		return new Label().value(item[field.name]);	
	},
	datetime: function(item, field) {
		return new Label().value(item[field.name]);	
	},
	time: function(item, field) {
		return new Label().value(item[field.name]);	
	},
	// selection
	// reference
	many2one: function(item, field) {
		return new Label().value(item[field.name+'.rec_name']);	
	},
	one2many: function(item, field) {
		return new Label().value('( ' + item[field.name].length + ' )');	
	},
	many2many: function(item, field) {
		return new Label().value('( ' + item[field.name].length + ' )');	
	},
	// function
	// property
};
function displayFieldValue (item, field) {
	if (field.type in displayFieldFactories) {
		return displayFieldFactories[field.type](item, field);
	}
	return new Label().value(JSON.stringify(item[field.name]));
}

function displayForm (viewId, modelId, itemId, container, message, request, previous) {
	message.value('loading...');
	request({
		"method":"model."+modelId+".fields_view_get",
		"params":[viewId, "form"],
	}).then(function(res) {
		var changes = {};
		var fieldIds = Object.keys(res.fields);
		var form = new VPile();
		container.content(form);
		form.add('back', new Button().value('<-').height(60).onAction(function() {
			container.content(previous);
		}));
		form.add('save', new Button().value('Enregistrer').height(60).onAction(function() {
			message.value('enregistrement...');
			request({
				method: "model."+modelId+".write",
				params: [[itemId], changes],
			}).then(function() {
				message.value("Enregistré");
			}, function(err) {
				message.value("Erreur lors de l'enregistrement");
				console.log("Erreur lors de l'enregistrement", err);
			});
		}));
		return request({
			"method":"model."+modelId+".read",
			"params":[[itemId], getFieldIdsToRequest(res.fields)],
		}).then(function(dataRes) {
			fieldIds.forEach(function(fieldId) {
				var propDisplayer = new HFlex([
					[new Label().value(res.fields[fieldId].string).width(150), 'fixed'],
					editFieldValue(dataRes[0], res.fields[fieldId], changes, container, message, request, form),
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

var editFieldFactories = {
	boolean: function(item, field) {
		return new Label().value(item[field.name] ? 'oui' : 'non'); // TODO: remplacer par le bon widget		
	},
	integer: function(item, field) {
		return new Label().value(item[field.name]+'');	
	},
	biginteger: function(item, field) {
		return new Label().value(item[field.name]+'');	
	},
	char: function(item, field, changes) {
		return new LabelInput().value(item[field.name]).onInput(function(newValue) {
			changes[field.name] = newValue;
		});	
	},
	text: function(item, field) {
		return new Label().value(item[field.name]);	
	},
	float: function(item, field) {
		return new Label().value(item[field.name]+'');	
	},
	numeric: function(item, field) {
		return new Label().value(item[field.name]+'');	
	},
	date: function(item, field) {
		return new Label().value(item[field.name]);	
	},
	datetime: function(item, field) {
		return new Label().value(item[field.name]);	
	},
	time: function(item, field) {
		return new Label().value(item[field.name]);	
	},
	many2one: function(item, field, changes, container, message, request, currentPage) {
		return new Button().value(item[field.name+'.rec_name']).onAction(function() {
			container.content(createChoiceList(item[field.name], field, changes, message, request, function (itemId) {
				changes[field.name] = itemId;
				container.content(currentPage);
			}));
		});
	},
	one2many: function(item, field, changes, container, message, request, currentPage) {
		return new Button().value('( ' + item[field.name].length + ' )').onAction(function() {
			// displayList
		});	
	},
	many2many: function(item, field) {
		return new Label().value('( ' + item[field.name].length + ' )');	
	},
	// selection
	// reference
	// function
	// property
};
function editFieldValue (item, field, changes, container, message, request, currentPage) {
	if (field.type in displayFieldFactories) {
		return editFieldFactories[field.type](item, field, changes, container, message, request, currentPage);
	}
	return new Label().value(JSON.stringify(item[field.name]));
}

function createChoiceList (selectedItemId, field, changes, message, request, onInput) {
	message.value('loading...');
	var modelId = field.relation;
	var list = new VPile();
	request({
		"method":"model."+modelId+".search_read",
		"params":[[], 0, 10, null, ['rec_name']],
	}).then(function(items) {
		items.forEach(function(item) {
			var itemId = item.id;
			var itemView = new Clickable(new Background(
				new Label().value(item['rec_name'])
			).color(itemId === selectedItemId ? 'lightblue' : 'lightgrey').border('1px solid')).onAction(function() {
				onInput(itemId);
			}).height(30);
			list.add(itemId, itemView);
		});
		message.value('loaded');
	}, function(err) {
		message.value("erreur");
		console.log("erreur", err);
	});
	return list;
}


var loggedIn = createPersistableValue('loginParams');
var pageContainer = new Switch();
var message = new Label();
var popupContainer = new Switch();
var menuBar = new HPile();
new FullScreen(new ZPile().content([
	new VFlex([
		[new HFlex([
			menuBar,
			[message.width(200), 'fixed'],
		]).height(30), 'fixed'],
		pageContainer,
	]).depth(1000),
	popupContainer,
]));

var sessionObserver;
bindValue(loggedIn, function(loggedInParams) {
	if (loggedInParams) {
		var loggedInRequest = request.wrap(defaultRequest, {
			path: loggedInParams.url,
			method: 'POST',
		});
		var session = createPersistableValue('sessionToken');
		var authenticatedRequest = loggedInRequest.wrap(rpcInterceptor, {
			userId: loggedInParams.userId,
			session: session,
			preferences: loggedInParams.preferences,
		});
		menuBar.add('logout', new Button().value("logout").width(100).onAction(function() {
			authenticatedRequest({
				method: 'common.db.logout',
			}).then(function() {
				loggedIn.value(null);
				session.value(null);
			});
		}));
		displayMenu(null, pageContainer, message, authenticatedRequest);
		sessionObserver = bindValue(session, function(sessionToken) {
			if (sessionToken === null) {
				// popupContainer.content(createAuthenticateForm(function(sessionToken) {
				// 	res.session.value(sessionToken);
				// 	popupContainer.content(null);
				// }));
				var password = window.prompt('password');
				message.value('authenticating...');
				loggedInRequest({ entity: {
					"method":"common.db.login",
					"params":[
						loggedInParams.username,
						password
					]
				}}).entity().then(function(loginRes) {
					if (loginRes.result && loginRes.result !== false) {
						message.value('authenticated');
						session.value(loginRes.result[1]);		
					} else {
						message.value("erreur d'authentification");
					}
				});
			}
		});
	} else {
		if (sessionObserver) {
			sessionObserver();
			sessionObserver = null;
			menuBar.remove('logout');
			message.value('loggedOut');
		}
		var url = 'http://cg94.bioecoforests.teclib.net:8000/tryton1';
		var username;
		var password;
		pageContainer.content(new Align(new VFlex([
			new LabelInput().placeholder('url').value(url).height(30).onInput(function(val) {
				url = val;
			}),
			new LabelInput().placeholder('username').height(30).onInput(function(val) {
				username = val;
			}),
			new LabelInput({type: 'password'}).placeholder('password').height(30).onInput(function(val) {
				password = val;
			}),
			new Button().value("Entrer").onAction(function() {
				request({
					path: url,
					method: 'POST',
					entity: {
						"method":"common.db.login",
						"params":[
							username,
							password
						]
					}
				}).entity().then(function(loginRes) {
					var userId = loginRes.result[0];
					var token = loginRes.result[1];

					return request({
						path: url,
						method: 'POST',
						entity: {
							"method": "model.res.user.get_preferences",
							"params": [userId, token, true, {}],
						}
					}).entity().then(function(preferencesRes) {
						createPersistableValue('sessionToken').value(token);
						loggedIn.value({
							url: url,
							username: username,
							userId: userId,
							preferences: preferencesRes.result,
						});
					});
				}, function(err) {
					message.value('login error');
					console.log('login error', err);
				});

			}),
		]).width(500).height(30*4), 'middle', 'middle'));
	}
});




