var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var Label = require('absolute/Label');

var ol = require('openlayers');
// var ol = require('openlayers/dist/ol-debug');
var VFlex = require('absolute/VFlex');
var Element = require('absolute/Element');

var rest = require('rest');

var proj4 = window.proj4 = require('proj4');
proj4.defs("EPSG:2154","+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

var Map = compose(_ContentDelegate, function(args) {
	this._content = new Element();

	var wfsFormat = new ol.format.GML2({
			featureNS: { tryton: 'http://www.tryton.org/' },
			featureType: 'tryton:' + args.modelId
	});

	var wfsSource = new ol.source.Vector({
		loader: function(extent, resolution, projection) {
			var url = 'http://admin:admin@cg94.bioecoforests.teclib.net:8001/tryton1//model/wfs/wfs/wfs?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=tryton:' + args.modelId + '&SRSNAME=EPSG:2154&bbox=' + ol.proj.transformExtent(extent, 'EPSG:3857', 'EPSG:2154').join(',') + '';
			rest(url).then(function(response) {
					var features = wfsFormat.readFeatures(response.raw.responseXML, {
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
			new ol.layer.Vector({
				source: wfsSource,
				style: new ol.style.Style({
			    stroke: new ol.style.Stroke({
			      color: 'rgba(0, 0, 255, 1.0)',
			      width: 2
			    })
			  })
			})
	  ],
	  target: this._content.domNode
	});
}, {
	_updateSize: function() {
		var w = this._content.width(),
			h = this._content.height();
		if (w & h) {
			this.olMap.setSize([w, h]);
		}
	},
	height: function(h) {
		if (arguments.length) {
			this._content.height(h);
			this._updateSize();
		} else {
			return this._content.height();
		}
	},
	width: function(w) {
		if (arguments.length) {
			this._content.width(w);
			this._updateSize();
		} else {
			return this._content.width();
		}
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
	this._content = new VFlex([
		[new Label().value('map of '+ args.modelId).height(20), 'fixed'],
		this._map = new Map(args)
	]);
});
