import compose from 'ksf/utils/compose'
import _Evented from 'ksf/base/_Evented'
import _ContentDelegate from 'absolute/_ContentDelegate'
import Element from 'absolute/Element'
import Margin from 'absolute/Margin'
import Background from 'absolute/Background'

export default compose(_ContentDelegate, _Evented, function() {
  this._content = new Background(new Margin(this._img = new Element('img').style({
      cursor: 'pointer',
    }).on('click', () => {
      this._emit('action')
    }),
    10, 10)).color('white')
}, {
  icon: function(url) {
    this._img.attr('src', url)
    return this
  },
  onAction: function(cb) {
    this._on('action', cb)
    return this
  },
  offAction: function(cb) {
    this._off('action', cb)
    return this
  },
  disabled: function(disabled) {
    this._img.styleProp('opacity', disabled ? 0.3 : 1)
    return this
  },
  title: function(title) {
    this._img.attr('title', title)
    return this
  },
})
