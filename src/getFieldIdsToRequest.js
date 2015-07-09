module.exports = function getFieldIdsToRequest (fields) {
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
};
