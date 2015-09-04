var create = require('lodash/object/create');
var compose = require('ksf/utils/compose');
var bindValueDestroyable = require('ksf/observable/bindValueDestroyable');
var PersistableValue = require('ksf/observable/PersistableValue');
var _ContentDelegate = require('absolute/_ContentDelegate');
import _Destroyable from 'ksf/base/_Destroyable'
var Switch = require('absolute/Switch');

var localRequest = require('./utils/LocalRequest')
var localGeoRequest = require('./utils/localGeoRequest')
var ConnectionView = require('./ConnectionView')

export default compose(_ContentDelegate, _Destroyable, function(args) {

	var online = new PersistableValue('online', true) // true or false
	var offlineMenuItemId = new PersistableValue('offlineMenuItemId', null)
	var offlineDataStatus = new PersistableValue('offlineDataStatus', "Aucune données")
	var mapExtent = new PersistableValue('mapExtent', [272570.7108623652, 6242518.1093190815, 275680.7424507183, 6245532.594622077])

	this._content = new Switch()


  this._own(bindValueDestroyable(online, onlineValue => {
    var view
		var commonArgs = create(args, {
			offlineMenuItemId: offlineMenuItemId,
			mapExtent: mapExtent,
			offlineDataStatus: offlineDataStatus,
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
				wfsRequest: localGeoRequest(args.localDb),
				menuItemId: offlineMenuItemId.value(),
      }))
    }
    this._content.content(view)
    return view
  }, this))
})
