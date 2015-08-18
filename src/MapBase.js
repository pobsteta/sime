var compose = require('ksf/utils/compose');
var _Destroyable = require('ksf/base/_Destroyable');
var _ContentDelegate = require('absolute/_ContentDelegate');

var ol = require('openlayers');
// var ol = require('openlayers/dist/ol-debug');
var Elmt = require('absolute/Element');

export default compose(_ContentDelegate, _Destroyable, function(args) {
	this._args = args;
	this._content = this._mapEl = new Elmt();

	var baseLayer = new ol.layer.Tile(),
		mbtilesFileName = 'tryton.mbtiles';
	// load offline base layer if conditions are met
	if (window.cordova && window.cordova.file.externalRootDirectory) {
		// we are in a cordova-supported platform and external storage is mounted
		console.log("cordova & SD card mounted");
		var mbTilesPlugin = new MBTilesPlugin();
		window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function (fileSystem) {
			mbTilesPlugin.init({type: 'db', typepath: 'cdvfile', url: cordova.file.externalRootDirectory }, function(rinit) {
				mbTilesPlugin.getDirectoryWorking(function(result) {
					fileSystem.root.getFile(result.directory_working + mbtilesFileName, null, function () {
						// mbtiles file exists
						console.log("mbtiles file exists");
						mbTilesPlugin.open({name: mbtilesFileName }, function() {
							baseLayer.setSource(new ol.source.TileImage({
								projection: 'EPSG:3857',
								tileGrid: new ol.tilegrid.createXYZ({
									// origin for mbtiles is bottom-left corner of mercator extent
									origin: ol.extent.getBottomLeft(ol.proj.get('EPSG:3857').getExtent()),
								}),
								tileUrlFunction: function() {
									// defer tile loading to tileLoadFunction
									// no real URL is needed at this point, just a truthy value
									return true;
								},
								tileLoadFunction: function(imageTile) {
									var coord = imageTile.getTileCoord();
									console.log("requesting tile: ", coord);
									mbTilesPlugin.getTile({z: coord[0], x: coord[1], y: coord[2]}, function(tileResult) {
										if (tileResult.tile_data) {
											imageTile.getImage().src = "data:image/png;base64," + tileResult.tile_data;
										}
									});
								},
							}));
						});
					}, function() {
						// mbtiles file cannot be found
						console.log("mbtiles file not found: " + result.directory_working + mbtilesFileName);
						// load OSM as fallback
						baseLayer.setSource(new ol.source.MapQuest({layer: 'osm'}));
					});
				});
			});
		});
	} else {
		// load OSM as fallback
		baseLayer.setSource(new ol.source.MapQuest({layer: 'osm'}));
	}

	this.olMap = new ol.Map({
		view: new ol.View({
			center: ol.proj.transform([660493.0, 6857760.7], 'EPSG:2154', 'EPSG:3857'),
			zoom: 15,
		}),
		layers: [
			baseLayer,
		],
		target: this._mapEl.domNode,
	});
}, {
	_updateSize: function() {
		var w = this._mapEl.width(),
			h = this._mapEl.height();
		if (w & h) {
			this.olMap.setSize([w, h]);
		}
	},
	height: function(h) {
		if (arguments.length) {
			this._mapEl.height(h);
			this._updateSize();
		} else {
			return this._mapEl.height();
		}
	},
	width: function(w) {
		if (arguments.length) {
			this._mapEl.width(w);
			this._updateSize();
		} else {
			return this._mapEl.width();
		}
	},
});
