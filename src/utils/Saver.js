"use strict";
var compose = require('ksf/utils/compose');
var _Evented = require('ksf/base/_Evented')

function callFn(fn) {
  return fn()
}
/**
  * permet de coordonner des composants d'affichage et de modification d'éléments
  * chaque composant qui déclenche un changement de "page" doit s'assurer que les modifs éventuelles ont été enregistrées en appelant 'ensureChangesAreSaved'
  * chaque composant qui doit déclencher un enregistrement doit appeler 'saveChanges'
  * chaque composant qui permet de faire des changements doit écouter
  * * l'événement 'onSave' et retourner un promise d'enrgistrement et déclencher les événements qui vont bien 'itemCreated', 'itemDestroyed', 'attrsChanged' et/ou 'geomChanged'
  * * l'événement 'onCancel'
  * chaque composant qui affiche un résultat peut écouter 'onItemCreated', 'onItemDestroyed', 'onAttrsChanged' et 'onGeomChanged' pour décencher automatiquement un rafraichissement
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
    return this._args.confirm("Voulez-vous enregistrer ?").then(function (res) {
      if (res) {
        return self.saveChanges()
      } else {
        self.cancelChanges()
        return true
      }
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
  emit: _Evented._emit,
  // helper
  wrapCb: function (cb) {
    return () => this.ensureChangesAreSaved().then(cb)
  },
})
