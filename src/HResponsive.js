var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var Switch = require('absolute/Switch');

module.exports = compose(_ContentDelegate, function(args) {
  this._args = args;
  this._content = new Switch();
}, {
  _layout: function() {
    if (this._mode === 'large') {
      this._content.content(this._layouter = this._args.large);
    } else {
      this._content.content(this._layouter = this._args.narrow);
    }
  },

  width: function(width) {
    if (arguments.length) {
      this._width = width;
      var mode;
      if (width > this._args.widthBreakpoint) {
        mode = 'large';
      } else {
        mode = 'narrow';
      }
			this._content.width(width);
      if (mode !== this._mode) {
        this._mode = mode;
        this._layout();
      }
      return this;
    } else {
      return this._width;
    }
  },

  layouter: function() {
    return this._layouter;
  }
});
