import compose from 'ksf/utils/compose'
import _Destroyable from 'ksf/base/_Destroyable'
import bindValue from 'ksf/observable/bindValue'
import create from 'lodash/object/create'
import _ContentDelegate from 'absolute/_ContentDelegate'
var Label = require('absolute/Label');
var Button = require('absolute/Button');
import VPile from 'absolute/VPile'

export default compose(_ContentDelegate, _Destroyable, function (args) {
  this._content = new VPile().content([
    new Label().value("You are  offline").height(args.defaultButtonSize),
    new Button().value("Passer en ligne").onAction(args.goOnline).height(args.defaultButtonSize),
  ])
})
