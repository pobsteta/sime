import compose from 'ksf/utils/compose'
import _Evented from 'ksf/base/_Evented'
import _ContentDelegate from 'absolute/_ContentDelegate'
import Element from 'absolute/Element'
import Clickable from 'absolute/Clickable'
import Margin from 'absolute/Margin'
import Background from 'absolute/Background'

export default compose(_ContentDelegate, _Evented, function() {
  this._content = new Clickable(
    new Background(
      new Margin(this._img = new Element('img'),
        10, 10))
      .color('white'))
}, {
  icon: function(url) {
    this._img.attr('src', url)
    return this
  },
  onAction: function(cb) {
    this._content.onAction(cb)
    return this
  },
  offAction: function(cb) {
    this._content.offAction(cb)
    return this
  },
  disabled: function(disabled) {
    this._img.styleProp('opacity', disabled ? 0.3 : 1)
    return this
  },
  title: function(title) {
    this._content.clickArea.attr('title', title)
    return this
  },
})
