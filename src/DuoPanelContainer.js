var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var ZPile = require('absolute/ZPile');
var Align = require('absolute/Align');
var Button = require('absolute/Button');

var DuoPanelLarge = require('./DuoPanelLarge');
var DuoPanelSmall = require('./DuoPanelSmall');
var HResponsive = require('./HResponsive');

module.exports = compose(_ContentDelegate, function(panels) {
  var leftPanel = new ZPile().content([
    panels[0],
    new Align(new Button().width(30).height(30).value('<').onAction(function() {
      container.layouter().slidePanels(-1);
    }), 'right', 'bottom')
  ]);
  var rightPanel = new ZPile().content([
    panels[1],
    new Align(new Button().width(30).height(30).value('>').onAction(function() {
      container.layouter().slidePanels(1);
    }), 'left', 'bottom')
  ]);
  var container = this._content = new HResponsive({
    large: new DuoPanelLarge([leftPanel, rightPanel]),
    narrow: new DuoPanelSmall([leftPanel, rightPanel]),
    widthBreakpoint: 360
  });
});
