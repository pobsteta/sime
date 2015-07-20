var when = require('when');
var compose = require('ksf/utils/compose');
var bindValueDestroyable = require('ksf/observable/bindValueDestroyable');
// var PersistableValue = require('ksf/observable/PersistableValue');
var Value = require('ksf/observable/Value');

var _ContentDelegate = require('absolute/_ContentDelegate');
var Align = require('absolute/Align');
var Background = require('absolute/Background');
var VPile = require('absolute/VPile');
var ZPile = require('absolute/ZPile');
var Switch = require('absolute/Switch');
var Label = require('absolute/Label');
var LabelInput = require('absolute/LabelInput');
var Button = require('absolute/Button');

var App = require('./ConnectionView');

function PersistableValue (name, initValue) {
	if (initValue === undefined) {
		initValue = null;
	}
	var storedValue = JSON.parse(localStorage.getItem(name));
	var value = new Value(storedValue === null ? initValue : storedValue);
	value.onChange(function(newValue) {
		if (newValue !== null && newValue !== undefined) {
			localStorage.setItem(name, JSON.stringify(newValue));
		} else {
			localStorage.removeItem(name);
		}
	});
	return value;
}

// json rpc client
var rest = require('rest/browser');
var mime = require('rest/interceptor/mime');
var errorCode = require('rest/interceptor/errorCode');
var interceptor = require('rest/interceptor');
var defaultInterceptor = require('rest/interceptor/defaultRequest');

var registry = require('rest/mime/registry');
registry.register('application/json-rpc', {
    read: function(str) {
        return JSON.parse(str);
    },
    write: function(obj) {
    	return JSON.stringify(obj);
    }
});
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
var trytonAuthenticatedInterceptor = interceptor({
    request: function (request, config) {
    	var sessionToken = config.session.value();
    	if (sessionToken) {
    		return forgeRequest(request, config);
    	} else {
    		return when.promise(function(resolve) {
    			var cancel = config.session.onChange(function() {
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

var jsonRpcRequest = rest
	.wrap(mime, { mime: 'application/json-rpc'})
	.wrap(errorCode, { code: 400 })
	.wrap(defaultInterceptor, {method: 'POST'});

var trytonLogin = function(connectionValue, session, password) {
	return jsonRpcRequest({
		path: connectionValue.url,
		entity: {
			"method":"common.db.login",
			"params":[
				connectionValue.userName,
				password
			]
		}
	}).entity().then(function(loginRes) {
		if (loginRes.result && loginRes.result !== false) {
			session.value(loginRes.result[1]);
			return loginRes;
		} else {
			return when.reject(loginRes);
		}
	});
};

module.exports = compose(_ContentDelegate, function() {
	var appContainer, popupContainer;
	this._content = new ZPile().content([
		appContainer = new Switch().depth(1000),
		popupContainer = new Switch().depth(10),
	]);

	var connectionParams = new PersistableValue('connectionParams', {
		url: 'http://cg94.bioecoforests.teclib.net:8000/tryton1',
		username: 'admin',
	});

	var connection = this._connection = new PersistableValue('connection'); // null or {userId, userPref}
	bindValueDestroyable(this._connection, function(connectionValue) {
		var session = new PersistableValue('session'); // null or sessionToken
		if (connectionValue) {
			var authenticatedTrytonRequest = jsonRpcRequest
				.wrap(defaultInterceptor, {path: connectionValue.url})
				.wrap(trytonAuthenticatedInterceptor, {
					userId: connectionValue.userId,
					session: session,
					preferences: connectionValue.userPref,
				});

			var app = new App({
				request: authenticatedTrytonRequest,
				logout: function() {
					connection.value(null);
					session.value(null);
				},
			});
			appContainer.content(app);
			return [
				app,
				bindValueDestroyable(session, function(sessionToken) {
					if (!sessionToken) {
						var password;
						var authenticationMessage = new Label();
						popupContainer.content(new Background(
							new Align(new VPile().width(200).content([
								password = new LabelInput().placeholder("password").height(30),
								new Button().value("OK").height(30).onAction(function() {
									authenticationMessage.value('authenticating...');
									trytonLogin(connectionValue, session, password.value()).then(function() {
										authenticationMessage.value('authenticated');
										popupContainer.content(null);
									}, function() {
										authenticationMessage.value('authentication error');
									});
								}),
								authenticationMessage.height(30),
							]), 'middle', 'middle')
						).color('lightgrey').opacity(0.8));
					}
				}),
			];
		} else {
			var connectionParamsValue = connectionParams.value();
			var url, username, password, message;
			appContainer.content(new Align(new VPile().content([
				url = new LabelInput().placeholder('url').height(30).value(connectionParamsValue.url),
				username = new LabelInput().placeholder('username').height(30).value(connectionParamsValue.username),
				password = new LabelInput().placeholder('password').height(30),
				new Button().value('Login').height(30).onAction(function() {
					message.value('login...');
					trytonLogin({
						url: url.value(),
						userName: username.value(),
					}, session, password.value()).then(function(loginRes) {
						var userId = loginRes.result[0];
						var token = loginRes.result[1];

						message.value('login success');
						// store new default params
						connectionParams.value({
							url: url.value(),
							username: username.value(),
						});
						return jsonRpcRequest({
							path: url.value(),
							entity: {
								"method": "model.res.user.get_preferences",
								"params": [userId, token, true, {}],
							}
						}).entity().then(function(prefRes) {
							// store current connection values
							connection.value({
								url: url.value(),
								userId: userId,
								userPref: prefRes.result,
								userName: username.value(),
							});
						});						
					}, function() {
						message.value('login error');
					});
				}),
				message = new Label().height(30)
			]).width(400), 'middle', 'middle'));
		}
	});
});
