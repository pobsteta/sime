var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var ZPile = require('absolute/ZPile');
var Align = require('absolute/Align');
var Button = require('absolute/Button');

var SidePanel = require('./ResponsiveSidePanel');

module.exports = compose(_ContentDelegate, function(args) {
  var container = this._content = new SidePanel({
    main: new ZPile().content([
      args.main,
      new Align(new Button().width(50).height(50).value('|||').onAction(function() {
        container.slidePanel(!container.isPanelOpen());
      }), args.options.panelPosition, 'top')
    ]),
    panel: args.panel,
    options: args.options
  });
}, {
  focusArea: function(areaId) {
    this._content.slidePanel(areaId === 'panel');
  }
});
