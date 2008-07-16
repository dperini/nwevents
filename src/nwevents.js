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

window.NW||(window.NW={});

NW.Event=function(){

	var version='1.09',
		release='20080624',

	H={},
	D={},
	L={},

	E={
		'A':/^[\.\-\#\w]+$/,
		'T':/^([^#\.]+)/,
		'I':/#([^\.]+)/,
		'C':/\.([^#]+)/
	},

	forcedPropagation=false,

	CAPTURING_PHASE=1,AT_TARGET=2,BUBBLING_PHASE=3,

	fixEvent=
		function(o,e,c){
			e||(e=getContext(o).event);
			e.currentTarget=o;
			e.target=e.srcElement||o;
			e.preventDefault=preventDefault;
			e.stopPropagation=stopPropagation;
			e.eventPhase=
				c&&(e.target==o)?CAPTURING_PHASE:
					(e.target==o?AT_TARGET:BUBBLING_PHASE);
			e.relatedTarget=
				e[(e.target==e.fromElement?'to':'from')+'Element'];
			e.timeStamp=+new Date();
			return e;
		},

	preventDefault=
		function(){
			this.returnValue=false;
		},
	
	stopPropagation=
		function(){
			this.cancelBubble=true;
		},

	getContext=
		function(o){
			return (o.ownerDocument||o.document||o).parentWindow||window;
		},

	isRegistered=
		function(a,o,t,h,c){
			var i,l,f=false;
			if(a&&a.o){
				for(i=0,l=a.o.length;l>i;i++){
					if(a.o[i]===o&&
						a.f[i]===h&&
						a.p[i]===c){
						f=i;
						break;
					}
				}
			}
			return f;
		},

	handleListeners=
		function(e){
			var i,l,h,
				o,f,p,
				r=true,
				t=e.type;
			if(forcedPropagation){
				if(/focus|blur|change|reset|submit/i.test(e.type)&&!e.propagated){
					if(e.preventDefault){
						e.preventDefault();
					}else{
						e.returnValue=false;
					}
					return false;
				}
			}
			if(L[t]&&L[t].o){
				o=L[t].o.slice();
				f=L[t].f.slice();
				p=L[t].p.slice();
				for(i=0,l=o.length;l>i;i++){
					if(o[i]===this
						&&(
							(e.eventPhase==BUBBLING_PHASE&&p[i]==false)||
							(e.eventPhase==CAPTURING_PHASE&&p[i]==true)||
							!e.propagated
						)
					){
						if(e.propagated&&e.target===this){
							e.eventPhase=AT_TARGET;
						}
						if(f[i].call(this,e)===false){
							r=false;
							break;
						}
					}
				}
			}
			return r;
		},

	handleDelegates=
		function(e){
			var i,l,
				o,f,p,
				r=true,
				t=e.type;
			if(D[t]&&D[t].o){
				o=D[t].o.slice();
				f=D[t].f.slice();
				p=D[t].p.slice();
				for(i=0,l=o.length;l>i;i++){
					if(match(e.target,o[i])&&p[i]===this){
						if(f[i].call(e.target,e)===false){
							r=false;
							break;
						}
					}
				}
			}
			return r;
		},

	match=
		function(e,s){
			var i,j,l,r,
				M,T,I,C,
				m=false,
				n=e.nodeName.toLowerCase(),
				c=(' '+e.className+' ').replace(/\s\s+/g,' ');
			if(typeof s=='string'){
				if(NW.Dom&&typeof NW.Dom.match=='function'){
					if(NW.Dom.match(e,s)){
						m=true;
					}
				}else if(s.match(E['A'])){
					M=s.match(E['T']);T=M?M[1]:'*';
					M=s.match(E['I']);I=M?M[1]:null;
					M=s.match(E['C']);C=M?M[1]:null;
					if(((!T||T=='*'||T==n)&&
						(!I||I==e.target.id)&&
						(!C||c.indexOf(' '+C+' ')>-1))){
						m=true;
					}
				}
			}else{
				if(s!=e){
					for(j in s){
						if(j=='nodeName'){
							if(s[j].toLowerCase()==n){
								m=true;
								break;
							}
						}else if(j=='className'){
							if(c.indexOf(' '+s[j]+' ')>-1){
								m=true;
								break;
							}
						}else{
							if(s[j]===e[j]){
								m=true;
								break;
							}
						}
					}
				}
			}
			return m;
		},

	synthesize=
		function(o,t,c){
			return {
				type:t,
				target:o,
				bubbles:true,
				cancelable:true,
				currentTarget:o,
				relatedTarget:null,
				timeStamp:+new Date(),
				preventDefault:preventDefault,
				stopPropagation:stopPropagation,
				eventPhase:c?CAPTURING_PHASE:BUBBLING_PHASE
			};
		},

	propagate=
		function(e){
			var r=true,t=e.target||e.srcElement;
			t['__'+e.type]=false;
			NW.Event.removeHandler(t,e.type,arguments.callee,false);
			r&&(r=propagatePhase(t,e.type,true));
			r&&(r=propagatePhase(t,e.type,false));
			r&&t[e.type]&&t[e.type]();
			return r;
		},

	propagatePhase=
		function(o,t,c){
			var i,l,
				r=true,
				n=o,p=[],
				e=synthesize(o,t,c);
			e.propagated=true;
			while(n){
				p.push(n);
				n=n.parentNode;
			}
			l=p.length;
			if(c)p.reverse();
			for(i=0;l>i;i++){
				e.currentTarget=p[i];
				e.eventPhase=c?CAPTURING_PHASE:BUBBLING_PHASE;
				if(handleListeners.call(p[i],e)===false||e.returnValue===false){
					r=false;
					break;
				}
			}
			delete e.propagated;
			return r;
		},

	propagateActivation=
		function(e){
			var r=true,t=e.target;
			r&&(r=propagatePhase(t,e.type,true));
			r&&(r=propagatePhase(t,e.type,false));
			r||e.preventDefault();
			return r;
		},

	propagateIEActivation=
		function(e){
			var r=true,t=e.srcElement;
			if(e.type=='beforedeactivate'){
				r&&(r=propagatePhase(t,'blur',true));
				r&&(r=propagatePhase(t,'blur',false));
			}
			if(e.type=='beforeactivate'){
				r&&(r=propagatePhase(t,'focus',true));
				r&&(r=propagatePhase(t,'focus',false));
			}
			r||(e.returnValue=false);
			return r;
		},

	propagateFormAction=
		function(e){
			var t=e.target||e.srcElement,T=t.type;
			if(/file|text|password/.test(T)&&e.keyCode==13){
					T='submit';
					t=t.form;
			}else if(/select-(one|multi)/.test(T)){
					T='change';
			}else if(/reset|submit/.test(T)){
					t=t.form;
			}
			if(t&&!t['__'+T]){
				t['__'+T]=true;
				NW.Event.appendHandler(t,T,propagate,false);
			}
		},

	enablePropagation=
		function(o){
			var w=getContext(o),d=w.document;
			if(!forcedPropagation){
				forcedPropagation=true;
				NW.Event.appendHandler(w,'unload',
					function(e){
						NW.Event.removeListener(w,e.type,arguments.callee,false);
						disablePropagation(o);
					},false
				);
				NW.Event.appendHandler(d,'click',propagateFormAction,true);
				NW.Event.appendHandler(d,'keyup',propagateFormAction,true);
				if(d.addEventListener){
					NW.Event.appendHandler(d,'blur',propagateActivation,true);
					NW.Event.appendHandler(d,'focus',propagateActivation,true);
				}else if(d.attachEvent){
					NW.Event.appendHandler(d,'beforeactivate',propagateIEActivation,true);
					NW.Event.appendHandler(d,'beforedeactivate',propagateIEActivation,true);
				}
			}
		},

	disablePropagation=
		function(o){
			var w=getContext(o),d=w.document;
			if(forcedPropagation){
				forcedPropagation=false;
				NW.Event.removeHandler(d,'click',propagateFormAction,true);
				NW.Event.removeHandler(d,'keyup',propagateFormAction,true);
				if(d.removeEventListener){
					NW.Event.removeHandler(d,'blur',propagateActivation,true);
					NW.Event.removeHandler(d,'focus',propagateActivation,true);
				}else if(d.detachEvent){
					NW.Event.removeHandler(d,'beforeactivate',propagateIEActivation,true);
					NW.Event.removeHandler(d,'beforedeactivate',propagateIEActivation,true);
				}
			}
		};

	return {

		EVENTS_W3C:true,

		stop:
			function(e){
				if(e.preventDefault){
					e.preventDefault();
				}else{
					e.returnValue=false;
				}
				if(e.stopPropagation){
					e.stopPropagation();
				}else{
					e.cancelBubble=true;
				}
				return false;
			},

		dispatch:
			function(o,t,c){
				var e,r,d=getContext(o).document;
				if(o.fireEvent){
					e=d.createEventObject();
					e.type=t;
					e.target=o;
					e.eventPhase=0;
					e.currentTarget=o;
					e.cancelBubble=!!c;
					e.returnValue=undefined;
					r=o.fireEvent('on'+t,fixEvent(o,e,c));
				}else{
					if(/mouse|click/.test(t)){
						e=d.createEvent('MouseEvents');
						e.initMouseEvent(t,true,true,window,0,0,0,0,0,false,false,false,false,0,null);
					}else if(/key(down|press|out)/.test(t)){
						e=d.createEvent('KeyEvents');
						e.initKeyEvent(t,true,true,window,false,false,false,false,0,0);
					}else{
						e=d.createEvent('HTMLEvents');
						e.initEvent(t,true,true);
					}
					r=o.dispatchEvent(e);
				}
				return r;
			},

		appendHandler:
			function(o,t,h,c){
				var k;
				H[t]||(H[t]={o:[],f:[],p:[],w:[]});
				if((k=isRegistered(H[t],o,t,h,c))===false){
					H[t].o.push(o);
					H[t].f.push(h);
					H[t].p.push(c);
					if(o.addEventListener&&NW.Event.EVENTS_W3C){
						o.addEventListener(t,h,c||false);
					}else if(o.attachEvent&&NW.Event.EVENTS_W3C){
						k=H[t].w.push(
							function(e){
								return h.call(o,fixEvent(o,e,c));
							}
						);
						o.attachEvent('on'+t,H[t].w[k-1]);
					}else{
						if(H[t].o.length===0){
							if(typeof o['on'+t]=='function'){
								H[t].o.push(o);
								H[t].f.push(o['on'+t]);
								H[t].p.push(c);
							}
							o['on'+t]=
								function(e){
									return h.call(this,fixEvent(this,e,c));
								};
						}
					}
				}
				return this;
			},

		removeHandler:
			function(o,t,h,c){
				var k;
				if(H[t]&&(k=isRegistered(H[t],o,t,h,c))!==false){
					H[t].o.splice(k,1);
					H[t].f.splice(k,1);
					H[t].p.splice(k,1);
					if(o.removeEventListener&&NW.Event.EVENTS_W3C){
						o.removeEventListener(t,h,c||false);
					}else if(o.detachEvent&&NW.Event.EVENTS_W3C){
						o.detachEvent('on'+t,H[t].w[k]);
						H[t].w.splice(k,1);
					}else{
						if(H[t].o.length==1){
							o['on'+t]=H[t].o[0];
							H[t].o.splice(0,1);
							H[t].f.splice(0,1);
							H[t].p.splice(0,1);
						}
					}
					if(H[t].o.length===0){
						delete H[t];
					}
				}
				return this;
			},

		appendListener:
			function(o,t,h,c){
				var k;
				L[t]||(L[t]={o:[],f:[],p:[],w:[]});
				if((k=isRegistered(L[t],o,t,h,c))===false){
					if(!forcedPropagation){
						enablePropagation(o);
					}
					L[t].o.push(o);
					L[t].f.push(h);
					L[t].p.push(c);
					if(o.addEventListener){
						o.addEventListener(t,handleListeners,c||false);
					}else if(o.attachEvent){
						k=L[t].w.push(
							function(e){
								return handleListeners.call(o,fixEvent(o,e,c));
							}
						);
						o.attachEvent('on'+t,L[t].w[k-1]);
					}
				}
				return this;
			},

		removeListener:
			function(o,t,h,c){
				var k;
				if(L[t]&&(k=isRegistered(L[t],o,t,h,c))!==false){
					L[t].o.splice(k,1);
					L[t].f.splice(k,1);
					L[t].p.splice(k,1);
					if(o.removeEventListener){
						o.removeEventListener(t,handleListeners,c||false);
					}else if(o.detachEvent){
						o.detachEvent('on'+t,L[t].w[k]);
						L[t].w.splice(k,1);
					}
					if(L[t].o.length===0){
						delete L[t];
					}
				}
				return this;
			},

		appendDelegate:
			function(o,t,h,d){
				var k;
				d=d||document.documentElement;
				D[t]||(D[t]={o:[],f:[],p:[]});
				if((k=isRegistered(D[t],o,t,h,d))===false){
					D[t].o.push(o);
					D[t].f.push(h);
					D[t].p.push(d);
					if(D[t].o.length===1){
						NW.Event.appendListener(d,t,handleDelegates,true);
					}
				}
				return this;
			},

		removeDelegate:
			function(o,t,h,d){
				var k;
				d=d||document.documentElement;
				if(D[t]&&(k=isRegistered(D[t],o,t,h,d))!==false){
					D[t].o.splice(k,1);
					D[t].f.splice(k,1);
					D[t].p.splice(k,1);
					if(D[t].o.length===0){
						delete D[t];
						NW.Event.removeListener(d,t,handleDelegates,true);
					}
				}
				return this;
			}
	};

}();
