var compose = require('ksf/utils/compose');
var _Destroyable = require('ksf/base/_Destroyable');
var _ContentDelegate = require('absolute/_ContentDelegate');
var Button = require('absolute/Button');

var ol = require('openlayers');
// var ol = require('openlayers/dist/ol-debug');
var HPile = require('absolute/HPile');
var ZPile = require('absolute/ZPile');
var Elmt = require('absolute/Element');

var rest = require('rest');

var proj4 = window.proj4 = require('proj4');
proj4.defs("EPSG:2154","+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

var geomTypeMapping = {
	multipolygon: 'Polygon',
	multilinestring: 'LineString',
	multipoint: 'Point'
};

var Map = compose(_ContentDelegate, _Destroyable, function(args) {
	this._args = args;
	this._content = new ZPile().content([
		this._mapEl = new Elmt(),
		new HPile().content([
			this._editBtn = new Button().value("Editer la géométrie").onAction(this._editGeom.bind(this)).width(100).visible(false),
			this._addPartBtn = new Button().value("Ajouter une partie").onAction(this._addPartGeom.bind(this)).width(100).visible(false),
			this._removePartBtn = new Button().value("Supprimer une partie").onAction(this._removePartGeom.bind(this)).width(100).visible(false),
			this._saveBtn = new Button().value("Enregistrer").onAction(this._validateGeom.bind(this)).width(100).visible(false),
		])
	]);

	var gml2Format = new ol.format.GML2({
			featureNS: { tryton: 'http://www.tryton.org/' },
			featureType: 'tryton:' + args.modelId
	});

	args.request({ method: "model.ir.model.field.search_read", params:[
		[["model.model", "=", args.modelId], ["name", "=", "geom"]],
		0,
		1,
		null,
		["ttype"],
	]}).then(function(res) {
		this._geomType = geomTypeMapping[res[0].ttype];
	}.bind(this));

	var wfsSource = this._wfsSource = new ol.source.Vector({
		loader: function(extent, resolution, projection) {
			var url = 'REQUEST=GetFeature&TYPENAME=tryton:' + args.modelId + '&SRSNAME=EPSG:2154&bbox=' + ol.proj.transformExtent(extent, 'EPSG:3857', 'EPSG:2154').join(',') + '';
			if (args.query) {
				url += '&FILTER=%3Cogc%3AFilter%3E%3Cogc%3AOr%3E%3Cogc%3APropertyIsEqualTo%3E%3Cogc%3APropertyName%3E'+args.query[0]+'%3C%2Fogc%3APropertyName%3E%3Cogc%3ALiteral%3E'+args.query[2]+'%3C%2Fogc%3ALiteral%3E%3C%2Fogc%3APropertyIsEqualTo%3E%3C%2Fogc%3AOr%3E%3C%2Fogc%3AFilter%3E';
			}
			args.wfsRequest(url).then(function(response) {
					var features = gml2Format.readFeatures(response.entity, {
						dataProjection: 'EPSG:2154',
						featureProjection: 'EPSG:3857'
					});
					wfsSource.addFeatures(features);
			});
		},
		strategy: ol.loadingstrategy.tile(ol.tilegrid.createXYZ({
			maxZoom: 19
		})),
	});

	this.olMap = new ol.Map({
	  view: new ol.View({
	    center: ol.proj.transform([660493.0,6857760.7], 'EPSG:2154', 'EPSG:3857'),
	    zoom: 15
	  }),
	  layers: [
	    new ol.layer.Tile({
	      source: new ol.source.MapQuest({layer: 'osm'})
	    }),
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
								width: 4
							}),
			       	radius: 5
			     	}),
				    stroke: new ol.style.Stroke({
				      color: 'rgba(250, 170, 0, 1.0)',
				      width: 4
				    }),
						fill: new ol.style.Fill({
				      color: 'rgba(255, 255, 0, 0.3)',
				    })
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
				]
			})
	  ],
	  target: this._mapEl.domNode
	});

	var selectCtrl;
	this.olMap.addInteraction(selectCtrl = this._selectCtrl = new ol.interaction.Select({
		layers: [this._mainLayer],
	  condition: ol.events.condition.click
	}));
	selectCtrl.on('select', function(e) {
    var selection = e.target.getFeatures();
		if (selection.getLength()) {
			args.activeItem.value(parseInt(selection.item(0).get('id')));
			this._editBtn.visible(true);
		} else {
			args.activeItem.value(null);
			this._editBtn.visible(false);
		}
	}.bind(this));
	this._own(args.activeItem.onChange(function(id) {
		var selectedFeatures = selectCtrl.getFeatures();
		selectedFeatures.clear();
		var f = wfsSource.getFeatureById(args.modelId + '.' + id);
		if (f) {
			selectedFeatures.push(f);
			this._editBtn.visible(true);
		} else {
			this._editBtn.visible(false);
		}
	}.bind(this)));
}, {
	_editMode: function(enable) {
		if (enable) {
			this._selectCtrl.getFeatures().clear();
			this.olMap.removeInteraction(this._selectCtrl);

			var activeGeom = this._getActiveFeature().getGeometry(),
				editingParts;
			if (this._geomType === 'Polygon') {
				editingParts = activeGeom.getPolygons().map(function(geomPart) {
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
				editingParts = activeGeom.getLineStrings().map(function(geomPart) {
					// converts coordinates from XYZ to only XY
					return new ol.Feature(new ol.geom.LineString(geomPart.getCoordinates().map(function(coords) {
							return coords.slice(0,2);
					})));
				});
			} else if (this._geomType === 'Point') {
				editingParts = activeGeom.getPoints().map(function(geomPart) {
					// converts coordinates from XYZ to only XY
					return new ol.Feature(new ol.geom.Point(geomPart.getCoordinates().slice(0,2)));
				});
			}

			this._editingSource.addFeatures(editingParts);

			this.olMap.addInteraction(this._partSelectTool = new ol.interaction.Select({
				layers: [this._editingLayer],
			}));

			this._partDrawTool = new ol.interaction.Draw({
				source: this._editingSource,
				type: this._geomType
			});
			this._partDrawTool.on('drawend', function() {
				this.olMap.removeInteraction(this._partDrawTool);
			}.bind(this));

			this._addPartBtn.visible(true);
			this._removePartBtn.visible(true);
			this._saveBtn.visible(true);
		} else {
			this.olMap.addInteraction(this._selectCtrl);
			this._editingSource.clear();

			this._addPartBtn.visible(false);
			this._removePartBtn.visible(false);
			this._saveBtn.visible(false);
			this._saveBtn.value("Enregistrer");
		}
	},
	_getActiveFeature: function() {
		return this._wfsSource.getFeatureById(this._args.modelId + '.' + this._args.activeItem.value());
	},
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
	_editGeom: function() {
		if (this._args.activeItem.value()) {
			this._editMode(true);
		}
	},
	_enableEditingTool: function(tool) {
		this.olMap.addInteraction(this._editingTool = tool);
	},
	_disableCurrentEditingTool: function() {
		if (this._editingTool) {
			this._editingTool.setActive(false);
			this.olMap.removeInteraction(this._editingTool);
		}
	},
	_addPartGeom: function() {
		this.olMap.addInteraction(this._partDrawTool);
	},
	_removePartGeom: function() {
		this._editingSource.removeFeature(this._partSelectTool.getFeatures().item(0));
		this._partSelectTool.getFeatures().clear();
	},
	_validateGeom: function() {
		var geomParts = this._editingSource.getFeatures(),
			geom = new ol.geom['Multi' + this._geomType](geomParts.map(function(f) {
				return f.getGeometry().getCoordinates();
			}));

		var updatedFeature = new ol.Feature({
			geom: geom.clone().transform('EPSG:3857', 'EPSG:2154')
		});
		var id = this._args.activeItem.value();
		var fid = this._args.modelId + '.' + id;
		updatedFeature.setId(fid);

		var updateRequest = new ol.format.WFS().writeTransaction(null, [updatedFeature], null, {
			featureNS: 'http://www.tryton.org/',
			featureType: this._args.modelId,
			featurePrefix: 'tryton',
			gmlOptions: { srsName: 'EPSG:2154' }
		});

		this._args.wfsRequest({
			path: 'REQUEST=Transaction',
			method: 'post',
			entity: updateRequest,
		}).then(function(response) {
			if (response.status.code === 200) {
				this._wfsSource.removeFeature(this._getActiveFeature());
				var f = new ol.Feature(geom);
				f.set('id', id);
				f.setId(fid);
				this._wfsSource.addFeature(f);
			}
			this._editMode(false);
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
