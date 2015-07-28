"use strict";
var compose = require('ksf/utils/compose');

module.exports = compose(function () {
  this._saveListeners = []
}, {
  onSave: function (cb) {
    this._saveListeners.push(cb);
  },
  save: function () {
    return Promise.all(this._saveListeners.map(function (cb) {
      return cb()
    }))
  },
  offSave: function (cb) {
    var cbIndex = this._saveListeners.indexOf(cb)
    if (cbIndex >= 0) {
      this._saveListeners.splice(cbIndex, 1)
    } else {
      console.warn("cb is not registered");
    }
  }
})
