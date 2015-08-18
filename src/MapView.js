var compose = require('ksf/utils/compose');
var _Destroyable = require('ksf/base/_Destroyable');
var _ContentDelegate = require('absolute/_ContentDelegate');
var on = require('ksf/utils/on');
var Button = require('absolute/Button');

var ol = require('openlayers');
// var ol = require('openlayers/dist/ol-debug');
var HPile = require('absolute/HPile');
var ZPile = require('absolute/ZPile');
var Align = require('absolute/Align');

var when = require('when');

var proj4 = window.proj4 = require('proj4');
proj4.defs("EPSG:2154", "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

var geomTypeMapping = {
	multipolygon: 'Polygon',
	multilinestring: 'LineString',
	multipoint: 'Point',
};

import MapBase from './MapBase'

var Map = compose(_ContentDelegate, _Destroyable, function(args) {
	this._args = args;
	this._content = new ZPile().content([
		this._map = new MapBase(),
		new Align(new HPile().content([
			this._centerBtn = new Button().value("Centrer sur la géométrie").onAction(this._centerActive.bind(this)).width(100).visible(false),
			this._editBtn = new Button().value("Editer la géométrie").onAction(this._toggleEdit.bind(this)).width(100).visible(false),
			this._addPartBtn = new Button().value("Ajouter une partie").onAction(this._addGeomPart.bind(this)).width(100).visible(false),
			this._removePartBtn = new Button().value("Supprimer une partie").onAction(this._removeGeomPart.bind(this)).width(100).visible(false),
			this._saveBtn = new Button().value("Enregistrer la géométrie").onAction(this._saveGeom.bind(this)).width(100).visible(false),
		]).height(args.defaultButtonSize), 'left', 'top'),
	]);

	var gml2Format = new ol.format.GML2({
		featureNS: { tryton: 'http://www.tryton.org/' },
		featureType: 'tryton:' + args.modelId,
	});

	// get geometry type
	args.request({ method: "model.ir.model.field.search_read", params: [
		[["model.model", "=", args.modelId], ["name", "=", "geom"]],
		0,
		1,
		null,
		["ttype"],
	]}).then(function(res) {
		this._geomType = geomTypeMapping[res[0].ttype];
	}.bind(this));

	var wfsSource = this._wfsSource = new ol.source.Vector({
		loader: function(extent) {
			var url = 'REQUEST=GetFeature&TYPENAME=tryton:' + args.modelId + '&SRSNAME=EPSG:2154&bbox=' + ol.proj.transformExtent(extent, 'EPSG:3857', 'EPSG:2154').join(',') + '';
			if (args.query) {
				url += '&FILTER=%3Cogc%3AFilter%3E%3Cogc%3AOr%3E%3Cogc%3APropertyIsEqualTo%3E%3Cogc%3APropertyName%3E'+args.query[0]+'%3C%2Fogc%3APropertyName%3E%3Cogc%3ALiteral%3E'+args.query[2]+'%3C%2Fogc%3ALiteral%3E%3C%2Fogc%3APropertyIsEqualTo%3E%3C%2Fogc%3AOr%3E%3C%2Fogc%3AFilter%3E';
			}
			args.wfsRequest(url).then(function(response) {
				var features = gml2Format.readFeatures(response.entity, {
					dataProjection: 'EPSG:2154',
					featureProjection: 'EPSG:3857',
				});
				wfsSource.addFeatures(features);
			});
		},
		strategy: ol.loadingstrategy.tile(ol.tilegrid.createXYZ({
			maxZoom: 19,
		})),
	});

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

	this.olMap = this._map.olMap;
	this.olMap.getLayers().extend([
		this._mainLayer = new ol.layer.Vector({
			source: wfsSource,
			// style: new ol.style.Style({
			//   stroke: new ol.style.Stroke({
			//     color: 'rgba(0, 0, 255, 1.0)',
			//     width: 2
			//   })
			// })
		}),
		this._editingLayer = new ol.layer.Vector({
			source: this._editingSource = new ol.source.Vector(),
			style: [
				new ol.style.Style({
					image: new ol.style.Circle({
						stroke: new ol.style.Stroke({
							color: 'rgba(250, 170, 0, 1.0)',
							width: 4,
						}),
						radius: 5,
					}),
					stroke: new ol.style.Stroke({
						color: 'rgba(250, 170, 0, 1.0)',
						width: 4,
					}),
					fill: new ol.style.Fill({
						color: 'rgba(255, 255, 0, 0.3)',
					}),
				}),
				// new ol.style.Style({
				//   image: new ol.style.Circle({
				//     radius: 2,
				//     fill: new ol.style.Fill({
				//       color: 'white'
				//     })
				//   }),
				//   geometry: function(feature) {
				//     // return the coordinates of the first ring of the polygon
				//     var coordinates = feature.getGeometry().getCoordinates()[0];
				//     return new ol.geom.MultiPoint(coordinates);
				//   }
				// })
			],
		}),
	]);

	this.olMap.addInteraction(this._itemSelectTool = new ol.interaction.Select({
		layers: [this._mainLayer],
		condition: ol.events.condition.click,
	}));
	this._itemSelectTool.on('select', function(e) {
		var selection = e.target.getFeatures();
		if (selection.getLength()) {
			args.activeItem.value(parseInt(selection.item(0).get('id')));
			args.onSelect()
		} else {
			args.activeItem.value(null);
		}
	}.bind(this));

	this._own(args.activeItem.onChange(this._setActiveId.bind(this)));
	this._wfsSource.on('addfeature', this._refreshActiveHighlighting.bind(this));

	this._own(on(args.saver, 'save', this._saveGeom.bind(this)))
	this._own(on(args.saver, 'cancel', this._disableEditMode.bind(this)))
}, {
	_setActiveId: function(id) {
		if (id) {
			this._editBtn.visible(true);
			this._centerBtn.visible(true);
		} else {
			this._editBtn.visible(false);
			this._centerBtn.visible(false);
		}
		if (this._editMode) {
			this._disableEditMode();
		}
		this._refreshActiveHighlighting();
	},
	_refreshActiveHighlighting: function() {
		var activeId = this._args.activeItem.value();
		var highlightedFeatures = this._itemSelectTool.getFeatures();
		highlightedFeatures.clear();
		if (activeId) {
			var f = this._wfsSource.getFeatureById(this._args.modelId + '.' + activeId);
			if (f) {
				highlightedFeatures.push(f);
			}
		}
	},
	_enableEditMode: function() {
		this._args.changes.geom = true
		this._itemSelectTool.getFeatures().clear();
		this.olMap.removeInteraction(this._itemSelectTool);

		this._getActiveGeom().then(this._editGeometry.bind(this));
	},
	_centerActive: function() {
		this._getActiveGeom().then(function(geom) {
			this.olMap.getView().fit(geom, this.olMap.getSize());
		}.bind(this));
	},
	_editGeometry: function(geom) {
		if (geom) {
			this.olMap.getView().fit(geom, this.olMap.getSize());
			var editingParts;
			if (this._geomType === 'Polygon') {
				editingParts = geom.getPolygons().map(function(geomPart) {
					// converts coordinates from XYZ to only XY
					// since it causes an error when merging with drawn geometries
					// cf. https://github.com/openlayers/ol3/issues/2700
					return new ol.Feature(new ol.geom.Polygon(geomPart.getCoordinates().map(function(linearRing) {
						return linearRing.map(function(coords) {
							return coords.slice(0,2);
						});
					})));
				});
			} else if (this._geomType === 'LineString') {
				editingParts = geom.getLineStrings().map(function(geomPart) {
					// converts coordinates from XYZ to only XY
					return new ol.Feature(new ol.geom.LineString(geomPart.getCoordinates().map(function(coords) {
						return coords.slice(0,2);
					})));
				});
			} else if (this._geomType === 'Point') {
				editingParts = geom.getPoints().map(function(geomPart) {
					// converts coordinates from XYZ to only XY
					return new ol.Feature(new ol.geom.Point(geomPart.getCoordinates().slice(0,2)));
				});
			}

			this._editingSource.addFeatures(editingParts);
		}

		this.olMap.addInteraction(this._partSelectTool = new ol.interaction.Select({
			layers: [this._editingLayer],
		}));

		this._partDrawTool = new ol.interaction.Draw({
			source: this._editingSource,
			type: this._geomType,
		});
		this._partDrawTool.on('drawend', function() {
			this.olMap.removeInteraction(this._partDrawTool);
		}.bind(this));

		this._addPartBtn.visible(true);
		this._removePartBtn.visible(true);
		this._saveBtn.visible(true);

		this._editMode = true;
		this._editBtn.value("Annuler l'édition");
	},
	_disableEditMode: function() {
		this.olMap.removeInteraction(this._partSelectTool);
		this.olMap.addInteraction(this._itemSelectTool);
		this._editingSource.clear();
		this._refreshActiveHighlighting();

		this._addPartBtn.visible(false);
		this._removePartBtn.visible(false);
		this._saveBtn.visible(false);
		this._saveBtn.value("Enregistrer");

		this._editMode = false;
		this._args.changes.geom = false
		this._editBtn.value("Editer la géométrie");
	},
	_getActiveFeature: function() {
		return this._wfsSource.getFeatureById(this._args.modelId + '.' + this._args.activeItem.value());
	},
	_getActiveGeom: function() {
		var activeFeature = this._getActiveFeature();
		var self = this;
		return when.promise(function(resolve) {
			if (activeFeature) {
				// if feature is loaded on map, use its geometry directly
				resolve(activeFeature.getGeometry());
			} else {
				// otherwise, make a request to get the geom
				self._args.request({ method: "model." + self._args.modelId + ".read", params: [
					[self._args.activeItem.value()],
					['geom'],
				]}).then(function(res) {
					var geojson = res[0].geom;
					var geom = null;
					if (geojson) {
						geom = new ol.format.GeoJSON().readGeometry(geojson).transform('EPSG:2154', 'EPSG:3857');
					}
					resolve(geom);
				});
			}
		});
	},
	_toggleEdit: function() {
		if (this._editMode) {
			this._disableEditMode();
		} else if (this._args.activeItem.value()) {
			this._enableEditMode();
		}
	},
	_addGeomPart: function() {
		this.olMap.addInteraction(this._partDrawTool);
	},
	_removeGeomPart: function() {
		this._editingSource.removeFeature(this._partSelectTool.getFeatures().item(0));
		this._partSelectTool.getFeatures().clear();
	},
	_saveGeom: function() {
		this._partDrawTool.finishDrawing()

		var geomParts = this._editingSource.getFeatures(),
		geom = null;

		if (geomParts.length) {
			geom  = new ol.geom['Multi' + this._geomType](geomParts.map(function(f) {
				return f.getGeometry().getCoordinates();
			}));
		}

		var updatedFeature = new ol.Feature({
			geom: geom && geom.clone().transform('EPSG:3857', 'EPSG:2154'),
		});

		var id = this._args.activeItem.value();
		var fid = this._args.modelId + '.' + id;
		updatedFeature.setId(fid);

		var updateRequest = new ol.format.WFS().writeTransaction(null, [updatedFeature], null, {
			featureNS: 'http://www.tryton.org/',
			featureType: this._args.modelId,
			featurePrefix: 'tryton',
			gmlOptions: { srsName: 'EPSG:2154' },
		});

		this._args.wfsRequest({
			path: 'REQUEST=Transaction',
			method: 'post',
			entity: updateRequest,
		}).then(function() {
			// success
			var activeFeature = this._getActiveFeature();
			if (activeFeature) {
				this._wfsSource.removeFeature(activeFeature);
			}
			var f = new ol.Feature(geom);
			f.set('id', id);
			f.setId(fid);
			this._wfsSource.addFeature(f);
			this._disableEditMode();
		}.bind(this), function() {
			// error
			this._saveBtn.value("erreur !");
		}.bind(this));
		this._saveBtn.value("en cours ...");
	}
});

/**
@params args {
modelId
query
request
}
*/
module.exports = compose(_ContentDelegate, function(args) {
	this._args = args;
	this._content = new Map(args);
});
