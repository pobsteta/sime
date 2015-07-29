var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var ZPile = require('absolute/ZPile');
var Align = require('absolute/Align');
var Button = require('absolute/Button');

var DuoPanel = require('./DuoPanelLarge');

module.exports = compose(_ContentDelegate, function(args) {
  var container = this._content = new DuoPanel({
    main: new ZPile().content([
      args.main,
      new Align(new Button().width(30).height(30).value('|||').onAction(function() {
        container.slidePanel(!container.isPanelOpen());
      }), args.panelOptions.position, 'top')
    ]),
    panel: args.panel,
    panelOptions: args.panelOptions
  });
});
