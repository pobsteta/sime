var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var Label = require('absolute/Label');

var ol = require('openlayers');
var VFlex = require('absolute/VFlex');
var Element = require('absolute/Element');

var Map = compose(_ContentDelegate, function() {
	this._content = new Element;
	this.olMap = new ol.Map({
	  view: new ol.View({
	    center: [0, 0],
	    zoom: 1
	  }),
	  layers: [
	    new ol.layer.Tile({
	      source: new ol.source.MapQuest({layer: 'osm'})
	    })
	  ],
	  target: this._content.domNode
	});
}, {
	height: function(h) {
		if (arguments.length) {
			this._content.height(h);
			this.olMap.updateSize();
		} else {
			return this._content.height();
		}
	},
	width: function(w) {
		if (arguments.length) {
			this._content.width(w);
			this.olMap.updateSize();
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
		this._map = new Map()
	]);
});
