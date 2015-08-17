module.exports = function getFieldIdsToRequest (fields) {
	// request rec_name for many2one fields
	var fieldIdsToRequest = [];
	for (var fieldKey in fields) {
		var field = fields[fieldKey]
		fieldIdsToRequest.push(field.name);
		if (field.type === 'many2one' || field.ttype === 'many2one') { // dans les déf de vue, c'est 'type' et dans les defs de model c'est 'ttype'
			fieldIdsToRequest.push(field.name+'.rec_name');
		}
	}
	return fieldIdsToRequest;
};
