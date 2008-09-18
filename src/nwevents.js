/*
 * Copyright (C) 2005-2008 Diego Perini
 * All rights reserved.
 *
 * nwevents.js - Javascript Event Manager
 *
 * Author: Diego Perini <diego.perini at gmail com>
 * Version: 1.2.0beta
 * Created: 20051016
 * Release: 20080907
 *
 * License:
 *  http://javascript.nwbox.com/NWEvents/MIT-LICENSE
 * Download:
 *  http://javascript.nwbox.com/NWEvents/nwevents.js
 */

window.NW || (window.NW = {});

NW.Event = function() {

  var version = '1.2.0beta',

  // event collections
  Handlers = {},
  Delegates = {},
  Listeners = {},

  // event phases constants
  CAPTURING_PHASE = 1,
  AT_TARGET = 2,
  BUBBLING_PHASE = 3,

  // for simple delegation
  Patterns = {
    'id': /#([^\.]+)/,
    'tagName': /^([^#\.]+)/,
    'className': /\.([^#]+)/,
    'all': /^[\.\-\#\w\*]+$/
  },

  // use feature detection, currently FF3, Opera and IE
  hasActive = typeof document.activeElement != 'undefined',

  // fix IE event properties to comply with w3c standards
  fixEvent =
    function(element, event, capture) {
      // needed for DOM0 events
      event || (event = getContext(element).event);
      // bound element (listening the event)
      event.currentTarget = element;
      // fired element (triggering the event)
      event.target = event.srcElement || element;
      // add preventDefault and stopPropagation methods
      event.preventDefault = preventDefault;
      event.stopPropagation = stopPropagation;
      // bound and fired element are the same AT-TARGET
      event.eventPhase = capture && (event.target == element) ? CAPTURING_PHASE :
                (event.target == element ? AT_TARGET : BUBBLING_PHASE);
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

  // get context window for element
  getContext =
    function(element) {
      return (element.ownerDocument || element.document || element).parentWindow || window;
    },

  // check collection for registered event,
  // match element, type, handler and capture
  isRegistered =
    function(array, element, type, handler, capture) {
      var i, l, found = false;
      if (array && array.elements) {
        for (i = 0, l = array.elements.length; l > i; i++) {
          if (array.elements[i] === element &&
            array.funcs[i] === handler &&
            array.parms[i] === capture) {
            found = i;
            break;
          }
        }
      }
      return found;
    },

  // get all listener of type for element
  getListeners =
    function(element, type, handler) {
      for (var i=0, r = []; Listeners[type].elements.length > i; i++) {
        if (Listeners[type].elements[i] === element && Listeners[type].funcs[i] === handler) {
          r.push(Listeners[type].funcs[i]);
        }
      }
      return r;
    },

  // handle listeners chain for event type
  handleListeners =
    function(event) {
      var i, l, elements, funcs, parms, result = true, type = event.type;
      if (!event.propagated && "|focus|blur|change|reset|submit|".indexOf(event.type) > -1) {
        if (event.preventDefault) {
          event.preventDefault();
        } else {
          event.returnValue = false;
        }
        return false;
      }
      if (Listeners[type] && Listeners[type].elements) {
        // make a copy of the Listeners[type] array
        // since it can be modified run time by the
        // events deleting themselves or adding new
        elements = Listeners[type].elements.slice();
        funcs = Listeners[type].funcs.slice();
        parms = Listeners[type].parms.slice();
        // process chain in fifo order
        for (i = 0, l = elements.length; l > i; i++) {
          // element match current target ?
          if (elements[i] === this
            && (
              (event.eventPhase == BUBBLING_PHASE && parms[i] === false) ||
              (event.eventPhase == CAPTURING_PHASE && parms[i] === true) ||
              !event.propagated
            )
          ) {
            // a synthetic event during the AT_TARGET phase ?
            if (event.propagated && event.target === this) {
              event.eventPhase = AT_TARGET;
            }
            // execute registered function in element scope
            if (funcs[i].call(this, event) === false) {
              result = false;
              break;
            }
          }
        }
      }
      return result;
    },

  // handle delegates chain for event type
  handleDelegates =
    function(event) {
      var i, l, elements, funcs, parms,
        result = true, type = event.type;
      if (Delegates[type] && Delegates[type].elements) {
        // make a copy of the Delegates[type] array
        // since it can be modified run time by the
        // events deleting themselves or adding new
        elements = Delegates[type].elements.slice();
        funcs = Delegates[type].funcs.slice();
        parms = Delegates[type].parms.slice();
        // process chain in fifo order
        for (i = 0, l = elements.length; l > i; i++) {
          // if event.target matches one of the registered elements and
          // if "this" element matches one of the registered delegates
          if (parms[i] === this && NW.Dom.match(event.target, elements[i])) {
            // execute registered function in element scope
            if (funcs[i].call(event.target, event) === false) {
              result = false;
              break;
            }
          }
        }
      }
      return result;
    },

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
      var result = true, target = event.target;
      target['__' + event.type] = false;
      // remove the trampoline event
      NW.Event.removeHandler(target, event.type, arguments.callee, false);
      // execute the capturing phase
      result && (result = propagatePhase(target, event.type, true));
      // execute the bubbling phase
      result && (result = propagatePhase(target, event.type, false));
      // submit/reset events relayed to parent forms
      if (target.form) { target = target.form; }
      // execute existing native method if not overwritten by html
      result && /^\s*function\s+/.test(target[event.type] + '') && target[event.type]();
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

  // propagate activation events (W3 generic)
  propagateActivation =
    function(event) {
      var result = true, target = event.target;
      result && (result = propagatePhase(target, event.type, true));
      result && (result = propagatePhase(target, event.type, false));
      result || event.preventDefault();
      return result;
    },

  // propagate activation events (IE specific)
  propagateIEActivation =
    function(event) {
      var result = true, target = event.target;
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

  // propagate form action events
  propagateFormAction =
    function(event) {
      var target = event.target, type = target.type, doc = getContext(target).document;
      // handle activeElement on context document
      if (target != doc.activeElement) {
        if ((!hasActive || window.opera) && target.nodeType == 1) {
          doc.activeElement = target;
          doc.focusElement = null;
        }
      }
      if (type) {
        // handle focusElement on context document
        if (target != doc.focusElement) {
          if ((!hasActive || window.opera)) {
            doc.focusElement = target;
          }
        }
        if (/file|text|password/.test(type) && event.keyCode == 13) {
          type = 'submit';
          target = target.form;
        } else if (/select-(one|multi)/.test(type)) {
          type = 'change';
        } else if (/reset|submit/.test(type)) {
          target = target.form;
        } else {
          return;
        }
        if (target && !target['__' + type]) {
          target['__' + type] = true;
          NW.Event.appendHandler(target, type, propagate, false);
        }
      }
    },

  // enable event propagation
  enablePropagation =
    function(win) {
      var doc = win.document;
      if (!doc.forcedPropagation) {
        doc.forcedPropagation = true;
        // deregistration on page unload
        NW.Event.appendHandler(win, 'beforeunload',
          function(event) {
            NW.Event.removeHandler(win, 'beforeunload', arguments.callee, false);
            disablePropagation(win);
          },false
        );
        // register capturing keydown and mousedown event handlers
        NW.Event.appendHandler(doc, 'keydown', propagateFormAction, true);
        NW.Event.appendHandler(doc, 'mousedown', propagateFormAction, true);
        if (doc.addEventListener) {
          // register capturing focus and blur event handlers
          NW.Event.appendHandler(doc, 'blur', propagateActivation, true);
          NW.Event.appendHandler(doc, 'focus', propagateActivation, true);
        } else if (doc.attachEvent) {
          // register emulated capturing focus and blur event handlers (for IE)
          NW.Event.appendHandler(doc, 'beforeactivate', propagateIEActivation, true);
          NW.Event.appendHandler(doc, 'beforedeactivate', propagateIEActivation, true);
        }
      }
    },

  // disable event propagation
  disablePropagation =
    function(win) {
      var doc = win.document;
      if (doc.forcedPropagation) {
        doc.forcedPropagation = false;
        // deregister capturing keydown and mousedown event handlers
        NW.Event.removeHandler(doc, 'keydown', propagateFormAction, true);
        NW.Event.removeHandler(doc, 'mousedown', propagateFormAction, true);
        if (doc.removeEventListener) {
          // deregister capturing focus and blur event handlers
          NW.Event.removeHandler(doc, 'blur', propagateActivation, true);
          NW.Event.removeHandler(doc, 'focus', propagateActivation, true);
        } else if (doc.detachEvent) {
          // deregister emulated capturing focus and blur event handlers (for IE)
          NW.Event.removeHandler(doc, 'beforeactivate', propagateIEActivation, true);
          NW.Event.removeHandler(doc, 'beforedeactivate', propagateIEActivation, true);
        }
      }
    };

  // inititalize the activeElement
  // to a known cross-browser state
  if (!hasActive || window.opera) {
    document.activeElement = document.documentElement;
  }

  return {

    // control the type of registration
    // for event listeners (DOM0 / DOM2)
    EVENTS_W3C: true,

    // block any further event processing
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

    // programatically dispatch native or custom events
    dispatch:
      function(element, type, capture) {
        var event, result, win = getContext(element), doc = win.document;
        if (element.fireEvent) {
          // IE event model
          event = doc.createEventObject();
          event.type = type;
          event.target = element;
          event.eventPhase = 0;
          event.currentTarget = element;
          event.cancelBubble= !!capture;
          event.returnValue= undefined;
          // dispatch event type to element
          result = element.fireEvent('on' + type, fixEvent(element, event, capture));
        } else {
          // W3C event model
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
          // dispatch event type to element
          result = element.dispatchEvent(event);
        }
        return result;
      },

    // append an event handler
    appendHandler:
      function(element, type, handler, capture) {
        var key;
        Handlers[type] || (Handlers[type] = {
          elements: [],
          funcs: [],
          parms: [],
          wraps: []
        });
        // if handler is not already registered
        if ((key = isRegistered(Handlers[type], element, type, handler, capture || false)) === false) {
          // append handler to the chain
          Handlers[type].elements.push(element);
          Handlers[type].funcs.push(handler);
          Handlers[type].parms.push(capture);
          if (element.addEventListener && NW.Event.EVENTS_W3C) {
            // use DOM2 event registration
            element.addEventListener(type, handler, capture || false);
          } else if (element.attachEvent && NW.Event.EVENTS_W3C) {
            // append wrapper function to fix IE scope
            key = Handlers[type].wraps.push(
              function(event) {
                return handler.call(element, fixEvent(element, event, capture));
              }
            );
            // use MSIE event registration
            element.attachEvent('on' + type, Handlers[type].wraps[key - 1]);
          } else {
            // if first handler for this event type
            if (Handlers[type].elements.length == 0) {
              // save previous handler if existing
              if (typeof element['on' + type] == 'function') {
                Handlers[type].elements.push(element);
                Handlers[type].funcs.push(element['on' + type]);
                Handlers[type].parms.push(capture);
              }
              // use DOM0 event registration
              o['on' + type] =
                function(event) {
                  return handler.call(this, fixEvent(this, event, capture));
                };
            }
          }
        }
        return this;
      },

    // remove an event handler
    removeHandler:
      function(element, type, handler, capture) {
        var key;
        // if handler is found to be registered
        if ((key = isRegistered(Handlers[type], element, type, handler, capture || false)) !== false) {
          // remove handler from the chain
          Handlers[type].elements.splice(key, 1);
          Handlers[type].funcs.splice(key, 1);
          Handlers[type].parms.splice(key, 1);
          if (element.removeEventListener && NW.Event.EVENTS_W3C) {
            // use DOM2 event deregistration
            element.removeEventListener(type, handler, capture || false);
          } else if (element.detachEvent && NW.Event.EVENTS_W3C) {
            // use MSIE event deregistration
            element.detachEvent('on' + type, Handlers[type].wraps[key]);
            // remove wrapper function from the chain
            Handlers[type].wraps.splice(key, 1);
          } else {
            // if last handler for this event type
            if (Handlers[type].elements.length == 1) {
              // use DOM0 event deregistration
              elements['on' + type] = Handlers[type].elements[0];
              // remove last handler from the chain
              Handlers[type].elements.splice(0, 1);
              Handlers[type].funcs.splice(0, 1);
              Handlers[type].parms.splice(0, 1);
            }
          }
          // if no more registered handlers of type
          if (Handlers[type].elements.length == 0) {
            // remove chain type from collection
            delete Handlers[type];
          }
        }
        return this;
      },

    // append an event listener
    appendListener:
      function(element, type, handler, capture) {
        var key, win = getContext(element);
        Listeners[type] || (Listeners[type] = {
          elements: [],
          funcs: [],
          parms: [],
          wraps: []
        });
        // if listener is not already registered
        if ((key = isRegistered(Listeners[type], element, type, handler, capture || false)) === false) {
          if (!win.document.forcedPropagation) {
            enablePropagation(win);
          }
          // append listener to the chain
          Listeners[type].elements.push(element);
          Listeners[type].funcs.push(handler);
          Listeners[type].parms.push(capture);
          if (getListeners(element, type, handler).length == 1) {
            NW.Event.appendHandler(element, type, handleListeners, capture || false);
          }
        }
        return this;
      },

    // remove an event listener
    removeListener:
      function(element, type, handler, capture) {
        var key;
        // if listener is found to be registered
        if ((key = isRegistered(Listeners[type], element, type, handler, capture || false)) !== false) {
          // remove listener from the chain
          Listeners[type].elements.splice(key, 1);
          Listeners[type].funcs.splice(key, 1);
          Listeners[type].parms.splice(key, 1);
          if (Listeners[type].elements.length == 0) {
            NW.Event.removeHandler(element, type, handleListeners, capture || false);
            delete Listeners[type];
          }
        }
        return this;
      },


    // append an event delegate
    appendDelegate:
      // with iframes pass a delegate parameter
      function(selector, type, handler, delegate) {
        var key;
        // "delegate" defaults to documentElement
        delegate = delegate || document.documentElement;
        Delegates[type] || (Delegates[type] = {
          elements: [],
          funcs: [],
          parms: []
        });
        // if delegate is not already registered
        if ((key = isRegistered(Delegates[type], selector, type, handler, delegate)) === false) {
          // append delegate to the chain
          Delegates[type].elements.push(selector);
          Delegates[type].funcs.push(handler);
          Delegates[type].parms.push(delegate);
          // if first delegate for this event type
          if (Delegates[type].elements.length == 1) {
            // append the real event lisyener for this chain
            NW.Event.appendListener(delegate, type, handleDelegates, true);
          }
        }
        return this;
      },

    // remove an event delegate
    removeDelegate:
      // with iframes pass a delegate parameter
      function(selector, type, handler, delegate) {
        var key;
        // "delegate" defaults to documentElement
        delegate = delegate || document.documentElement;
        // if delegate is found to be registered
        if ((key = isRegistered(Delegates[type], selector, type, handler, delegate)) !== false) {
          // remove delegate from the chain
          Delegates[type].elements.splice(key, 1);
          Delegates[type].funcs.splice(key, 1);
          Delegates[type].parms.splice(key, 1);
          // if last delegate for this event type
          if (Delegates[type].elements.length == 0) {
            delete Delegates[type];
            // remove the real event listener for this chain
            NW.Event.removeListener(delegate, type, handleDelegates, true);
          }
        }
        return this;
      }

  };

}();

// embedded NW.Dom.match() so basic event delegation works,
// overwritten if loading the nwmatcher.js selector engine
NW.Dom = function() {

  var Patterns = {
    id: /#([^\.]+)/,
    tagName: /^([^#\.]+)/,
    className: /\.([^#]+)/,
    all: /^[\.\-\#\w]+$/
  };

  return {
    // use a simple selector match or a full
    // CSS3 selector engine if it is available
    match:
      function(element, selector) {
        var j, id, doc, length, results, tagName, className, match, matched = false;
        doc = (element.ownerDocument || element.document || element);
        if (typeof selector == 'string') {
          if (typeof doc.querySelectorAll != 'undefined') {
            try {
              results = doc.querySelectorAll(selector);
            } catch(e) {
              results = [];
            }
            length = results.length;
            while (length--) {
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
              (!tagName || tagName == '*' || tagName == element.nodeName.toLowerCase()) &&
              (!className || (' ' + element.className + ' ').replace(/\s\s+/g,' ').indexOf(' ' + className + ' ') > -1)) {
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

}();
