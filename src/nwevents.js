/*
 * Copyright (C) 2005-2009 Diego Perini
 * All rights reserved.
 *
 * nwevents.js - Javascript Event Manager
 *
 * Author: Diego Perini <diego.perini at gmail com>
 * Version: 1.2.4beta
 * Created: 20051016
 * Release: 20100302
 *
 * License:
 *  http://javascript.nwbox.com/NWEvents/MIT-LICENSE
 * Download:
 *  http://javascript.nwbox.com/NWEvents/nwevents.js
 */

(function(global, undefined) {

  var version = 'nwevents-1.2.4beta',

  // default to DOM2
  USE_DOM2 = true,

  // event phases constants
  CUSTOM = 0, CAPTURING_PHASE = 1, AT_TARGET = 2, BUBBLING_PHASE = 3,

  // event collections and predefined DOM0 register
  DOMEvents = { }, Delegates = { }, Listeners = { }, Predefined = { },

  // event subscriptions register
  Registers = { },

  // initial script load context
  viewport = global, context = global.document, root = context.documentElement,

  Keyboard_Events = {
    // keypress deprecated in favor of textInput
    keypress: 1, keydown: 1, keyup: 1
  },

  Mouse_Events = {
    // contextmenu is a non standard event
    contextmenu: 1,
    // dblclick is a non standard event
    click: 1, dblclick: 1,
    mouseout: 1, mouseover: 1,
    mouseenter: 1, mouseleave: 1,
    mousemove: 1, mousedown: 1, mouseup: 1
  },

  Touch_Events = {
    touchup: 1, touchdown: 1,
    // touch devices like iPhone/iPod
    touchend: 1, touchmove: 1, touchstart: 1, touchcancel: 1,
    gestureend: 1, gesturemove: 1, gesturestart: 1, gesturecancel: 1
  },

  Text_Events = {
    // input/textarea elements
    textInput: 1, keydown: 1, keyup: 1
  },

  UI_Events = {
    // keyboard focus and activation events
    blur: 1, focus: 1, focusin: 1, focusout: 1,
    DOMActivate: 1, DOMFocusIn: 1, DOMFocusOut: 1
  },

  Events = {
    // host objects and binary content related
    abort: 1, error: 1,
    load: 1, unload: 1, resize: 1, scroll: 1,
    // forms and control elements related
    change: 1, input: 1, select: 1, reset: 1, submit: 1
  },

  EventCollection =
    function() {
      return {
        items: [],
        calls: [],
        parms: [],
        wraps: []
      };
    },

  /* ============================ FEATURE TESTING =========================== */

  implementation = context.implementation ||
    { hasFeatures: function() { return false; } },

  // detect activation capabilities,
  // Firefox 3+, Safari 3+, Opera 9+, IE
  hasActive = 'activeElement' in context ?
    (function() {
      try {
        return (context.activeElement = null) || true;
      } catch(e) {
        return false;
      }
    }) : true,

  hasFeature =
    function(t, v) {
      return implementation.hasFeature(t, v || '');
    },

  hasInterface = hasFeature('Events', '') ?
    function (t) {
      try {
        return typeof context.createEvent(t)['init' + t] == 'function';
      } catch (e) {
        return false;
      }
    } :
    function (t) {
      return false;
    },

  // detect native methods
  isNative = (function() {
    var s = (global.open + '').replace(/open/g, '');
    return function(object, method) {
      var m = object ? object[method] : false, r = new RegExp(method, 'g');
      return !!(m && typeof m != 'string' && s === (m + '').replace(r, ''));
    };
  })(),

  // detect event model in use
  W3C_MODEL =
    isNative(root, 'addEventListener') &&
    isNative(root, 'removeEventListener') &&
    isNative(context, 'createEvent'),

  MSIE_MODEL = !W3C_MODEL &&
    isNative(root, 'attachEvent') &&
    isNative(root, 'detachEvent') &&
    isNative(context, 'createEventObject'),

  SUPPORT_EVENTS = hasInterface('Event'),

  SUPPORT_UI_EVENTS = hasInterface('UIEvent'),

  SUPPORT_TEXT_EVENTS = hasInterface('TextEvent'),

  SUPPORT_TOUCH_EVENTS = hasInterface('TouchEvent'),

  SUPPORT_MOUSE_EVENTS = hasInterface('MouseEvent'),

  SUPPORT_KEYBOARD_EVENTS = hasInterface('KeyboardEvent'),

  // non standard Firefox KeyEvent
  SUPPORT_KEY_EVENTS = 'KeyEvent' in global &&
    typeof KeyEvent.prototype.initEvent == 'function',

  KEYBOARD_FIX = SUPPORT_KEYBOARD_EVENTS ? '' : 's',

  KEYBOARD_EVENT = SUPPORT_KEY_EVENTS ? 'KeyEvent' :
    SUPPORT_KEYBOARD_EVENTS ? 'KeyboardEvent' :
    SUPPORT_UI_EVENTS ? 'UIEvent' : 'Event',
  // end non standard...

  testTarget =
    context.createDocumentFragment().
      appendChild(context.createElement('div')),

  supportedEvents = { },

  isEventSupported = W3C_MODEL ?
    function(type, element) {
      return true;
    } : MSIE_MODEL ?
    function(type, element) {

      if (supportedEvents[type] !== undefined) {
        return supportedEvents[type];
      }

      try {
        (element || testTarget).fireEvent('on' + type);
        supportedEvents[type] = true;
      } catch (e) {
        supportedEvents[type] = false;
      }

      return supportedEvents[type];
    } :
    function () { },

  /* =========================== TRIGGER HANDLERS =========================== */

  TRIGGER_EVENT = 'onhelp',

  trigger = function() { },
  triggerArguments = null,
  triggerCallback = null,
  triggerEnabled = false,

  triggerTarget =
    context.createDocumentFragment().
      appendChild(context.createElement('div')),

  triggerEvent = W3C_MODEL ?
    (function() {
      var event = context.createEvent('Event');
      event.initEvent(TRIGGER_EVENT, true, true);
      return event;
    })() :
    (function() {
      var event = context.createEventObject();
      event.type = 'onhelp';
      event.bubbles = true;
      event.cancelable = true;
      return event;
    })(),

  triggerEnable = W3C_MODEL ?
    function(enable) {
      triggerSet();
      if ((triggerEnabled = !!enable)) {
        triggerTarget.addEventListener(TRIGGER_EVENT, triggerExec, false);
      } else {
        triggerTarget.removeEventListener(TRIGGER_EVENT, triggerExec, false);
      }
    } : MSIE_MODEL ?
    function(enable) {
      triggerSet();
      if ((triggerEnabled = !!enable)) {
        triggerTarget.attachEvent(TRIGGER_EVENT, triggerExec);
      } else {
        triggerTarget.detachEvent(TRIGGER_EVENT, triggerExec);
      }
    } :
    function(enable) {
      triggerSet();
      triggerEnabled = !!enable;
    },

  triggerExec =
    function() {
      if (typeof triggerCallback == 'function') {
        triggerCallback.call(triggerArguments[0], triggerArguments[1]);
      }
    },

  triggerSet =
    function() {
      trigger = W3C_MODEL && triggerEnabled ?
        function(callback, args) {
          triggerArguments = args;
          triggerCallback = callback;
          triggerEvent.initEvent(TRIGGER_EVENT, true, true);
          triggerTarget.dispatchEvent(triggerEvent);
        } : MSIE_MODEL && triggerEnabled ?
        function(callback, args) {
          triggerArguments = args;
          triggerCallback = callback;
          triggerEvent.bubbles = true;
          triggerEvent.cancelable = true;
          triggerTarget.fireEvent(TRIGGER_EVENT, triggerEvent);
        } :
        function(callback, args) {
          callback.call(args[0], args[1]);
        };
    },

  /* ============================ UTILITY METHODS =========================== */

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

  // process listeners chain for event type
  processListeners =
    function(event) {
      var i, l, result = true,
        items, calls, parms, phase,
        type = event.type, valid;

      if (Listeners[type] && Listeners[type].items) {

        // cache eventPhase access
        phase = event.eventPhase;

        if (!event.propagated && FormActivationEvents[type]) {
          if (event.preventDefault) event.preventDefault();
          else event.returnValue = false;
          return true;
        }

        // only AT_TARGET event.target === event.currentTarget
        if (phase !== AT_TARGET && event.target === this) {
          if (event.propagated && phase == CAPTURING_PHASE) return true;
          phase = event.eventPhase = AT_TARGET;
        }

        // make a copy of the Listeners[type] array
        // since it can be modified run time by the
        // events deleting themselves or adding new
        items = Listeners[type].items.slice();
        calls = Listeners[type].calls.slice();
        parms = Listeners[type].parms.slice();

        // process chain in fifo order
        for (i = 0, l = items.length; l > i; i++) {
          valid = false;
          if (items[i] === this) {
            switch (phase) {
              case CAPTURING_PHASE:
                if (!!parms[i]) {
                  valid = true;
                }
                break;
              case BUBBLING_PHASE:
                if (!parms[i]) {
                  valid = true;
                }
                break;
              case AT_TARGET:
                // maybe paranoid but helped spot bugs
                // TODO: remove all AT_TARGET case :-)
                if (typeof parms[i] === 'boolean') {
                  valid = true;
                }
                break;
              // Safari load events have eventPhase == 0
              default:
                valid = true;
                break;
            }
          }
          if (valid && (result = calls[i].call(this, event)) === false) break;
        }

      }

      return result;
    },

  // process delegates chain for event type
  processDelegates =
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

  // register an event instance and its parameters
  register =
    function(registry, element, type, handler, capture) {
      // registry is a reference to an EventCollection
      registry[type] || (registry[type] = new EventCollection);
      // append instance parameters to the registry
      registry[type].items.push(element);
      registry[type].calls.push(handler);
      registry[type].parms.push(capture);
    },

  // unregister an event instance and its parameters
  unregister =
    function(registry, type, key) {
      // remove instance parameters from the registry
      registry[type].items.splice(key, 1);
      registry[type].calls.splice(key, 1);
      registry[type].parms.splice(key, 1);
    },

  // lazy definition for addEventListener / attachEvent
  append = W3C_MODEL && USE_DOM2 ?
    function(element, type, handler, capture) {
      // use DOM2 event registration
      element.addEventListener(type, handler, capture || false);
    } : MSIE_MODEL && USE_DOM2 ?
    function(element, type, handler, capture) {
      // use MSIE event registration
      var key = DOMEvents[type].wraps.push(function(event) {
        return handler.call(element, fixEvent(element, event, capture));
      });
      element.attachEvent('on' + type, DOMEvents[type].wraps[key - 1]);
    } :
    function(element, type, handler, capture) {
      Predefined['on' + type] = element['on' + type] || new Function();
      // use DOM0 event registration
      element['on' + type] = function(event) {
        var result;
        event || (event = fixEvent(this, event, capture));
        result = handler.call(this, event);
        Predefined['on' + type].call(this, event);
        return result;
      };
    },

  // lazy definition for removeEventListener / detachEvent
  remove = W3C_MODEL && USE_DOM2 ?
    function(element, type, handler, capture) {
      // use DOM2 event registration
      element.removeEventListener(type, handler, capture || false);
    } : MSIE_MODEL && USE_DOM2 ?
    function(element, type, handler, capture, key) {
      // use MSIE event registration
      element.detachEvent('on' + type, handler);
      DOMEvents[type].wraps.splice(key, 1);
    } :
    function(element, type, handler, capture) {
      // use DOM0 event registration
      element['on' + type] = Predefined['on' + type];
      delete Predefined['on' + type];
    },

  // append an event handler
  set =
    function(element, type, handler, capture) {
      var i, k, l, types;
      if (typeof type == 'string') {
        types = type.split(' ');
        for (i = 0, l = types.length; i < l; i++) {
          k = isRegistered(DOMEvents, element, types[i], handler, capture);
          if (k === false) {
            register(DOMEvents, element, types[i], handler, capture);
            append(element, types[i], handler, capture);
          }
        }
      } else {
        // a hash of "rules" containing type-handler pairs
        for (i in type) {
          set(element, i, type[i], capture);
        }
      }
      return this;
    },

  // remove an event handler
  unset =
    function(element, type, handler, capture) {
      var i, k, l, types;
      if (typeof type == 'string') {
        types = type.split(' ');
        for (i = 0, l = types.length; i < l; i++) {
          k = isRegistered(DOMEvents, element, types[i], handler, capture);
          if (k !== false) {
            remove(element, types[i], DOMEvents[types[i]].wraps[k], capture, k);
            unregister(DOMEvents, types[i], k);
          }
        }
      } else {
        // a hash of "rules" containing type-handler pairs
        for (i in type) {
          unset(element, i, type[i], capture);
        }
      }
      return this;
    },

  // append an event listener
  listen =
    function(element, type, handler, capture) {
      var i, k, l, types;
      if (typeof type == 'string') {
        types = type.split(' ');
        for (i = 0, l = types.length; i < l; i++) {
          k = isRegistered(Listeners, element, types[i], handler, capture);
          if (k === false) {
            register(Listeners, element, types[i], handler, capture);
            if (getRegistered(element, types[i], Listeners).length === 1) {
              set(element, types[i], processListeners, capture);
            }
          }
        }
      } else {
        // a hash of "rules" containing type-handler pairs
        for (i in type) {
          listen(element, i, type[i], capture);
        }
      }
      return this;
    },

  // remove an event listener
  unlisten =
    function(element, type, handler, capture) {
      var i, k, l, types;
      if (typeof type == 'string') {
        types = type.split(' ');
        for (i = 0, l = types.length; i < l; i++) {
          k = isRegistered(Listeners, element, types[i], handler, capture);
          if (k !== false) {
            if (getRegistered(element, types[i], Listeners).length === 1) {
              unset(element, types[i], processListeners, capture);
            }
            unregister(Listeners, types[i], k);
          }
        }
      } else {
        // a hash of "rules" containing type-handler pairs
        for (i in type) {
          unlisten(element, i, type[i], capture);
        }
      }
      return this;
    },

  // append an event delegate
  delegate =
    // with iframes pass a delegate parameter
    // "delegate" defaults to documentElement
    function(selector, type, handler, delegate) {
      var i, j, k, l, types;
      if (typeof selector == 'string') {
        types = type.split(' ');
        delegate = delegate || context;
        for (i = 0, l = types.length; i < l; i++) {
          k = isRegistered(Delegates, selector, types[i], handler, delegate);
          if (k === false) {
            register(Delegates, selector, types[i], handler, delegate);
            if (Delegates[types[i]].items.length === 1) {
              listen(delegate, types[i], processDelegates, true);
            }
          }
        }
      } else {
        // a hash of "rules" containing selector-event-handler
        for (i in selector) {
          if (typeof i == 'string') {
            for (j in selector[i]) {
              delegate(i, j, selector[i][j]);
            }
          }
        }
      }
      return this;
    },

  // remove an event delegate
  undelegate =
    // with iframes pass a delegate parameter
    // "delegate" defaults to documentElement
    function(selector, type, handler, delegate) {
      var i, j, k, l, types;
      if (typeof type == 'string') {
        types = type.split(' ');
        delegate = delegate || context;
        for (i = 0, l = types.length; i < l; i++) {
          k = isRegistered(Delegates, selector, types[i], handler, delegate);
          if (k !== false) {
            if (Delegates[types[i]].items.length === 1) {
              unlisten(delegate, types[i], processDelegates, true);
            }
            unregister(Delegates, types[i], k);
          }
        }
      } else {
        // hash of "rules" containing selector-event-handler
        for (i in selector) {
          if (typeof i == 'string') {
            for (j in selector[i]) {
              undelegate(i, j, selector[i][j]);
            }
          }
        }
      }
      return this;
    },

  // dispatch native or custom events to registered listeners
  // this is performed using native DOM Event API if possible
  // so the event propagates to other DOM listening instances
  dispatch = root.dispatchEvent ?
    // W3C event model
    function(element, type, capture, options) {
      var event, d = getDocument(element), view = getWindow(d).defaultView;

      options || (options = { });

      if (SUPPORT_MOUSE_EVENTS && Mouse_Events[type]) {

        event = d.createEvent('MouseEvent');
        event.initMouseEvent(type,
          options.bubbles || true, options.cancelable || true, view,
          options.detail || 0, options.screenX || 0, options.screenY || 0, options.clientX || 0, options.clientY || 0,
          options.ctrlKey || false, options.altKey || false, options.shiftKey || false, options.metaKey || false,
          options.button || 0, options.relatedTarget || null);

      } else if (SUPPORT_KEYBOARD_EVENTS || SUPPORT_KEY_EVENTS && Keyboard_Events[type]) {

        event = d.createEvent(KEYBOARD_EVENT + KEYBOARD_FIX);
        event['init' + KEYBOARD_EVENT](type,
          options.bubbles || true, options.cancelable || true, view,
          /* DOM3 KeyboardEvent: option.keyIndentifier || '', option.keyLocation || 0, option.modifierList || '' */
          options.ctrlKey || false, options.altKey || false, options.shiftKey || false, options.metaKey || false,
          options.keyCode || 0, options.charCode || 0);

      } else if (SUPPORT_TOUCH_EVENTS && Touch_Events[type]) {

        event = d.createEvent('TouchEvent');
        event.initTouchEvent(type,
          options.bubbles || true, options.cancelable || true, view,
          options.detail || 0, options.screenX || 0, options.screenY || 0, options.clientX || 0, options.clientY || 0,
          options.ctrlKey || false, options.altKey || false, options.shiftKey || false, options.metaKey || false,
          options.touches || [ ], options.targetTouches || [ ], options.changedTouches || [ ],
          options.scale || 1.0, options.rotation || 0.0);

      } else if (SUPPORT_UI_EVENTS && UI_Events[type]) {

        event = d.createEvent('UIEvent');
        event.initUIEvent(type, options.bubbles || true, options.cancelable || true, view, options.detail);

      } else if (SUPPORT_EVENTS) {

        event = d.createEvent('Event');
        event.initEvent(type, options.bubbles || true, options.cancelable || true);

      }

      return element.dispatchEvent(event);
    } : root.fireEvent ?
    // IE event model
    function(element, type, capture, options) {

      if (isEventSupported(type)) {
        var event = getDocument(element).createEventObject();
        event.type = type;
        event.target = element;
        event.eventPhase = CUSTOM;
        event.currentTarget = element;
        event.cancelBubble= !!capture;
        event.returnValue= undefined;
        for (var i in options) event[i] = options[i];
        return element.fireEvent('on' + type, fixEvent(element, event, capture));
      }

      return notify(element, type, capture, options || { });
    } :
    // try manual dispatch
    function(element, type, capture, options) {
      return notify(element, type, capture, options || { });
    },

  // notify registered listeners an event occurred
  notify =
    function(element, type, capture, options) {
      if (typeof capture != 'undefined') {
        return propagatePhase(element, type, !!capture);
      }
      return (propagatePhase(element, type, true) &&
        propagatePhase(element, type, false));
    },

  // register a subscriber for event publication
  subscribe =
    function(object, type, callback, capture, options) {
      var k = isRegistered(Registers, object, type, callback, capture);
      if (k === false) register(Registers, object, type, callback, capture);
    },

  // unregister a subscriber from event publication
  unsubscribe =
    function(object, type, callback, capture, options) {
      var k = isRegistered(Registers, object, type, callback, capture);
      if (k !== false) unregister(Registers, type, k);
    },

  // publish an event to registered subscribers
  // TODO: make callbacks fire asynchronously
  publish =
    function(object, type, data, capture, options) {
      var i, event, list = Registers[type];
      for (i = 0, l = list.calls.length; l > i; i++) {
        event = synthesize(object, type, list.parms[i], options);
        if (data) event.data = data;
        event.currentTarget = list.items[i];
        if (typeof trigger == 'function') {
          trigger(list.calls[i], [object, event]);
        } else {
          list.calls[i].call(object, event);
        }
      }
    },

  /* =========================== EVENT PROPAGATION ========================== */

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
    function(element, type, capture, options) {
      var event = {
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
      for (var i in options) event[i] = options[i];
      return event;
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
      unset(target, type, propagate, false);
      // submit/reset events relayed to parent forms
      if (target.form) { target = target.form; }
      // execute existing native methods if not overwritten
      result && isNative(target, type) && target[type]();
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
      event.propagated = true;
      // collect ancestors
      while(node) {
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
        if (processListeners.call(ancestors[i], event) === false || event.returnValue === false) {
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
      var target = event.target, type = target.type,
        active = target.ownerDocument.activeElement;
      // handle activeElement on context document
      if (target != active) {
        if (!hasActive && target.nodeType == 1) {
          target.ownerDocument.activeElement = target;
        }
      }
      // html form elements only
      if (type) {
        // keydown or mousedown on form elements
        if (/^(file|text|password)$/.test(type) &&
          event.keyCode == 13 && target.form) {
          type = 'submit';
          target = target.form;
        } else if (/^(select-(one|multi)|text|textarea)$/.test(type)) {
          type = 'change';
        } else if (/^(reset|submit)$/.test(type) && target.form) {
          target = target.form;
        } else {
          // action was on a form element but
          // no extra processing is necessary
          return;
        }
        set(target, type, propagate, false);
      }
    },

  // enable event propagation
  enablePropagation =
    function(context) {
      if (!context.forcedPropagation) {
        context.forcedPropagation = true;
        // deregistration on page unload
        set(getWindow(context), 'unload',
          function(event) {
            disablePropagation(context);
            // we are removing ourself here, so do it as last
            unset(this, 'unload', arguments.callee, false);
          }, false);
        // register capturing keydown and mousedown event handlers
        set(context, FormAction, propagateFormAction, true);
        // register emulated capturing focus and blur event handlers
        set(context, Activation, propagateActivation, true);
      }
    },

  // disable event propagation
  disablePropagation =
    function(context) {
      if (context.forcedPropagation) {
        context.forcedPropagation = false;
        // deregister capturing keydown and mousedown event handlers
        unset(context, FormAction, propagateFormAction, true);
        // deregister emulated capturing focus and blur event handlers
        unset(context, Activation, propagateActivation, true);
      }
    },

  /* ========================== DOM CONTENT LOADED ========================== */

  //
  // available loading notification events:
  //
  // HTML5 + DOM2 FF/Opera/Safari/K:
  //   DOMContentLoaded, DOMFrameContentLoaded, onload
  //
  // MS Internet Explorer 6, 7 and 8:
  //   readyState, onreadystatchange, onload
  //
  // DOM0/1 and inline:
  //   onload
  //
  // we use a bad browser sniff just to find out the best
  // implementation/fallback for each of the old browsers
  // to support the standard HTML5 DOMContentLoaded event
  // http://www.whatwg.org/specs/web-apps/current-work/#the-end
  //

  isReady = false,

  readyHandlers = new EventCollection,

  ready =
    function(host, callback, scope) {
      if (isReady) {
        callback.call(scope);
      } else {
        var k = isRegistered(readyHandlers, host, 'ready', callback, null);
        if (k === false) {
          register(readyHandlers, host, 'ready', callback, null);
        } else {
          throw new Error('NWEvents: duplicate ready handler for host: ' + host);
        }
      }
    },

  complete =
    function(host, callback, scope) {
      isReady = true;
      if (readyHandlers['ready'] && readyHandlers['ready'].items) {
        var i, length = readyHandlers['ready'].items.length;
        for (i = 0; length > i; ++i) {
          readyHandlers['ready'].calls[i].call(scope);
        }
      }
    },

  // Cross-browser wrapper for DOMContentLoaded
  // http://javascript.nwbox.com/ContentLoaded/ +
  // http://javascript.nwbox.com/IEContentLoaded/
  contentLoaded =
    function(host, callback, scope) {

      var d = host.document,
        done = false, size = 0,
        root = d.documentElement,
        W3Type = 'DOMContentLoaded',
        MSType = 'onreadystatechange';

      function init(event) {
        if (!done) {
          done = true;
          callback.call(scope, event);
        }
      }

      // W3C Event model
      if (d.addEventListener) {

        // browsers having native DOMContentLoaded
        function DOMContentLoaded(event) {
          d.removeEventListener(event.type, DOMContentLoaded, false);
          init(event);
        }
        d.addEventListener(W3Type, DOMContentLoaded, false);

        // onload fall back for older browsers
        host.addEventListener('load', DOMContentLoaded, false);

      // MSIE Event model (all versions)
      } else if (
        isNative(d, 'createEventObject') &&
        isNative(d, 'attachEvent') &&
        isNative(d, 'detachEvent')) {

        if (isNative(root, 'doScroll')) {

          function IEContentLoaded(event) {
            d.detachEvent(MSType, IEContentLoaded);
            function poll() {
              try {
                // throws errors until after ondocumentready
                root.doScroll('left');
                size = root.outerHTML.length;
                if (size * 1.03 < d.fileSize * 1) {
                  return !done && setTimeout(poll, 50);
                }
              } catch (e) {
                return !done && setTimeout(poll, 50);
              }
              init({ type: 'poll' });
              return done;
            }
            poll();
          }

          // start polling after first readyStateChange event
          d.attachEvent(MSType, IEContentLoaded);

        }

        function IEReadyState(event) {
          if (d.readyState == 'complete') {
            d.detachEvent('on' + event.type, IEReadyState);
            init(event);
          }
        }

        d.attachEvent(MSType, IEReadyState);
        host.attachEvent('onload', IEReadyState);

      // fallback to last resort for older browsers
      } else {

        // from Simon Willison
        var oldonload = host.onload;
        host.onload = function (event) {
          init(event || host.event);
          if (typeof oldonload == 'function') {
            oldonload(event || host.event);
          }
        };

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

  // initialize context execution
  if (typeof trigger == 'function') {
    triggerEnable(false);
  }

  // initialize global ready event
  contentLoaded(global, complete);

  global.NW || (global.NW = { });

  NW.Event || (NW.Event = {

    // controls the type of registration
    // for event listeners (DOM0 / DOM2)
    USE_DOM2: USE_DOM2,

    // exposed event collections
    Registers: Registers,
    Delegates: Delegates,
    Listeners: Listeners,
    DOMEvents: DOMEvents,

    // exposed event methods
    stop: stop,
    ready: ready,

    notify: notify,
    publish: publish,
    dispatch: dispatch,

    set: set,
    append: append,
    listen: listen,
    delegate: delegate,
    subscribe: subscribe,

    unset: unset,
    remove: remove,
    unlisten: unlisten,
    undelegate: undelegate,
    unsubscribe: unsubscribe,

    contentLoaded: contentLoaded,
    getRegistered: getRegistered,

    // back compat aliases
    appendHandler: set,
    removeHandler: unset,

    appendListener: listen,
    removeListener: unlisten,

    appendDelegate: delegate,
    removeDelegate: undelegate,

    // helpers and debugging functions
    isEventSupported: isEventSupported,

    enablePropagation: enablePropagation,
    disablePropagation: disablePropagation

  });

})(this);

// embedded NW.Dom.match() so basic event delegation works,
// overwritten if loading the nwmatcher.js selector engine
(function(global, undefined) {

  var Patterns = {
    'id': /#([^\.]+)/,
    'tagName': /^([^#\.]+)/,
    'className': /\.([^#]+)/,
    'all': /^[\.\-\#\w]+$/
  };

  global.NW || (global.NW = { });

  NW.Dom = ({
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

  });

})(this);
