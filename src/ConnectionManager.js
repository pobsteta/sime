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

var levelup = require('levelup')
var leveljs = require('level-js')
var levelPromise = require('level-promise')

var OnlineManager = require('./OnlineManager');

import ol from './openlayers'
var proj4 = window.proj4 = require('proj4');
proj4.defs("EPSG:2154", "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");


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

// intercepteur pour une session utilisateur
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
      var newRequestArg = {
        path: config.prefix,
        modelId: request.params.type,
      }

      if (request.method === 'getFeature') {
        newRequestArg.path += 'REQUEST=GetFeature&TYPENAME=tryton:' + request.params.type + '&SRSNAME=EPSG:2154&bbox=' + ol.proj.transformExtent(request.params.bbox, 'EPSG:3857', 'EPSG:2154').join(',') + ''
        if (request.params.filter) {
          newRequestArg.path += '&FILTER=%3Cogc%3AFilter%3E%3Cogc%3AOr%3E%3Cogc%3APropertyIsEqualTo%3E%3Cogc%3APropertyName%3E'+ request.params.filter[0] + '%3C%2Fogc%3APropertyName%3E%3Cogc%3ALiteral%3E' + request.params.filter[2] + '%3C%2Fogc%3ALiteral%3E%3C%2Fogc%3APropertyIsEqualTo%3E%3C%2Fogc%3AOr%3E%3C%2Fogc%3AFilter%3E';
        }
      }
      if (request.method === 'transaction') {
        newRequestArg.method = 'post'
        // build a feature with only the 'geom' attribute
        var updatedFeature = new ol.Feature({
          geom: request.params.geom && request.params.geom.clone().transform('EPSG:3857', 'EPSG:2154'),
        });
        var fid = request.params.type + '.' + request.params.itemId;
        updatedFeature.setId(fid);

        newRequestArg.entity = new ol.format.WFS().writeTransaction(null, [updatedFeature], null, {
          featureNS: 'http://www.tryton.org/',
          featureType: request.params.type,
          featurePrefix: 'tryton',
          gmlOptions: { srsName: 'EPSG:2154' },
        });
      }

      var pwd = config.passwordR.value();
      if (pwd) {
        newRequestArg.password = pwd;
        return newRequestArg;
      } else {
        return when.promise(function(resolve) {
          var cancel = config.passwordR.onChange(function(pwdValue) {
            cancel();
            newRequestArg.password = pwdValue;
            resolve(newRequestArg);
          });
        });
      }
    },
		success: function (response) {
			if (response.entity.firstChild.nodeName === "ServiceExceptionReport") {
				return when.reject(response);
			}

      if (response.request.method === 'GET') {
        var gml2Format = new ol.format.GML2({
          featureNS: { tryton: 'http://www.tryton.org/' },
          featureType: 'tryton:' + response.request.modelId,
        });
        return gml2Format.readFeatures(response.entity, {
          dataProjection: 'EPSG:2154',
          featureProjection: 'EPSG:3857',
        })
      } else {
        return response
      }
    },
});




module.exports = compose(_ContentDelegate, function(args) {
  var connectionParams = new PersistableValue('connectionParams', {
    host: 'http://cg94.bioecoforests.teclib.net:8000',
    dbName: 'tryton1',
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
        localDb: levelPromise(levelup('tryton', {
          db: leveljs,
          valueEncoding: 'json',
        })),
			}));
			appContainer.content(app);
			return app
		} else {
			var connectionParamsValue = connectionParams.value();
			var host, dbName, username, passwordInput, message;
			appContainer.content(new Align(new VPile().content([
				host = new LabelInput().placeholder('host').height(30).value(connectionParamsValue.host),
        dbName = new LabelInput().placeholder('database').height(30).value(connectionParamsValue.dbName),
				username = new LabelInput().placeholder('username').height(30).value(connectionParamsValue.username),
				passwordInput = new LabelInput().placeholder('password').height(30),
				new Button().value('Login').height(30).onAction(function() {
					message.value('login...');
					var pwd = passwordInput.value(),
            url = host.value() + '/' + dbName.value()
					trytonLogin({
						url: url,
						userName: username.value(),
					}, session, pwd).then(function(loginRes) {
						var userId = loginRes.result[0];
						var token = loginRes.result[1];

						message.value('login success');
						// store new default params
						connectionParams.value({
							host: host.value(),
              dbName: dbName.value(),
							username: username.value(),
						});

						passwordValue.value(pwd);

						return jsonRpcRequest({
							path: url,
							entity: {
								"method": "model.res.user.get_preferences",
								"params": [userId, token, true, {}],
							},
						}).entity().then(function(prefRes) {
							// store current connection values
							connection.value({
								url: url,
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
			]).width(300), 'middle', 'middle'));
		}
	});
});
