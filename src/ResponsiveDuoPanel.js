var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var ZPile = require('absolute/ZPile');
var Switch = require('absolute/Switch');

var DuoPanelLarge = require('./DuoPanelLarge');

module.exports = compose(_ContentDelegate, function(args) {
  this._args = args;
	this._panel = args.panel;
  this._main = args.main;
  this._panelOptions = {
    maxWidth: args.panelOptions && args.panelOptions.maxWidth || 400,
    position: args.panelOptions && args.panelOptions.position || 'left',
  };
  this._content = new Switch();
}, {
  _layout: function() {
    if (this._mode === 'large') {
      this._layoutLarge();
    } else {
      this._layoutNarrow();
    }
  },
  _layoutLarge: function() {
    this._content.content(this._layouter = new DuoPanelLarge(this._args));
  },
  _layoutNarrow: function() {
    this._content.content(new ZPile().content([
			this._main,
			this._panel,
		]))
      .width(this._width)
      .left(this._left);
		// TODO: faire ça mieux
		this._panel.left(this._main.left() - this._slideDistance);
  },

  width: function(width) {
    if (arguments.length) {
      this._width = width;
      if (width > this._panelOptions.maxWidth) {
        this._mode = 'large';
      } else {
        this._mode = 'narrow';
      }
			this._content.width(width);
      this._layout();
      return this;
    } else {
      return this._width;
    }
  },

  closed: function(closed) {
    if (arguments.length) {
      this._layouter.closed(closed);
    } else {
      return this._layouter.closed();
    }
  }
});
