/*
 * Copyright (C) 2005-2008 Diego Perini
 * All rights reserved.
 *
 * nwevents.js - Javascript Event Manager
 *
 * Author: Diego Perini <diego.perini at gmail com>
 * Version: 1.09
 * Created: 20051016
 * Release: 20080624
 *
 * License:
 *	http://javascript.nwbox.com/NWEvents/MIT-LICENSE
 * Download:
 *	http://javascript.nwbox.com/NWEvents/nwevents.js
 */

window.NW || (window.NW = {});

NW.Event = function() {

	var version = '1.09',
		release = '20080624',

	Handlers = {},
	Delegates = {},
	Listeners = {},

	Patterns = {
		'all' : /^[\.\-\#\w]+$/,
		'tagName': /^([^#\.]+)/,
		'id': /#([^\.]+)/,
		'className': /\.([^#]+)/
	},

	forcedPropagation = false,

	CAPTURING_PHASE = 1,
	AT_TARGET = 2,
	BUBBLING_PHASE = 3,

	fixEvent =
		function(object, event, capture) {
			event || (event = getContext(object).event);
			event.currentTarget = object;
			event.target = event.srcElement || object;
			event.preventDefault = preventDefault;
			event.stopPropagation = stopPropagation;
			event.eventPhase =
				capture && (event.target == object) ?
					CAPTURING_PHASE :
					(event.target == object ?
						AT_TARGET :
						BUBBLING_PHASE);
			event.relatedTarget =
				event[(event.target == event.fromElement ? 'to' : 'from') + 'Element'];
			event.timeStamp=+new Date();
			return event;
		},

	preventDefault =
		function() {
			this.returnValue = false;
		},

	stopPropagation =
		function() {
			this.cancelBubble = true;
		},

	getContext =
		function(object) {
			return (object.ownerDocument || object.document || object).parentWindow || window;
		},

	isRegistered =
		function(array, object, type, handler, capture) {
			var i, l, found = false;
			if (array && array.objects) {
				for(i = 0, l = array.objects.length; l > i; i++) {
					if (array.objects[i] === object &&
						array.funcs[i] === handler &&
						array.parms[i] === capture) {
						found = i;
						break;
					}
				}
			}
			return found;
		},

	handleListeners =
		function(event) {
			var i, l, objects, funcs, parms,
				result = true, type = event.type;
			if (forcedPropagation) {
				if (/focus|blur|change|reset|submit/i.test(event.type) && !event.propagated) {
					if (event.preventDefault) {
						event.preventDefault();
					} else {
						event.returnValue = false;
					}
					return false;
				}
			}
			if (Listeners[type] && Listeners[type].objects) {
				objects = Listeners[type].objects.slice();
				funcs = Listeners[type].funcs.slice();
				parms = Listeners[type].parms.slice();
				for(i = 0, l = objects.length; l > i; i++) {
					if (objects[i] === this
						&& (
							(event.eventPhase == BUBBLING_PHASE && parms[i] === false) ||
							(event.eventPhase == CAPTURING_PHASE && parms[i] === true) ||
							!event.propagated
						)
					) {
						if (event.propagated && event.target === this) {
							event.eventPhase = AT_TARGET;
						}
						if (funcs[i].call(this, event) === false) {
							result = false;
							break;
						}
					}
				}
			}
			return result;
		},

	handleDelegates =
		function(event) {
			var i, l, objects, funcs, parms,
				result = true, type = event.type;
			if (Delegates[type] && Delegates[type].objects) {
				objects = Delegates[type].objects.slice();
				funcs = Delegates[type].funcs.slice();
				parms = Delegates[type].parms.slice();
				for(i = 0, l = objects.length; l > i; i++) {
					if (match(event.target, objects[i]) && parms[i] === this) {
						if (funcs[i].call(event.target, event) === false) {
							result = false;
							break;
						}
					}
				}
			}
			return result;
		},

	match =
		function(element, selector) {
			var j, matched = false,
				match, id, tagName, className,
				name = element.nodeName.toLowerCase(),
				klass = (' ' + element.className + ' ').replace(/\s\s+/g,' ');
			if (typeof selector == 'string') {
				if (NW.Dom && typeof NW.Dom.match == 'function') {
					if (NW.Dom.match(element, selector)) {
						matched = true;
					}
				}else if (selector.match(Patterns.all)) {
					match = selector.match(Patterns.tagName);
					tagName = match ? match[1] : '*';
					match = selector.match(Patterns.id);
					id = match ? match[1] : null;
					match = selector.match(Patterns.className);
					className = match ? match[1] : null;
					if ((!id || id == element.target.id) &&
						(!tagName || tagName == '*' || tagName == name) &&
						(!className || klass.indexOf(' ' + className + ' ') >- 1)) {
						matched = true;
					}
				}
			} else {
				if (selector != element) {
					for(j in selector) {
						if (j == 'nodeName') {
							if (selector[j].toLowerCase() == name) {
								matched = true;
								break;
							}
						} else if (j == 'className') {
							if (klass.indexOf(' ' + selector[j] + ' ') >- 1) {
								matched = true;
								break;
							}
						} else {
							if (selector[j] === element[j]) {
								matched = true;
								break;
							}
						}
					}
				}
			}
			return matched;
		},

	synthesize =
		function(object, type, capture) {
			return {
				type: type,
				target: object,
				bubbles: true,
				cancelable: true,
				currentTarget: object,
				relatedTarget: null,
				timeStamp: +new Date(),
				preventDefault: preventDefault,
				stopPropagation: stopPropagation,
				eventPhase: capture ? CAPTURING_PHASE : BUBBLING_PHASE
			};
		},

	propagate =
		function(event) {
			var result = true, target = event.target || event.srcElement;
			target['__' + event.type] = false;
			NW.Event.removeHandler(target, event.type, arguments.callee, false);
			result && (result = propagatePhase(target, event.type, true));
			result && (result = propagatePhase(target, event.type, false));
			result && target[event.type] && target[event.type]();
			return result;
		},

	propagatePhase =
		function(object, type, capture) {
			var i, l,
				result = true,
				node = object, ancestors = [],
				event = synthesize(object, type, capture);
			event.propagated=true;
			while(node) {
				ancestors.push(node);
				node = node.parentNode;
			}
			l = ancestors.length;
			if (capture) ancestors.reverse();
			for(i = 0; l > i; i++) {
				event.currentTarget = ancestors[i];
				event.eventPhase = capture ? CAPTURING_PHASE : BUBBLING_PHASE;
				if (handleListeners.call(ancestors[i], event) === false || event.returnValue === false) {
					result = false;
					break;
				}
			}
			delete event.propagated;
			return result;
		},

	propagateActivation =
		function(event) {
			var result = true, target = event.target;
			result && (result = propagatePhase(target, event.type, true));
			result && (result = propagatePhase(target, event.type, false));
			result || event.preventDefault();
			return result;
		},

	propagateIEActivation =
		function(event) {
			var result = true, target = event.srcElement;
			if (event.type == 'beforedeactivate') {
				result && (result = propagatePhase(target, 'blur', true));
				result && (result = propagatePhase(target, 'blur', false));
			}
			if (event.type == 'beforeactivate') {
				result && (result = propagatePhase(target, 'focus', true));
				result && (result = propagatePhase(target, 'focus', false));
			}
			result || (event.returnValue = false);
			return result;
		},

	propagateFormAction =
		function(event) {
			var target = event.target || event.srcElement, type = target.type;
			if (/file|text|password/.test(type) && event.keyCode == 13) {
					type = 'submit';
					target = target.form;
			} else if (/select-(one|multi)/.test(type)) {
					type = 'change';
			} else if (/reset|submit/.test(type)) {
					target = target.form;
			}
			if (target && !target['__' + type]) {
				target['__' + type] = true;
				NW.Event.appendHandler(target, type, propagate, false);
			}
		},

	enablePropagation =
		function(object) {
			var win = getContext(object), doc = win.document;
			if (!forcedPropagation) {
				forcedPropagation = true;
				NW.Event.appendHandler(win, 'unload',
					function(event) {
						NW.Event.removeListener(win, event.type, arguments.callee, false);
						disablePropagation(object);
					},false
				);
				NW.Event.appendHandler(doc, 'click', propagateFormAction, true);
				NW.Event.appendHandler(doc, 'keyup', propagateFormAction, true);
				if (doc.addEventListener) {
					NW.Event.appendHandler(doc, 'blur', propagateActivation, true);
					NW.Event.appendHandler(doc, 'focus', propagateActivation, true);
				} else if (doc.attachEvent) {
					NW.Event.appendHandler(doc, 'beforeactivate', propagateIEActivation, true);
					NW.Event.appendHandler(doc, 'beforedeactivate', propagateIEActivation, true);
				}
			}
		},

	disablePropagation =
		function(object) {
			var win = getContext(object), doc = win.document;
			if (forcedPropagation) {
				forcedPropagation = false;
				NW.Event.removeHandler(doc, 'click', propagateFormAction, true);
				NW.Event.removeHandler(doc, 'keyup', propagateFormAction, true);
				if (doc.removeEventListener) {
					NW.Event.removeHandler(doc, 'blur', propagateActivation, true);
					NW.Event.removeHandler(doc, 'focus', propagateActivation, true);
				} else if (doc.detachEvent) {
					NW.Event.removeHandler(doc, 'beforeactivate', propagateIEActivation, true);
					NW.Event.removeHandler(doc, 'beforedeactivate', propagateIEActivation, true);
				}
			}
		};

	return {

		EVENTS_W3C: true,

		stop:
			function(event) {
				if (event.preventDefault) {
					event.preventDefault();
				} else {
					event.returnValue = false;
				}
				if (event.stopPropagation) {
					event.stopPropagation();
				} else {
					event.cancelBubble = true;
				}
				return false;
			},

		dispatch:
			function(object, type, capture) {
				var event, result, win = getContext(object), doc = win.document;
				if (object.fireEvent) {
					event = doc.createEventObject();
					event.type = type;
					event.target = object;
					event.eventPhase = 0;
					event.currentTarget = object;
					event.cancelBubble= !!capture;
					event.returnValue= undefined;
					result = object.fireEvent('on' + type, fixEvent(object, event, capture));
				} else {
					if (/mouse|click/.test(type)) {
						event = doc.createEvent('MouseEvents');
						event.initMouseEvent(type, true, true, win, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
					} else if (/key(down|press|out)/.test(type)) {
						event = doc.createEvent('KeyEvents');
						event.initKeyEvent(type, true, true, win, false, false, false, false, 0, 0);
					} else {
						event = doc.createEvent('HTMLEvents');
						event.initEvent(type, true, true);
					}
					result = object.dispatchEvent(event);
				}
				return result;
			},

		appendHandler:
			function(object, type, handler, capture) {
				var key;
				Handlers[type] || (Handlers[type] = {
					objects: [],
					funcs: [],
					parms: [],
					wraps: []
				});
				if ((key = isRegistered(Handlers[type], object, type, handler, capture)) === false) {
					Handlers[type].objects.push(object);
					Handlers[type].funcs.push(handler);
					Handlers[type].parms.push(capture);
					if (object.addEventListener && NW.Event.EVENTS_W3C) {
						object.addEventListener(type, handler, capture || false);
					} else if (object.attachEvent && NW.Event.EVENTS_W3C) {
						key = Handlers[type].wraps.push(
							function(event) {
								return handler.call(object, fixEvent(object, event, capture));
							}
						);
						object.attachEvent('on' + type, Handlers[type].wraps[key - 1]);
					}else{
						if (Handlers[type].objects.length === 0) {
							if(typeof object['on' + type] == 'function') {
								Handlers[type].objects.push(object);
								Handlers[type].funcs.push(object['on' + type]);
								Handlers[type].parms.push(capture);
							}
							o['on' + type] =
								function(event) {
									return handler.call(this, fixEvent(this, event, capture));
								};
						}
					}
				}
				return this;
			},

		removeHandler:
			function(object, type, handler, capture) {
				var key;
				if (Handlers[type] && (key = isRegistered(Handlers[type], object, type, handler, capture)) !== false) {
					Handlers[type].objects.splice(key, 1);
					Handlers[type].funcs.splice(key, 1);
					Handlers[type].parms.splice(key, 1);
					if (object.removeEventListener && NW.Event.EVENTS_W3C) {
						object.removeEventListener(type, handler, capture || false);
					} else if (object.detachEvent && NW.Event.EVENTS_W3C) {
						object.detachEvent('on' + type, Handlers[type].wraps[k]);
						Handlers[type].wraps.splice(key, 1);
					} else {
						if (Handlers[type].o.length == 1) {
							objects['on' + type] = Handlers[type].objects[0];
							Handlers[type].objects.splice(0, 1);
							Handlers[type].funcs.splice(0, 1);
							Handlers[type].parms.splice(0, 1);
						}
					}
					if (Handlers[type].objects.length === 0) {
						delete Handlers[type];
					}
				}
				return this;
			},

		appendListener:
			function(object, type, handler, capture) {
				var key;
				Listeners[type] || (Listeners[type] = {
					objects: [],
					funcs: [],
					parms: [],
					wraps: []
				});
				if ((key = isRegistered(Listeners[type], object, type, handler, capture)) === false) {
					if (!forcedPropagation) {
						enablePropagation(object);
					}
					Listeners[type].objects.push(object);
					Listeners[type].funcs.push(handler);
					Listeners[type].parms.push(capture);
					if (object.addEventListener) {
						object.addEventListener(type, handleListeners, capture || false);
					}else if (object.attachEvent) {
						key = Listeners[type].w.push(
							function(event) {
								return handleListeners.call(object, fixEvent(object, event, capture));
							}
						);
						object.attachEvent('on' + type, Listeners[type].wraps[key - 1]);
					}
				}
				return this;
			},

		removeListener:
			function(object, type, handler, capture) {
				var key;
				if (Listeners[type] && (key = isRegistered(Listeners[type], object, type, handler, capture)) !== false) {
					Listeners[type].objects.splice(key, 1);
					Listeners[type].funcs.splice(key, 1);
					Listeners[type].parms.splice(key, 1);
					if (object.removeEventListener) {
						object.removeEventListener(type, handleListeners, capture || false);
					} else if (object.detachEvent) {
						object.detachEvent('on' + type, Listeners[type].wraps[key]);
						Listeners[type].wraps.splice(key, 1);
					}
					if (Listeners[type].objects.length === 0) {
						delete Listeners[type];
					}
				}
				return this;
			},

		appendDelegate:
			function(object, type, handler, delegate) {
				var key;
				delegate = delegate || document.documentElement;
				Delegates[type] || (Delegates[type] = {
					objects: [],
					funcs: [],
					parms: []
				});
				if ((key = isRegistered(Delegates[type], object, type, handler, delegate)) === false) {
					Delegates[type].objects.push(object);
					Delegates[type].funcs.push(handler);
					Delegates[type].parms.push(delegate);
					if (Delegates[type].objects.length === 1) {
						NW.Event.appendListener(delegate, type, handleDelegates, true);
					}
				}
				return this;
			},

		removeDelegate:
			function(object, type, handler, delegate) {
				var key;
				delegate = delegate || document.documentElement;
				if (Delegates[type] && (key = isRegistered(Delegates[type], object, type, handler, delegate)) !== false) {
					Delegates[type].objects.splice(key, 1);
					Delegates[type].funcs.splice(key, 1);
					Delegates[type].parms.splice(key, 1);
					if (Delegates[type].objects.length === 0) {
						delete Delegates[type];
						NW.Event.removeListener(delegate, type, handleDelegates, true);
					}
				}
				return this;
			}
	};

}();
