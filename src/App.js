import compose from 'ksf/utils/compose'
import _ContentDelegate from 'absolute/_ContentDelegate'
import Align from 'absolute/Align'
import Background from 'absolute/Background'
import VPile from 'absolute/VPile'
import HFlex from 'absolute/HFlex'
import ZPile from 'absolute/ZPile'
import Switch from 'absolute/Switch'
import Label from 'absolute/Label'
import Button from 'absolute/Button'
import Value from 'ksf/observable/Value'

import ConnectionManager from './ConnectionManager'

const defaultButtonSize = 50
const appVersion = '0.5'

var Modal = compose(_ContentDelegate, function (content) {
  this._content = new Background(
    new Align(content, 'middle', 'middle')
  ).color('lightgrey').opacity(0.8)
})

var ConfirmDialog = compose(_ContentDelegate, function (question) {
  var self = this
  this._response = new Promise(function(resolve){
    self._content = new Modal(new VPile().content([
      new Label().value(question).height(30),
      new HFlex([
        new Button().value("OK").onAction(function() {
          resolve(true)
        }),
        new Button().value("Annuler").onAction(function() {
          resolve(false)
        }),
      ]).height(60),
    ]).width(200))
  })
}, {
  then: function () {
    return this._response.then.apply(this._response, arguments)
  },
})

var position = new Value()
navigator.geolocation.watchPosition(
  position.value.bind(position),
  (err) => {
    position.value(null)
    console.warn("Erreur lors de l'acquisition de la position", err)
  },
  {
    enableHighAccuracy: true,
    maximumAge: 30*1000,
    //timeout: 3*60*1000,
  }
)

export default compose(_ContentDelegate, function() {
	var popupContainer = new Switch().depth(10)

	this._content = new ZPile().content([
    new ConnectionManager({
      appVersion: appVersion,
      popupContainer: popupContainer,
      confirm: function (question) {
        var cmp = new ConfirmDialog(question)
        popupContainer.content(cmp)
        return cmp.then(function (res) {
          popupContainer.content(null)
          return res
        })
      },
      modal: function (content) {
        popupContainer.content(content ? new Modal(content) : null)
      },
      defaultButtonSize: defaultButtonSize,
      position: position,
    }).depth(1000),
		popupContainer,
	])
})
