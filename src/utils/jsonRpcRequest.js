var rest = require('rest/browser');
var mime = require('rest/interceptor/mime');
var errorCode = require('rest/interceptor/errorCode');
var defaultInterceptor = require('rest/interceptor/defaultRequest');

var registry = require('rest/mime/registry');
registry.register('application/json-rpc', require('rest/mime/type/application/json'));


export default rest
	.wrap(mime, { mime: 'application/json-rpc'})
	.wrap(errorCode, { code: 400 })
	.wrap(defaultInterceptor, {method: 'POST'});
