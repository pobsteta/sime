var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var ZPile = require('absolute/ZPile');
var Align = require('absolute/Align');
var IconButton = require('./IconButton');

var SidePanel = require('./ResponsiveSidePanel');

import * as icons from './icons/index'

module.exports = compose(_ContentDelegate, function(args) {
  this._content = new ZPile().content([
    this._panelContainer = new SidePanel({
      main: args.main,
      panel: args.panel,
      options: args.options,
    }).depth(10),
    new Align(this._toggleBtn = new IconButton().width(50).height(50).onAction(() => {
      var openState = this._panelContainer.isPanelOpen()
      this._panelContainer.slidePanel(!openState)
      this._updateIcon(!openState)
    }), args.options.panelPosition, 'top'),
  ]);
  this._updateIcon(args.options.panelOpen)
}, {
  _updateIcon: function(open) {
    this._toggleBtn.icon(open ? icons.bottom : icons.first)
  },
  focusArea: function(areaId) {
    this._panelContainer.slidePanel(areaId === 'panel');
    this._updateIcon(false)
  },
});
