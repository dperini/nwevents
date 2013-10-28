/*
 * Copyright (C) 2013 Diego Perini
 * All rights reserved.
 *
 * delegate.js - Event delegates for newer browsers
 *
 * Desktop browsers support:
 *
 *    Chrome 10+
 *    Safari 5.0+
 *    Firefox 3.6+
 *    Opera 11.50+
 *    Internet Explorer 9+
 *
 * Mobile browsers support:
 *
 *    Google Android 2.3+
 *    Apple iOS 4+
 *    ChromiumOS
 *    FirefoxOS
 *
 * Author: Diego Perini <diego.perini at gmail com>
 * Version: 0.9
 * License: MIT
 *
 */

(function(global) {

	var delegates = { },
	document = global.document,
	root = document.documentElement,

	// find Matches Selector API name to use if available
	NATIVE_MATCHES_SELECTOR =
		'matchesSelector' in root ? 'matchesSelector' :
		'oMatchesSelector' in root ? 'oMatchesSelector' :
		'msMatchesSelector' in root ? 'msMatchesSelector' :
		'mozMatchesSelector' in root ? 'mozMatchesSelector' :
		'webkitMatchesSelector' in root ? 'webkitMatchesSelector' :
		Function('return false'),

	matches = root[NATIVE_MATCHES_SELECTOR],

	has = function(element, handler, wrapper) {
		var d, i, l = this.length;
		for (i = 0; l > i; ++i) {
			d = this[i];
			if (d.element === element &&
				d.handler === handler &&
				d.wrapper === wrapper) {
				return i;
			}
		}
		return false;
	},

	wrapper = function(selector, handler) {
		return function delegator(e) {
			if (matches.call(e.target, selector)) {
				return handler.call(e.target, e);
			}
			return false;
		};
	},

	_delegate = function(selector, type, handler, element) {
		var i, j, l, types;
		element = element || root;
		if (typeof selector == 'string') {
			types = type.split(' ');
			for (i = 0, l = types.length; l > i; ++i) {
				delegates[types[i]] || (delegates[types[i]] = [ ]);
				j = has.call(delegates[types[i]], selector, handler, element);
				if (j === false) {
					delegator = wrapper(selector, handler);
					element.addEventListener(types[i], delegator, true);
					delegates[types[i]].push({
						selector: selector,
						handler: handler,
						element: element,
						wrapper: delegator
					});
				}
			}
		} else if (typeof selector == 'object') {
			for (i in selector) {
				if (typeof i == 'string') {
					for (j in selector[i]) {
						_delegate(i, j, selector[i][j], element);
					}
				}
			}
		}
		return this;
	},

	_undelegate = function(selector, type, handler, element) {
		var i, j, l, types;
		element = element || root;
		if (typeof selector == 'string') {
			types = type.split(' ');
			for (i = 0, l = types.length; l > i; ++i) {
				delegates[types[i]] || (delegates[types[i]] = [ ]);
				j = has.call(delegates[types[i]], selector, handler, element);
				if (j !== false) {
					element.removeEventListener(types[i], delegates[types[i]][j].wrapper, true);
					delegates[types[i]].splice(j, 1);
				}
			}
		} else if (typeof selector == 'object') {
			for (i in selector) {
				if (typeof i == 'string') {
					for (j in selector[i]) {
						_undelegate(i, j, selector[i][j], element);
					}
				}
			}
		}
		return this;
	},

	_undelegateAll = function(type) {
		var i, j, l, types;
		if (typeof type == 'string') {
			types = type.split(' ');
			for (i = 0, l = types.length; l > i; ++i) {
				for (j = delegates[types[i]].length - 1; j >= 0; --j) {
					delegates[types[i]][j].element.removeEventListener(types[i], delegates[types[i]][j].wrapper, true);
					delegates[types[i]].pop();
				}
			}
		} else if (type == '*') {
			for (i in delegates) _undelegateAll(i);
		}
	};

	// extend Node interface
	if (Node.prototype && !Node.prototype.delegate) {
		Node.prototype.delegate = function delegate() { _delegate.apply(this, arguments); };
		Node.prototype.undelegate = function undelegate() { _undelegate.apply(this, arguments); };
		Node.prototype.undelegateAll = function undelegateAll() { _undelegateAll.apply(this, arguments); };
	}

})(this);
