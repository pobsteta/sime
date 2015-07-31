var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var HFlex = require('absolute/HFlex');

var delegateGetSet = require('absolute/utils/delegateGetSet');
var Full = require('absolute/layout/Full');
var Elmt = require('absolute/Element');
var assign = require('lodash/object/assign');

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

var ParentContainer = compose(function() {
	this.element = this._container = new Elmt().style({
		transform: 'translateZ(0)',
		overflow: 'hidden'
	});

	this._hLayout = new Full('horizontal').content([this._container]);
	this._vLayout = new Full('vertical').content([this._container]);
}, {
	content: function(content) {
		if (arguments.length) {
			if (this._content) {
				this._content.parentNode(null);
				this._vLayout.remove('content');
				this._content = null;
			}
			if (content) {
				this._content = content.parentNode(this._container.domNode).containerVisible(true).top(0).zIndex(0);
				this._vLayout.add('content', content);
			}
		} else {
			return this._content;
		}
		return this;
	},
	parentNode: delegateGetSet('_container', 'parentNode'),
	left: delegateGetSet('_container', 'left'),
	top: delegateGetSet('_container', 'top'),
	zIndex: delegateGetSet('_container', 'zIndex'),
	width: delegateGetSet('_hLayout', 'size'),
	height: delegateGetSet('_vLayout', 'size'),
	depth: delegateGetSet('_container', 'depth'),
	visible: delegateGetSet('_container', 'visible'),
	containerVisible: delegateGetSet('_container', 'containerVisible'),
});

module.exports = compose(_ContentDelegate, function(args) {
  this._panel = args.panel;
  this._main = args.main;
  this._options = assign({
    panelWidth: 400,
    panelPosition: 'left',
  }, args.options);

	var flexArg = [this._main],
		panel = [this._panelContainer = new ParentContainer().content(this._panel.width(this._options.panelWidth).left(0)).width(this._options.panelWidth), 'fixed'];
	if (this._options.panelPosition === 'left') {
		flexArg.unshift(panel);
	} else {
		flexArg.push(panel);
	}

  this._content = new ParentContainer().content(this._hflex = new HFlex(flexArg).left(0));

	var prevX;
	this._panelContainer.element.on('touchstart', function(event) {
		prevX = event.touches[0].pageX;

		event.stopPropagation();

		var ontouchmove, ontouchend;
		this._panelContainer.element.on('touchmove', ontouchmove = function(event) {
			var deltaX = event.touches[0].pageX - prevX;

			this._positionPanel(this._panelSlideX + (this._options.panelPosition === 'left' ? -1 : 1) * deltaX);
			prevX = event.touches[0].pageX;

			event.stopPropagation();
		}.bind(this));
		this._panelContainer.element.on('touchend', ontouchend = function() {
			this._panelContainer.element.off('touchmove', ontouchmove);
			this._panelContainer.element.off('touchend', ontouchend);
		}.bind(this));
	}.bind(this));

	// open state
  this._panelSlideX = 0;
}, {
	_layout: function() {
    this._hflex
			.width(this._width + this._panelSlideX);
		if (this._options.panelPosition === 'left') {
			this._hflex.left(-this._panelSlideX);
		}
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

  _positionPanel: function(pos) {
    this._panelSlideX = Math.max(0, Math.min(pos, this._options.panelWidth));
    this._layout();
  },

	_animSlide: function(endPos) {
		var anim = new Anim([{
				start: this._panelSlideX, end: endPos, duration: 500, easing: easeOutQuint
		}]);
		anim.init(Date.now());
		anim.render(function(pos) {
				this._panelSlideX = pos;
				this._layout();
		}.bind(this));
	},

	slidePanel: function(open) {
		this._animSlide(open ? 0 : this._options.panelWidth);
	},

  isPanelOpen: function() {
    return this._panelSlideX === 0;
  }
});
