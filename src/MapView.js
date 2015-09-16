/* global MBTilesPlugin, LocalFileSystem, cordova*/

var compose = require('ksf/utils/compose');
var _Destroyable = require('ksf/base/_Destroyable');
var Value = require('ksf/observable/Value')
var bindValue = require('ksf/observable/bindValue')
var bindValueDestroyable = require('ksf/observable/bindValueDestroyable')
var _ContentDelegate = require('absolute/_ContentDelegate');
var on = require('ksf/utils/on');
var Element = require('absolute/Element');
var Reactive = require('absolute/Reactive')

import ol from './openlayers'
var VPile = require('absolute/VPile');
var ZPile = require('absolute/ZPile');
var Align = require('absolute/Align');

var when = require('when');

import IconButton from './IconButton'
import * as icons from './icons/index'

var toggleValue = function (val) {
	val.value(!val.value())
}

var getCenter = function (position) {
	return position ? ol.proj.transform([position.coords.longitude, position.coords.latitude], 'EPSG:4326', 'EPSG:3857') : [0,0]

}

var geomTypeMapping = {
	multipolygon: 'Polygon',
	multilinestring: 'LineString',
	multipoint: 'Point',
};

import MapBase from './MapBase'

var fill = new ol.style.Fill({
	color: 'rgba(255,255,255,0.4)',
});
var mainColor = '#3399CC';
var stroke = new ol.style.Stroke({
	color: mainColor,
	width: 2,
});
var baseStyle = [
	new ol.style.Style({
		image: new ol.style.Circle({
			fill: fill,
			stroke: stroke,
			radius: 8,
		}),
		fill: fill,
		stroke: stroke,
	}),
	// transparent buffer to make selecting easier
	new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: [255, 255, 255, 0.01],
			width: 30,
		}),
	}),
];
var editingStyle = new ol.style.Style({
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
})

var editingSelectedPartStyle = new ol.style.Style({
	image: new ol.style.Circle({
		stroke: new ol.style.Stroke({
			color: 'rgba(255, 0, 0, 1.0)',
			width: 4,
		}),
		radius: 5,
	}),
	stroke: new ol.style.Stroke({
		color: 'rgba(255, 0, 0, 1.0)',
		width: 4,
	}),
	fill: new ol.style.Fill({
		color: 'rgba(255, 0, 0, 0.3)',
	}),
})



