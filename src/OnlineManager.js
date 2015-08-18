var create = require('lodash/object/create');
var compose = require('ksf/utils/compose');
var bindValueDestroyable = require('ksf/observable/bindValueDestroyable');
var PersistableValue = require('ksf/observable/PersistableValue');
var _ContentDelegate = require('absolute/_ContentDelegate');
import _Destroyable from 'ksf/base/_Destroyable'
var Switch = require('absolute/Switch');

var localRequest = require('./utils/LocalRequest')
var ConnectionView = require('./ConnectionView')

export default compose(_ContentDelegate, _Destroyable, function(args) {

	var online = new PersistableValue('online', true) // true or false
	var offlineMenuItemId = new PersistableValue('offlineMenuItemId', null)
	var offlineExtent = new PersistableValue('offlineExtent', null)
	var offlineDataTime = new PersistableValue('offlineDataTime', null)

	this._content = new Switch()


  this._own(bindValueDestroyable(online, onlineValue => {
    var view
		var commonArgs = create(args, {
			offlineMenuItemId: offlineMenuItemId,
			offlineExtent: offlineExtent,
			offlineDataTime: offlineDataTime,
		})
		if (onlineValue) {
      view = new ConnectionView(create(commonArgs, {
				online: true,
        goOffline: online.value.bind(online, false),
				menuItemId: null,
      }))
    } else {
      view = new ConnectionView(create (commonArgs, {
				online: false,
        goOnline: online.value.bind(online, true),
				request: localRequest(args.localDb),
				menuItemId: offlineMenuItemId.value(),
      }))
    }
    this._content.content(view)
    return view
  }, this))
})
