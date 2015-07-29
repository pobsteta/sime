var create = require('lodash/object/create');
var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var HFlex = require('absolute/HFlex');
var Switch = require('absolute/Switch');

var getQgsFile = require('./utils/getQgsFile');

var PanelContainer = require('./PanelContainer');

/**
 * Composant spécialisé qui place une vue en fullScreen et ajoute une carte si c'est un modèle avec un fichier qgis
*/
module.exports = compose(_ContentDelegate, function(args, PaneConstructor, MapConstructor) {
	var qgsFile = getQgsFile(args.request, args.modelId);

	var paneView =  new PaneConstructor(args);

	var container = this._content = new Switch();

	qgsFile.then(function(fileContent){
		if (fileContent) {
			container.content(new PanelContainer({
				main: new MapConstructor(create(args, {
					qgsFile: fileContent,
				})),
				panel: paneView,
				panelOptions: {
					position: 'right'
				}
			}));
		} else {
			container.content(paneView);
		}
	});
});
