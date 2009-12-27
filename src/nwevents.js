/*
 * Copyright (C) 2005-2009 Diego Perini
 * All rights reserved.
 *
 * nwevents.js - Javascript Event Manager
 *
 * Author: Diego Perini <diego.perini at gmail com>
 * Version: 1.2.3beta
 * Created: 20051016
 * Release: 20091226
 *
 * License:
 *  http://javascript.nwbox.com/NWEvents/MIT-LICENSE
 * Download:
 *  http://javascript.nwbox.com/NWEvents/nwevents.js
 */

window.NW || (window.NW = {});

NW.Event = (function(global) {

  var version = 'nwevents-1.2.3beta',

  // default setting
  EVENTS_W3C = true,

  // event phases constants
  CAPTURING_PHASE = 1, AT_TARGET = 2, BUBBLING_PHASE = 3,

  // event collections and Previous DOM0 register
  Handlers = {}, Delegates = {}, Listeners = {}, Previous = {},

  // initial script load context
  viewport = global, context = global.document, root = context.documentElement,

  EventCollection =
    function() {
      return {
        items: [],
        calls: [],
        parms: [],
        wraps: []
      };
    },

  // use capability detection, currently FF3, Opera and IE
  hasActive = 'activeElement' in context ?
    (function() {
      try {
        context.activeElement = null;
        return null === context.activeElement;
      } catch(e) {
        return false;
      }
    }) : true,

  // get document from element
  getDocument =
    function(e) {
      return e.ownerDocument || e.document || e;
    },

  // get window from document
  getWindow = 'parentWindow' in top.document ?
    function(d) {
      return d.parentWindow || window;
    } : 'defaultView' in top.document && top === top.document.defaultView ?
    function(d) {
      return d.defaultView || window;
    } :
    function(d) {
      // fix for older Safari 2.0.x returning
      // [object AbstractView] instead of [window]
      if (window.frames.length === 0 && top.document === d) {
        return top;
      } else {
        for (var i in top.frames) {
          if (top.frames[i].document === d) {
            return top.frames[i];
          }
        }
      }
      return top;
    },

  // fix IE event properties to comply with w3c standards
  fixEvent =
    function(element, event, capture) {
      // needed for DOM0 events
      event || (event = getWindow(getDocument(element)).event);
      // bound element (listening the event)
      event.currentTarget = element;
      // fired element (triggering the event)
      event.target = event.srcElement || element;
      // add preventDefault and stopPropagation methods
      event.preventDefault = preventDefault;
      event.stopPropagation = stopPropagation;
      // bound and fired element are the same AT_TARGET
      event.eventPhase = capture ? CAPTURING_PHASE : BUBBLING_PHASE;
      // related element (routing of the event)
      event.relatedTarget =
        event[(event.target == event.fromElement ? 'to' : 'from') + 'Element'];
      // set time event was fixed
      event.timeStamp=+new Date();
      return event;
    },

  // prevent default action
  preventDefault =
    function() {
      this.returnValue = false;
    },

  // stop event propagation
  stopPropagation =
    function() {
      this.cancelBubble = true;
    },

  // block any further event processing
  stop =
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

  // check collection for registered event,
  // match element, handler and capture
  isRegistered =
    function(registry, element, type, handler, capture) {
      var i, l, found = false;
      if (registry[type] && registry[type].items) {
        for (i = 0, l = registry[type].items.length; l > i; i++) {
          if (
            registry[type].items[i] === element &&
            registry[type].calls[i] === handler &&
            registry[type].parms[i] === capture) {
            found = i;
            break;
          }
        }
      }
      return found;
    },

  // list event handlers bound to
  // a given object for each type
  getRegistered =
    function(object, type, register) {
      var i, j, l, results = [ ];
      type || (type = '*');
      object || (object = '*');
      register || (register = Listeners);
      for (i in register) {
        if (type.indexOf(i) > -1 || type == '*') {
          for (j = 0, l = register[i].items.length; j < l; j++) {
            if (register[i].items[j] === object || object == '*') {
              results.push(register[i].calls[j]);
            }
          }
        }
      }
      return results;
    },

  // handle listeners chain for event type
  handleListeners =
    function(event) {
      var i, l, result = true,
        items, calls, parms,
        type = event.type;

      if (Listeners[type] && Listeners[type].items) {

        if (!event.propagated) {
          if (FormActivationEvents[type]) return true;
        }

        // only AT_TARGET event.target === event.currentTarget
        if (event.eventPhase !== AT_TARGET && event.target === this) {
          event.eventPhase = AT_TARGET;
        }

        // make a copy of the Listeners[type] array
        // since it can be modified run time by the
        // events deleting themselves or adding new
        items = Listeners[type].items.slice();
        calls = Listeners[type].calls.slice();
        parms = Listeners[type].parms.slice();

        // process chain in fifo order
        for (i = 0, l = items.length; l > i; i++) {
          if (items[i] === this) {
            if ((event.eventPhase == CAPTURING_PHASE ?
              (parms[i] === true) : (parms[i] === false))) {
              if ((result = calls[i].call(this, event)) === false) break;
            }
          }
        }

      }

      return result;
    },

  // handle delegates chain for event type
  handleDelegates =
    function(event) {
      var i, l, 
        items, calls, parms, target, 
        result = true, type = event.type; 

      if (Delegates[type] && Delegates[type].items) {

        // make a copy of the Delegates[type] array
        // since it can be modified run time by the
        // events deleting themselves or adding new
        items = Delegates[type].items.slice();
        calls = Delegates[type].calls.slice();
        parms = Delegates[type].parms.slice();

        // process chain in fifo order
        bubblingLoop:
        for (i = 0, l = items.length; l > i; i++) {
          // if event.target matches one of the registered elements and
          // if "this" element matches one of the registered delegates
          target = event.target;
          // bubble events up to parent nodes
          while (target && target != this) {
            if (NW.Dom.match(target, items[i])) {
              // execute registered function in element scope
              if (calls[i].call(target, event) === false) {
                result = false;
                break bubblingLoop;
              }
            }
            target = target.parentNode;
          }
        }

      }

      return result;
    },

  // append element handler to the registry
  // used by handlers, listeners, delegates
  appendItem =
    function(registry, element, type, handler, capture) {
      // registry is a reference to an EventCollection,
      // actually supported Handler, Listeners, Delegates
      registry[type] || (registry[type] = new EventCollection);
      // append handler to the registry
      registry[type].items.push(element);
      registry[type].calls.push(handler);
      registry[type].parms.push(capture);
    },

  // remove element handler from the registry
  // used by handlers, listeners, delegates
  removeItem =
    function(registry, type, key) {
      // remove handler from the registry
      registry[type].items.splice(key, 1);
      registry[type].calls.splice(key, 1);
      registry[type].parms.splice(key, 1);
    },

  // lazy definition for addEventListener / attachEvent
  appendEvent = window.addEventListener && EVENTS_W3C ?
    function(element, type, handler, capture) {
      // use DOM2 event registration
      element.addEventListener(type, handler, capture || false);
    } : window.attachEvent && EVENTS_W3C ?
    function(element, type, handler, capture) {
      // use MSIE event registration
      var key = Handlers[type].wraps.push(function(event) {
        return handler.call(element, fixEvent(element, event, capture));
      });
      element.attachEvent('on' + type, Handlers[type].wraps[key - 1]);
    } :
    function(element, type, handler, capture) {
      Previous['on' + type] = element['on' + type] || new Function();
      // use DOM0 event registration
      element['on' + type] = function(event) {
        var previous, result;
        event || (event = fixEvent(this, event, capture));
        previous = Previous['on' + event.type];
        result = handler.call(this, event);
        previous.call(this, event);
        previous = null;
        return result;
      };
    },

  // lazy definition for removeEventListener / detachEvent
  removeEvent = window.removeEventListener && EVENTS_W3C ?
    function(element, type, handler, capture) {
      // use DOM2 event registration
      element.removeEventListener(type, handler, capture || false);
    } : window.detachEvent && EVENTS_W3C ?
    function(element, type, handler, capture, key) {
      // use MSIE event registration
      element.detachEvent('on' + type, handler);
      Handlers[type].wraps.splice(key, 1);
    } :
    function(element, type, handler, capture) {
      // use DOM0 event registration
      element['on' + type] = Previous['on' + type];
      delete Previous['on' + type];
    },

  // append an event handler
  appendHandler =
    function(element, type, handler, capture) {
      var i, k, l, types;
      if (typeof type == 'string') {
        types = type.split(' ');
        for (i = 0, l = types.length; i < l; i++) {
          k = isRegistered(Handlers, element, types[i], handler, capture);
          if (k === false) {
            appendItem(Handlers, element, types[i], handler, capture);
            appendEvent(element, types[i], handler, capture);
          }
        }
      } else {
        // a hash of "rules" containing type-handler pairs
        for (i in type) {
          appendHandler(element, i, type[i], capture);
        }
      }
      return this;
    },

  // remove an event handler
  removeHandler =
    function(element, type, handler, capture) {
      var i, k, l, types;
      if (typeof type == 'string') {
        types = type.split(' ');
        for (i = 0, l = types.length; i < l; i++) {
          k = isRegistered(Handlers, element, types[i], handler, capture);
          if (k !== false) {
            removeEvent(element, types[i], Handlers[types[i]].wraps[k], capture, k);
            removeItem(Handlers, types[i], k);
          }
        }
      } else {
        // a hash of "rules" containing type-handler pairs
        for (i in type) {
          removeHandler(element, i, type[i], capture);
        }
      }
      return this;
    },

  // append an event listener
  appendListener =
    function(element, type, handler, capture) {
      var i, k, l, types;
      if (typeof type == 'string') {
        types = type.split(' ');
        for (i = 0, l = types.length; i < l; i++) {
          k = isRegistered(Listeners, element, types[i], handler, capture);
          if (k === false) {
            appendItem(Listeners, element, types[i], handler, capture);
            if (getRegistered(element, types[i], Listeners).length === 1) {
              appendHandler(element, types[i], handleListeners, capture);
            }
          }
        }
      } else {
        // a hash of "rules" containing type-handler pairs
        for (i in type) {
          appendListener(element, i, type[i], capture);
        }
      }
      return this;
    },

  // remove an event listener
  removeListener =
    function(element, type, handler, capture) {
      var i, k, l, types;
      if (typeof type == 'string') {
        types = type.split(' ');
        for (i = 0, l = types.length; i < l; i++) {
          k = isRegistered(Listeners, element, types[i], handler, capture);
          if (k !== false) {
            if (getRegistered(element, types[i], Listeners).length === 1) {
              removeHandler(element, types[i], handleListeners, capture);
            }
            removeItem(Listeners, types[i], k);
          }
        }
      } else {
        // a hash of "rules" containing type-handler pairs
        for (i in type) {
          removeListener(element, i, type[i], capture);
        }
      }
      return this;
    },

  // append an event delegate
  appendDelegate =
    // with iframes pass a delegate parameter
    // "delegate" defaults to documentElement
    function(selector, type, handler, delegate) {
      var i, j, k, l, types;
      if (typeof selector == 'string') {
        types = type.split(' ');
        delegate = delegate || root;
        for (i = 0, l = types.length; i < l; i++) {
          k = isRegistered(Delegates, selector, types[i], handler, delegate);
          if (k === false) {
            appendItem(Delegates, selector, types[i], handler, delegate);
            if (Delegates[types[i]].items.length === 1) {
              appendListener(delegate, types[i], handleDelegates, true);
            }
          }
        }
      } else {
        // a hash of "rules" containing selector-event-handler
        for (i in selector) {
          if (typeof i == 'string') {
            for (j in selector[i]) {
              appendDelegate(i, j, selector[i][j]);
            }
          }
        }
      }
      return this;
    },

  // remove an event delegate
  removeDelegate =
    // with iframes pass a delegate parameter
    // "delegate" defaults to documentElement
    function(selector, type, handler, delegate) {
      var i, j, k, l, types;
      if (typeof type == 'string') {
        types = type.split(' ');
        delegate = delegate || root;
        for (i = 0, l = types.length; i < l; i++) {
          k = isRegistered(Delegates, selector, types[i], handler, delegate);
          if (k !== false) {
            if (Delegates[types[i]].items.length === 1) {
              removeListener(delegate, types[i], handleDelegates, true);
            }
            removeItem(Delegates, types[i], k);
          }
        }
      } else {
        // hash of "rules" containing selector-event-handler
        for (i in selector) {
          if (typeof i == 'string') {
            for (j in selector[i]) {
              removeDelegate(i, j, selector[i][j]);
            }
          }
        }
      }
      return this;
    },

  // programatically dispatch native or custom events
  dispatch = root.dispatchEvent ?
    // W3C event model
    function(element, type, capture) {
      var event, d = getDocument(element), w = getWindow(d);
      if (/mouse|click/.test(type)) {
        try {
          event = d.createEvent('MouseEvents');
          event.initMouseEvent(type, true, true, w, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        } catch(e) {
          event = d.createEvent('HTMLEvents');
          event.initEvent(type, true, true);
        }
      } else if (/key(down|press|out)/.test(type)) {
        event = d.createEvent('KeyEvents');
        event.initKeyEvent(type, true, true, w, false, false, false, false, 0, 0);
      } else {
        event = d.createEvent('HTMLEvents');
        event.initEvent(type, true, true);
      }
      // dispatch event type to element
      return element.dispatchEvent(event);
    } : root.fireEvent ?
    // IE event model
    function(element, type, capture) {
      var event, d = getDocument(element);
      event = d.createEventObject();
      event.type = type;
      event.target = element;
      event.eventPhase = 0;
      event.currentTarget = element;
      event.cancelBubble= !!capture;
      event.returnValue= undefined;
      // fire event type on element
      return element.fireEvent('on' + type, fixEvent(element, event, capture));
    } :
    // try manual dispatch
    function(element, type, capture) {
      // (TODO)
    },

  /* ==================== EVENT PROPAGATION ==================== */

  //
  // known available activation events:
  //
  // Internet Explorer:
  //   focusin, focusout, activate, deactivate,
  //   beforeactivate, beforedeactivate
  //
  // FF/Opera/Safari/K:
  //   DOMActivate, DOMFocusIn, DOMFocusOut
  //
  // DOM0/1 and inline:
  //   focus, blur
  //
  // we use just a few of them to emulate the capturing
  // and bubbling phases of the focus and blur events
  // where not available or named/used differently
  //
  ActivationMap = {
    'blur': 'blur',
    'focus': 'focus',
/*
    'focusin': 'focus',
    'focusout': 'blur',
    'activate': 'focus',
    'deactivate': 'blur',
    'DOMFocusIn': 'focus',
    'DOMFocusOut': 'blur',
*/
    'beforeactivate': 'focus',
    'beforedeactivate': 'blur'
  },

  FormActivationEvents = {
    blur: 1,
    focus: 1,
    reset: 1,
    submit: 1,
    change: 1
  },

  FormAction = 'keydown mousedown',
  Activation = context.addEventListener ?
    'focus blur' : 'beforeactivate beforedeactivate',

  // create a synthetic event
  synthesize =
    function(element, type, capture) {
      return {
        type: type,
        target: element,
        bubbles: true,
        cancelable: true,
        currentTarget: element,
        relatedTarget: null,
        timeStamp: +new Date(),
        preventDefault: preventDefault,
        stopPropagation: stopPropagation,
        eventPhase: capture ? CAPTURING_PHASE : BUBBLING_PHASE
      };
    },

  // propagate events traversing the
  // ancestors path in both directions
  propagate =
    function(event) {
      var result = true, target = event.target, type = event.type;
      // execute the capturing phase
      result && (result = propagatePhase(target, type, true));
      // execute the bubbling phase
      result && (result = propagatePhase(target, type, false));
      // remove the trampoline event
      removeHandler(target, type, propagate, false);
      // return flag
      return result;
    },

  // propagate event capturing or bubbling phase
  propagatePhase =
    function(element, type, capture) {
      var i, l,
        result = true,
        node = element, ancestors = [],
        event = synthesize(element, type, capture);
      // add synthetic flag
      event.propagated=true;
      // collect ancestors
      while(node.nodeType == 1) {
        ancestors.push(node);
        node = node.parentNode;
      }
      // capturing, reverse ancestors collection
      if (capture) ancestors.reverse();
      // execute registered handlers in fifo order
      for (i = 0, l = ancestors.length; l > i; i++) {
        // set currentTarget to current ancestor
        event.currentTarget = ancestors[i];
        // set eventPhase to the requested phase
        event.eventPhase = capture ? CAPTURING_PHASE : BUBBLING_PHASE;
        // execute listeners bound to this ancestor and set return value
        if (handleListeners.call(ancestors[i], event) === false || event.returnValue === false) {
          result = false;
          break;
        }
      }
      // remove synthetic flag
      delete event.propagated;
      return result;
    },

  // propagate activation events
  // captured/emulated activations
  // only applied to form elements
  propagateActivation =
    function(event) {
      var result = true, target = event.target;
      result && (result = propagatePhase(target, ActivationMap[event.type], true));
      result && (result = propagatePhase(target, ActivationMap[event.type], false));
      result || (event.preventDefault ? event.preventDefault() : (event.returnValue = false));
      return result;
    },

  // propagate form action events
  // mousedown and keydown events
  // only applied to form elements
  propagateFormAction =
    function(event) {
      var target = event.target, type = target.type;
      // handle activeElement on context document
      if (target != context.activeElement) {
        if (!hasActive && target.nodeType == 1) {
          context.activeElement = target;
          context.focusElement = null;
        }
      }
      // html form elements only
      if (type) {
        // handle focusElement on context document
        if (target != context.focusElement) {
          if (!hasActive) {
            context.focusElement = target;
          }
        }
        // keydown or mousedown on form elements
        if (/file|text|password/.test(type) &&
          event.keyCode == 13 && target.form) {
          type = 'submit';
          target = target.form;
        } else if (/select-(one|multi)/.test(type)) {
          type = 'change';
        } else if (/reset|submit/.test(type) && target.form) {
          target = target.form;
        } else {
          // action was on a form element but
          // no extra processing is necessary
          return;
        }
        appendHandler(target, type, propagate, false);
      }
    },

  // enable event propagation
  enablePropagation =
    function(context) {
      if (!context.forcedPropagation) {
        context.forcedPropagation = true;
        // deregistration on page unload
        appendHandler(getWindow(context), 'unload',
          function(event) {
            disablePropagation(context);
            // we are removing ourself here, so do it as last
            removeHandler(this, 'unload', arguments.callee, false);
          }, false);
        // register capturing keydown and mousedown event handlers
        appendHandler(context, FormAction, propagateFormAction, true);
        // register emulated capturing focus and blur event handlers
        appendHandler(context, Activation, propagateActivation, true);
      }
    },

  // disable event propagation
  disablePropagation =
    function(context) {
      if (context.forcedPropagation) {
        context.forcedPropagation = false;
        // deregister capturing keydown and mousedown event handlers
        removeHandler(context, FormAction, propagateFormAction, true);
        // deregister emulated capturing focus and blur event handlers
        removeHandler(context, Activation, propagateActivation, true);
      }
    };

  // inititalize the activeElement
  // to a known cross-browser state
  if (!hasActive) {
    context.activeElement = root;
  }

  // initialize context propagation
  if (!context.forcedPropagation) {
    enablePropagation(context);
  }

  return {

    // controls the type of registration
    // for event listeners (DOM0 / DOM2)
    EVENTS_W3C: EVENTS_W3C,

    // exposed event methods

    stop: stop,

    dispatch: dispatch,

    getRegistered: getRegistered,

    appendHandler: appendHandler,

    removeHandler: removeHandler,

    appendListener: appendListener,

    removeListener: removeListener,

    appendDelegate: appendDelegate,

    removeDelegate: removeDelegate,

    // helpers and debugging functions

    enablePropagation: enablePropagation,

    disablePropagation: disablePropagation

  };

})(this);

// embedded NW.Dom.match() so basic event delegation works,
// overwritten if loading the nwmatcher.js selector engine
NW.Dom = (function(global) {

  var Patterns = {
    'id': /#([^\.]+)/,
    'tagName': /^([^#\.]+)/,
    'className': /\.([^#]+)/,
    'all': /^[\.\-\#\w]+$/
  };

  return {
    // use a simple selector match or a full
    // CSS3 selector engine if it is available
    match:
      function(element, selector) {
        var d, j, id, length, results, tagName, className, match, matched = false;
        d = element.ownerDocument || element;
        if (typeof selector == 'string') {
          if (typeof d.querySelectorAll != 'undefined') {
            try {
              results = d.querySelectorAll(selector);
            } catch(e) {
              results = [];
            }
            length = results.length;
            while (length) {
              length--;
              if (results[length] === element) {
                matched = true;
                break;
              }
            }
          } else if (selector.match(Patterns.all)) {
            // use a simple selector match (id, tag, class)
            match = selector.match(Patterns.tagName);
            tagName = match ? match[1] : '*';
            match = selector.match(Patterns.id);
            id = match ? match[1] : null;
            match = selector.match(Patterns.className);
            className = match ? match[1] : null;
            if ((!id || id == element.id) &&
              (!tagName || tagName == '*' || (new RegExp(tagName, 'i')).test(element.nodeName)) &&
              (!className || (' ' + element.className + ' ').replace(/\s\s+/g, ' ').indexOf(' ' + className + ' ') > -1)) {
              matched = true;
            }
          }
        } else {
          // a selector matcher element
          if (typeof selector == 'element') {
            // match on property/values
            for (j in selector) {
              if (j == 'className') {
                // handle special className matching
                if ((' ' + element.className + ' ').replace(/\s\s+/g,' ').indexOf(' ' + selector[j] + ' ') > -1) {
                  matched = true;
                  break;
                }
              } else if (j == 'nodeName' || j == 'tagName') {
                // handle upper/lower case tagName
                if (element.nodeName.toLowerCase() == selector[j].toLowerCase()) {
                  matched = true;
                  break;
                }
              } else {
                // handle matching other properties
                if (element[j] === selector[j]) {
                  matched = true;
                  break;
                }
              }
            }
          }
        }
        // boolean true/false
        return matched;
      }

  };

})(this);
