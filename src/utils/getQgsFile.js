var find = require('lodash/collection/find');
var endsWith = require('lodash/string/endsWith');

function isGeoModel (request, modelId) {
	return request({method: 'model.ir.model.search', params: [
		[['model', '=', modelId]],
		0,
		1,
		null,
	]}).then(function(res){
		var modelDbId = res[0];
		return request({method: 'model.ir.attachment.search_read', params: [
			[['resource', '=', 'ir.model,'+modelDbId]],
			0,
			100,
			null,
			['id', 'name'],
		]})
	}).then(function(attachments){
		var found = find(attachments, function(attachment) {
			return endsWith(attachment.name, '.qgs')
		});
		return found ? found.id : null
	})
}

function getQgsFile(request, modelId) {
	return isGeoModel(request, modelId).then(function(attachmentId){
		return request({
			method: 'model.ir.attachment.read',
			params: [
				[attachmentId],
				['data'],
			],
		})
	}).then(function(res){
		return window.atob(res[0].data.base64)
	}).catch(function(){
		return null;
	});
}

module.exports = getQgsFile;
