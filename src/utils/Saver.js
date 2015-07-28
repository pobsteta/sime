"use strict";
var compose = require('ksf/utils/compose');
var _Evented = require('ksf/base/_Evented')
var HFlex = require('absolute/HFlex')
var Button = require('absolute/Button');
var Label = require('absolute/Label');
var Align = require('absolute/Align');
var Background = require('absolute/Background');
var VPile = require('absolute/VPile');


function callFn(fn) {
  return fn()
}
/**
  * permet de coordonner des composants d'affichage et de modification d'éléments
*/
module.exports = compose(_Evented, function (args) {
  this._args = args
}, {
  ensureChangesAreSaved: function () {
    var self = this
    var changes = this._args.changes
    // s'il n'y a pas de changement en cours, pas de question à poser
    if (!changes.geom && Object.keys(changes.attrs).length === 0) {
      return Promise.resolve(true)
    }
    var popupContainer = this._args.popupContainer
    return new Promise(function(resolve) {
      popupContainer.content(new Background(
				new Align(new VPile().width(200).content([
          new Label().value("Voulez-vous enregistrer ?").height(60),
          new HFlex([
            new Button().value("oui").onAction(function () {
              resolve(self.saveChanges())
            }),
            new Button().value("non").onAction(function () {
              self.cancelChanges()
              resolve(true)
            }),
          ]).height(60),
        ]), 'middle', 'middle')
      ).color('lightgrey').opacity(0.8))
    }).then(function () {
      popupContainer.content(null)
    })
  },
  saveChanges: function () {
    var saveListeners = this._listeners && this._listeners.save || []
    return Promise.all(saveListeners.map(callFn))
  },
  cancelChanges: function () {
    var cancelListeners = this._listeners && this._listeners.cancel || []
    cancelListeners.forEach(callFn)
  },
})
