var create = require('lodash/object/create');
var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var _Destroyable = require('ksf/base/_Destroyable');
var HFlex = require('absolute/HFlex');
var Switch = require('absolute/Switch');

var getQgsFile = require('./utils/getQgsFile');

/**
 * Composant spécialisé qui place une vue en fullScreen et ajoute une carte si c'est un modèle avec un fichier qgis
*/
module.exports = compose(_ContentDelegate, _Destroyable, function(args, PaneConstructor, MapConstructor) {
	var qgsFile = getQgsFile(args.request, args.modelId);

	var paneView = this._own(new PaneConstructor(args));

	var container = this._content = new Switch().content(paneView);

	qgsFile.then(function(fileContent){
		if (fileContent) {
			container.content(new HFlex([
				this._own(new MapConstructor(create(args, {
					qgsFile: fileContent,
				}))),
				paneView,
			]));
		}
	});
});