module.exports = compose(_ContentDelegate, _Destroyable, function(args) {
	this._args = args;
	var followPosition = this._followPosition = new Value(true)

	this._content = new ZPile().content([
		this._map = new MapBase({
			extent: args.mapExtent.value(),
		}),
		new Align(new VPile().content([
			new Reactive({
				value: followPosition,
				content: new IconButton().icon(icons.gpsLock).title("Suivre ma position").onAction(toggleValue.bind(null, followPosition)),
				prop: 'disabled',
			}).height(args.defaultButtonSize),
			this._centerBtn = new IconButton().icon(icons.zoomGeom).title("Centrer sur la géométrie").onAction(this._centerActive.bind(this)).height(args.defaultButtonSize).visible(false),
			this._editBtn = new IconButton().icon(icons.edit).title("Editer la géométrie").onAction(this._toggleEdit.bind(this)).height(args.defaultButtonSize).visible(false),
			this._addPartBtn = new IconButton().icon(icons.addPart).title("Ajouter une partie").onAction(this._addGeomPart.bind(this)).height(args.defaultButtonSize).visible(false),
			this._removePartBtn = new IconButton().icon(icons.removePart).title("Supprimer une partie").onAction(this._removeGeomPart.bind(this)).height(args.defaultButtonSize).visible(false),
			this._saveBtn = new IconButton().icon(icons.save).title("Enregistrer la géométrie").onAction(this._saveGeom.bind(this)).height(args.defaultButtonSize).visible(false),
			this._clickCenterBtn = new IconButton().icon(icons.addPoint).title("Créer point au centre").onAction(() => this._clickCenter()).height(args.defaultButtonSize).visible(false),
		]).width(args.defaultButtonSize), 'left', 'top'),
		this._centerCross = new Align(new Element().prop('textContent', '+').style({
			lineHeight: '20px',
			textAlign: 'center',
			pointerEvents: 'none',
		}).width(20).height(20), 'middle', 'middle'),
	]);

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
			args.wfsRequest({
				method: 'getFeature',
				params: {
					type: args.modelId,
					bbox: extent,
					filter: args.query,
				},
			}).then(function(features3857) {
				wfsSource.addFeatures(features3857);
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
			mbTilesPlugin.init({type: 'db', typepath: 'cdvfile', url: cordova.file.externalRootDirectory }, function() {
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
			style: baseStyle,
		}),
		this._editingLayer = new ol.layer.Vector({
			source: this._editingSource = new ol.source.Vector(),
			style: editingStyle,
		}),
		new ol.layer.Vector({
			source: this._locationSource = new ol.source.Vector(),
			// style: [
			// 	new ol.style.Style({
			// 		stroke: new ol.style.Stroke({
			// 			color: 'rgba(255, 255, 0, 0.5)',
			// 			width: 2,
			// 		}),
			// 		fill: new ol.style.Fill({
			// 			color: 'rgba(255,255,255,0.4)',
			// 		}),
			// 	}),
			// ],
		}),
	]);

	this._positionCenterFeature = new ol.Feature(this._positionCenterGeom = new ol.geom.Point([0,0]))
	this._positionAccuracyFeature = new ol.Feature(this._positionAccuracyGeom = new ol.geom.Circle([0,0],0))
	this._own(bindValue(args.position, (newPosition) => {
		if (newPosition) {
			if (this._locationSource.getFeatures().length === 0) {
				this._locationSource.addFeatures([this._positionCenterFeature, this._positionAccuracyFeature])
			}
			var center = getCenter(newPosition)
			var radius = newPosition.coords.accuracy
			this._positionCenterGeom.setCoordinates(center)
			this._positionAccuracyGeom.setCenterAndRadius(center, radius)
		} else {
			this._locationSource.clear()
		}
	}))

	this._own(bindValueDestroyable(followPosition, (followPositionValue) => {
		if (followPositionValue) {
			this.olMap.once('pointerdrag', followPosition.value.bind(followPosition, false))
			return bindValue(args.position, (newPosition) => {
				if (newPosition) {
					this.olMap.getView().setCenter(getCenter(newPosition))
				}
			}, this)
		}
	}, this))

	this.olMap.addInteraction(this._itemSelectTool = new ol.interaction.Select({
		layers: [this._mainLayer],
		condition: ol.events.condition.click,
	}));
	this._itemSelectTool.on('select', function(e) {
		var selection = e.target.getFeatures();
		var itemToActivate
		if (selection.getLength()) {
			itemToActivate = parseInt(selection.item(0).get('id'))
		} else {
			itemToActivate = null
		}
		if (itemToActivate !== args.activeItem.value()) {
			args.saver.ensureChangesAreSaved().then(() => {
				args.activeItem.value(itemToActivate)
				itemToActivate && args.onSelect()
			})
		}
	});

	this.olMap.on('moveend', () => {
		// update mapExtent value
		args.mapExtent.value(this.olMap.getView().calculateExtent(this.olMap.getSize()))
	})

	this._own(args.activeItem.onChange(this._setActiveId.bind(this)));
	this._wfsSource.on('addfeature', this._refreshActiveHighlighting.bind(this));

	this._own(on(args.saver, 'save', () => {
		if (args.changes.modelId === args.modelId && args.changes.geom) {
			return this._saveGeom()
		}
	}))
	this._own(on(args.saver, 'cancel', this._disableEditMode.bind(this)))
}, {
	_setActiveId: function(id) {
		if (id) {
			this._editBtn.visible(true);
			this._centerBtn.visible(true);
			if (id === 'new') {
				this._editBtn.disabled(true);
				this._centerBtn.disabled(true);
			} else {
				this._editBtn.disabled(false);
				this._centerBtn.disabled(false);
			}
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
	_centerActive: function() {
		this._getActiveGeom().then(function(geom) {
			this._followPosition.value(false)
			this.olMap.getView().fit(geom, this.olMap.getSize());
		}.bind(this));
	},
	_enableEditMode: function() {
		this._args.changes.geom = true
		this._itemSelectTool.getFeatures().clear();
		this.olMap.removeInteraction(this._itemSelectTool);

		this._getActiveGeom().then((geom) => {
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
				style: editingSelectedPartStyle,
			}));
			var selection = this._partSelectTool.getFeatures()
			selection.on('change:length', () => {
				this._removePartBtn.disabled(!selection.getLength())
			})
			this.olMap.addInteraction(this._partModifyTool = new ol.interaction.Modify({
				features: selection,
			}));


			this._partDrawTool = new ol.interaction.Draw({
				source: this._editingSource,
				type: this._geomType,
			});
			this._partDrawTool.on('drawstart', () => {
				this._drawing = true;
			});
			this._partDrawTool.on('drawend', () => this._stopDrawing());

			this._addPartBtn.visible(true);
			this._removePartBtn.visible(true).disabled(true);
			this._saveBtn.visible(true);

			this._editMode = true;
			this._editBtn.icon(icons.cancel).title("Annuler l'édition");
		});
	},
	_stopDrawing: function() {
		this._drawing = false;
		this.olMap.removeInteraction(this._partDrawTool);
		this._clickCenterBtn.visible(false)
	},
	_disableEditMode: function() {
		this.olMap.removeInteraction(this._partSelectTool);
		this.olMap.removeInteraction(this._partModifyTool);
		this._stopDrawing()

		this.olMap.addInteraction(this._itemSelectTool);
		this._editingSource.clear();
		this._refreshActiveHighlighting();


		this._addPartBtn.visible(false);
		this._removePartBtn.visible(false);
		this._saveBtn.visible(false);

		this._editMode = false;
		this._args.changes.geom = false
		this._editBtn.icon(icons.edit).title("Editer la géométrie");
	},
	_getActiveFeature: function() {
		return this._wfsSource.getFeatureById(this._args.modelId + '.' + this._args.activeItem.value());
	},
	_getActiveGeom: function() {
		var activeFeature = this._getActiveFeature();
		var self = this;
		if (activeFeature) {
			// if feature is loaded on map, use its geometry directly
			return when(activeFeature.getGeometry())
		} else {
			// otherwise, make a request to get the geom
			return self._args.request({ method: "model." + self._args.modelId + ".read", params: [
				[self._args.activeItem.value()],
				['geom'],
			]}).then(function(res) {
				var geojson = res[0].geom;
				var geom = null;
				if (geojson) {
					geom = new ol.format.GeoJSON().readGeometry(geojson).transform('EPSG:2154', 'EPSG:3857');
				}
				return geom
			});
		}
	},
	_toggleEdit: function() {
		if (this._editMode) {
			this._disableEditMode();
		} else if (this._args.activeItem.value()) {
			this._enableEditMode();
		}
	},
	_addGeomPart: function() {
		this.olMap.addInteraction(this._partDrawTool)
		this._clickCenterBtn.visible(true)
	},
	_removeGeomPart: function() {
		this._editingSource.removeFeature(this._partSelectTool.getFeatures().item(0));
		this._partSelectTool.getFeatures().clear();
	},
	_saveGeom: function() {
		if (this._drawing) {
			this._partDrawTool.finishDrawing()
		}

		var geomParts = this._editingSource.getFeatures(),
		geom = null;

		if (geomParts.length) {
			geom  = new ol.geom['Multi' + this._geomType](geomParts.map(function(f) {
				return f.getGeometry().getCoordinates();
			}));
		}

		var id = this._args.activeItem.value();

		this._args.wfsRequest({
			method: 'transaction',
			params: {
				type: this._args.modelId,
				itemId: id,
				geom: geom,
			},
		}).then(function() {
			// success
			var activeFeature = this._getActiveFeature();
			if (activeFeature) {
				this._wfsSource.removeFeature(activeFeature);
			}
			if (geom) {
				var f = new ol.Feature(geom);
				f.set('id', id);
				f.setId(this._args.modelId + '.' + id);
				this._wfsSource.addFeature(f);
			}
			this._disableEditMode();
		}.bind(this), () => {
			// error
			this._args.message.value("erreur !");
		});
		this._args.message.value("en cours ...");
	},
	_clickCenter: function() {
		// simulate
		var bcr = this.parentNode().getBoundingClientRect()
		var eventParams = {
			clientX: bcr.left + this.left() + this.width() / 2,
			clientY: bcr.top + this.top() + this.height() / 2,
			bubbles: true,
		}
		var viewport = this._map.olMap.getViewport()
		!viewport.dispatchEvent(new MouseEvent('mousedown', eventParams))
		!viewport.dispatchEvent(new MouseEvent('mouseup', eventParams))
	},
});
