var create = require('lodash/object/create');
var when = require('when');
var compose = require('ksf/utils/compose');
var on = require('ksf/utils/on');
var bindValueDestroyable = require('ksf/observable/bindValueDestroyable');
var PersistableValue = require('ksf/observable/PersistableValue');
var Value = require('ksf/observable/Value');

var _ContentDelegate = require('absolute/_ContentDelegate');
var Align = require('absolute/Align');
var VPile = require('absolute/VPile');
var Switch = require('absolute/Switch');
var Label = require('absolute/Label');
var LabelInput = require('absolute/LabelInput');
var Button = require('absolute/Button');

var OnlineManager = require('./OnlineManager');


// json rpc client
var jsonRpcRequest = require('./utils/jsonRpcRequest')
var rest = require('rest/browser');
var mime = require('rest/interceptor/mime');
var errorCode = require('rest/interceptor/errorCode');
var interceptor = require('rest/interceptor');
var defaultInterceptor = require('rest/interceptor/defaultRequest');
var basicAuth = require('rest/interceptor/basicAuth');

var registry = require('rest/mime/registry');
var xmlSerializer = new XMLSerializer();
registry.register('text/xml', {
    read: function (str, opts) {
        return opts.response.raw.responseXML;
    },
    write: function (obj) {
      return xmlSerializer.serializeToString(obj);
    },
});

var trytonLogin = require('./utils/trytonLogin')

// intercepteur pour une session utilis
function forgeRequest(request, config) {
	request.params = request.params || [];
	request.params.unshift(config.session.value());
	request.params.unshift(config.userId);
	request.params.push(config.preferences);
	return {entity: request};
}
function unforgeRequest (request) {
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
          var cancel = on(config.session, 'change', function() {
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

var wfsInterceptor = interceptor({
    request: function (request, config) {
      request.path = config.prefix + request.path;
      var pwd = config.passwordR.value();
      if (pwd) {
        request.password = pwd;
        return request;
      } else {
        return when.promise(function(resolve) {
          var cancel = config.passwordR.onChange(function(pwdValue) {
            cancel();
            request.password = pwdValue;
            resolve(request);
          });
        });
      }
    },
		success: function (response) {
			if (response.entity.firstChild.nodeName === "ServiceExceptionReport") {
				return when.reject(response);
			}
      return response;
    },
});




module.exports = compose(_ContentDelegate, function(args) {
  var connectionParams = new PersistableValue('connectionParams', {
    url: 'http://cg94.bioecoforests.teclib.net:8000/tryton1',
    username: 'admin',
  })
  var connection = this._connection = new PersistableValue('connection'); // null or {userId, userPref}

  var appContainer = this._content = new Switch()

	var session = new Value(null);
	var passwordValue = new Value(null);
	bindValueDestroyable(this._connection, function(connectionValue) {
		if (connectionValue) {
			var authenticatedRpcRequest = self._rpcRequest = jsonRpcRequest
				.wrap(defaultInterceptor, {path: connectionValue.url})
				.wrap(trytonAuthenticatedInterceptor, {
					userId: connectionValue.userId,
					session: session,
					preferences: connectionValue.userPref,
				});

			var authenticatedWfsRequest = rest
				.wrap(mime, { mime: 'text/xml'})
				.wrap(errorCode)
				.wrap(basicAuth, { username: connectionValue.userName })
				.wrap(wfsInterceptor, {
					prefix: connectionValue.url.replace('8000', '8001') + '/model/wfs/wfs/wfs?SERVICE=WFS&VERSION=1.0.0&',
					passwordR: passwordValue,
				});

			var app = new OnlineManager(create(args, {
        session: session,
        passwordValue: passwordValue,
        connectionValue: connectionValue,
				request: authenticatedRpcRequest,
				wfsRequest: authenticatedWfsRequest,
				logout: function() {
					connection.value(null);
					session.value(null);
				},
			}));
			appContainer.content(app);
			return app
		} else {
			var connectionParamsValue = connectionParams.value();
			var url, username, passwordInput, message;
			appContainer.content(new Align(new VPile().content([
				url = new LabelInput().placeholder('url').height(30).value(connectionParamsValue.url),
				username = new LabelInput().placeholder('username').height(30).value(connectionParamsValue.username),
				passwordInput = new LabelInput().placeholder('password').height(30),
				new Button().value('Login').height(30).onAction(function() {
					message.value('login...');
					var pwd = passwordInput.value();
					trytonLogin({
						url: url.value(),
						userName: username.value(),
					}, session, pwd).then(function(loginRes) {
						var userId = loginRes.result[0];
						var token = loginRes.result[1];

						message.value('login success');
						// store new default params
						connectionParams.value({
							url: url.value(),
							username: username.value(),
						});

						passwordValue.value(pwd);

						return jsonRpcRequest({
							path: url.value(),
							entity: {
								"method": "model.res.user.get_preferences",
								"params": [userId, token, true, {}],
							},
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
				message = new Label().height(30),
			]).width(400), 'middle', 'middle'));
		}
	});
});
