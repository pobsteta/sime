var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var HFlex = require('absolute/HFlex');
var Switch = require('absolute/Switch');

var easeOutQuint = function (t) { return 1+(--t)*t*t*t*t; };

var Anim = function(description) {
		var timeCursor = 0,
				lastEnd;
		this._desc = description.map(function(desc) {
				desc.startTime = timeCursor;
				timeCursor += desc.duration;
				desc.endTime = timeCursor;
				if (desc.start === undefined) {
						desc.start = lastEnd;
				}
				lastEnd = desc.end;
				return desc;
		});
		this._totalDuration = timeCursor;
};
Anim.prototype = {
		init: function(initTimestamp) {
				this._initTime = initTimestamp;
		},
		_getValue: function(t) {
				var value;
				this._desc.some(function(animDesc) {
						if (animDesc.endTime >= t) {
								var animT = (t - animDesc.startTime) / animDesc.duration;
								value = animDesc.start + animDesc.easing(animT) * (animDesc.end - animDesc.start);
								return true;
						}
				});
				this._lastValue = value;
				return value;
		},
		lastValue: function() {
				return this._lastValue;
		},
		render: function(renderFrame, endCallback) {
				var t = Date.now() - this._initTime;
				if (t > this._totalDuration) {
						t = this._totalDuration;
				}
				renderFrame(this._getValue(t));
				if (!this._cancelled) {
						if (t !== this._totalDuration) {
								var self = this;
								requestAnimationFrame(function() {
										self.render(renderFrame, endCallback);
								});
						} else {
								endCallback && endCallback();
						}
				}
		},
		cancel: function() {
				this._cancelled = true;
		}
};

module.exports = compose(_ContentDelegate, function(panels) {
	this._panels = panels;
  this._content = new Switch();

	// show first panel
  this._separatorPos = 100;
}, {
	_layout: function() {
		var contentArg;
		if (this._separatorPos === 0) {
			contentArg = this._panels[1];
		} else if (this._separatorPos === 100) {
			contentArg = this._panels[0];
		} else {
	    contentArg = new HFlex([
				[this._panels[0].width(Math.round(this.width() * this._separatorPos / 100)), 'fixed'],
				this._panels[1]
			]);
		}
		this._content.content(contentArg);
  },

  width: function(width) {
    if (arguments.length) {
      this._width = width;
			this._content.width(width);
      this._layout();
      return this;
    } else {
      return this._width;
    }
  },

	_animSlide: function(endPos) {
		var anim = new Anim([{
				start: this._separatorPos, end: endPos, duration: 500, easing: easeOutQuint
		}]);
		anim.init(Date.now());
		anim.render(function(pos) {
				this._separatorPos = pos;
				this._layout();
		}.bind(this));
	},

	slidePanels: function(dir) {
		if (dir < 0) {
			// slide towards left
			if (this._separatorPos > 0) {
				this._animSlide(0);
			}
		} else {
			// slide towards right
			if (this._separatorPos < 100) {
				this._animSlide(100);
			}
		}
	},
});
