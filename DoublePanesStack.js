var compose = require('ksf/utils/compose');
var _ContentDelegate = require('absolute/_ContentDelegate');
var HFlex = require('absolute/HFlex');
var Switch = require('absolute/Switch');


// affiche une stack de pages (composants) sous forme de 2 panneaux et ne montre toujours que les 2 dernières pages
module.exports = compose(_ContentDelegate, function() {
	this._stack = [];
	this._content = new HFlex([
		this._firstPane = new Switch(),
		this._secondPane = new Switch(),
	]);
}, {
	next: function(page, from) {
		if (from) {
			this._stack.splice(this._stack.indexOf(from)+1);
		}
		this._stack.push(page);
		this._updatePanes();
	},
	back: function() {
		this._stack.pop();
		this._updatePanes();
	},
	_updatePanes: function() {
		// we need to empty the panes first, to prevent the state where the same page is in both panes
		this._firstPane.content(null);
		this._secondPane.content(null);

		var firstPage = this._stack.length > 1 ? this._stack[this._stack.length-2] : null;
		var secondPage = this._stack.length > 0 ? this._stack[this._stack.length-1] : null;
		this._firstPane.content(firstPage);
		this._secondPane.content(secondPage);
	},
});