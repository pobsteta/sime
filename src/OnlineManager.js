var create = require('lodash/object/create');
var compose = require('ksf/utils/compose');
var bindValueDestroyable = require('ksf/observable/bindValueDestroyable');
var PersistableValue = require('ksf/observable/PersistableValue');
var _ContentDelegate = require('absolute/_ContentDelegate');
import _Destroyable from 'ksf/base/_Destroyable'
var Switch = require('absolute/Switch');

var OnlineApp = require('./ConnectionView')
var OfflineApp = require('./OfflineView')

export default compose(_ContentDelegate, _Destroyable, function(args) {

	var online = new PersistableValue('online', true); // true or false

	this._content = new Switch()

  this._own(bindValueDestroyable(online, onlineValue => {
    var view
		if (onlineValue) {
      view = new OnlineApp(create(args, {
        goOffline: online.value.bind(online, false),
      }))
    } else {
      view = new OfflineApp(create (args, {
        goOnline: online.value.bind(online, true),
      }))
    }
    this._content.content(view)
    return view
  }, this))
})
