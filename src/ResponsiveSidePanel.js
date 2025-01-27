var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var Switch = require('absolute/Switch');
var assign = require('lodash/object/assign');

var SidePanelLarge = require('./SidePanelLarge');
var SidePanelSmall = require('./SidePanelSmall');

module.exports = compose(_ContentDelegate, function(args) {
  this._args = args;
  this._options = assign({
    widthBreakpoint: 360,
    smallMargin: 30,
    panelMaxWidth: 330,
    panelPosition: 'left',
    panelOpen: false,
  }, args.options);

  this._content = new Switch();
}, {
  _layout: function() {
    var panelOpen = this._options.panelOpen;
    if (this._layouter) {
      panelOpen = this._layouter.isPanelOpen();
    }
    if (this._mode === 'large') {
      this._content.content(this._layouter = new SidePanelLarge({
        main: this._args.main,
        panel: this._args.panel,
        options: {
          panelPosition: this._options.panelPosition,
          panelWidth: this._options.panelMaxWidth,
          panelOpen: panelOpen,
        },
      }));
    } else {
      this._content.content(this._layouter = new SidePanelSmall({
        main: this._args.main,
        panel: this._args.panel,
        options: {
          panelPosition: this._options.panelPosition,
          sideMargin: this._options.smallMargin,
          panelOpen: panelOpen,
        },
      }));
    }
  },

  width: function(width) {
    if (arguments.length) {
      this._width = width;
      var mode;
      if (width > this._options.widthBreakpoint) {
        mode = 'large';
      } else {
        mode = 'narrow';
      }
      if (mode !== this._mode) {
        // prevent changing width of content twice
        this._content.content(null);
  			this._content.width(width);
        this._mode = mode;
        this._layout();
      } else {
        this._content.width(width);
      }
      return this;
    } else {
      return this._width;
    }
  },

  slidePanel: function(open) {
    this._layouter.slidePanel(open);
  },
  isPanelOpen: function() {
    return this._layouter.isPanelOpen();
  }
});
