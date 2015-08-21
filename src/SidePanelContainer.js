var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var ZPile = require('absolute/ZPile');
var Align = require('absolute/Align');
var Button = require('absolute/Button');

var SidePanel = require('./ResponsiveSidePanel');

module.exports = compose(_ContentDelegate, function(args) {
  this._content = new ZPile().content([
    this._panelContainer = new SidePanel({
      main: args.main,
      panel: args.panel,
      options: args.options,
    }).depth(10),
    new Align(new Button().width(50).height(50).value('|||').onAction(() => {
      this._panelContainer.slidePanel(!this._panelContainer.isPanelOpen());
    }), args.options.panelPosition, 'top'),
  ]);
}, {
  focusArea: function(areaId) {
    this._panelContainer.slidePanel(areaId === 'panel');
  },
});
