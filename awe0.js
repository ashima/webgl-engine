/*
 * Description : Ring 0 WebGL wrapper.
 *      Author : Ian McEwan, Ashima Arts.
 *    @license : Copyright (C) 2011 Ashima Arts. All rights reserved.
 *               Distributed under the MIT License. See LICENSE file.
 */

var ashimaWebGLEngine0 = new function() {
  var A = this;
  var gl;

  function isDefined(x)   { return (typeof (x) != "undefined") }
  function isUndefined(x) { return (typeof (x) == "undefined") }

  function conOut(s) {
    if (typeof(console)!="undefined")
      console.log(s );
    }

  var glRevLookup = new Object;
  var protogl = window.WebGLRenderingContext;
  for (var i in protogl) 
    glRevLookup[ protogl[i] ] = i ;

  function glThrow( s ) {
    var e = gl.getError();
    if (e)
      throw (s + "(#"+e+" : "+ glRevLookup[e] +")" );
    }


/*
 * WebGL context init part
 */

  var addEvent = (document.addEventListener)
    ? function (e, v, f, c) { e.addEventListener(v,f,c); }
    : function (e, v, f)    { e.attachEvent("on"+v,f); }

  this.getGlContext = function (_c,ops) {
    var c;
    switch (typeof(_c)) {
      case "object": c = _c; break;
      case "string": c = document.getElementById(_c); break;
      default: throw "Bad type for ID. Must be object or string."
      }
    var n = [ "webgl", "experimental-webgl", "moz-webgl", "webkit-3d" ];
    gl = null;
    if (c) {
      if (typeof(ops) != "undefined") {
        if (ops.hasOwnProperty("aweErrorFun")) 
          addEvent(c,"webglcontextcreationerror", ops.aweErrorFun, false);
        if (ops.hasOwnProperty("aweLostFun") )
          addEvent(c,"webglcontextlost", ops.aweLostFun, false);
        if (ops.hasOwnProperty("aweFoundFun") )
          addEvent(c,"webglcontextrestored", ops.aweFoundFun, false);
        }

      for (var i=0; (gl = c.getContext(n[i],ops)) == null && i < n.length ; i++)
        {}

      if ( gl != null ) {
        gl.viewportWidth  = c.width;
        gl.viewportHeight = c.height;
        gl.canvasElement  = c;
        } 
      }

    return gl;
    }

/*
 * Shader compiling.
 */

  function compile(src,type) {
    if ( !gl )
      throw "No current GL context.";
    if ( !src )
      throw "Invalide or missing shader source.";
    if ( !type )
      throw "Invalide or missing shader type.";

    var shader = gl.createShader(type);
    glThrow("Unable to create a shader");

    gl.shaderSource(shader,src);
    glThrow("Shader Source invalid");

    gl.compileShader(shader);
    glThrow("Shader invalid");

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw ("Compile failed: "+gl.getShaderInfoLog(shader) );

    return shader;
    }

  function link(v, f) {
    if ( !gl )
      throw "No current GL context.";
    var p = gl.createProgram();
    if ( !p )
      return ("gl.createProgram returned null!");

    gl.attachShader(p, v);
    glThrow("Shader (vertex) invalid");

    gl.attachShader(p, f);
    glThrow("Shader (fragment) invalid");

    gl.linkProgram(p);
    glThrow("Program invalid");

    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw ("Link failed : " + gl.getProgramInfoLog(p)) ;

    p.awe_gl = gl;
    p.aweUse = function() { p.awe_gl.useProgram(p); }
    return p;
    }

  function exportNames(p)
    {
    p.aweSym = new Object;
    for (var i = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);i--;) {
      var name = gl.getActiveUniform(p, i).name;
      var loc  = gl.getUniformLocation(p,name);
      p.aweSym[''+name] = loc;
      }

    for (var i = gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES);i--;) {
      var name = gl.getActiveAttrib(p, i).name ;
      var loc = gl.getAttribLocation(p,name) ;
      p.aweSym[''+name] = loc;
      }

    return p;
    };

  function compileAndLink(vsrc, fsrc) {
    var vs = compile(vsrc,  gl.VERTEX_SHADER); 
    var fs = compile(fsrc,  gl.FRAGMENT_SHADER);
    var p  = link(vs, fs);

    return exportNames(p);
    }


/*
 * Request Animation Frame.
 */
  A.raf = window.requestAnimationFrame       || 
             window.webkitRequestAnimationFrame ||
             window.mozRequestAnimationFrame    ||
             window.oRequestAnimationFrame      ||
             window.msRequestAnimationFrame     ||
             function(fun, elem, dt) { window.setTimeout(fun, dt); };

  A.animationStart = function animationStart(fun, elem, dt, paused) {
    var raf = A.raf;
    var noloop = new Function;
    var loop = noloop; 
    var F = {
      play: function() { 
        if (loop==noloop) { 
          loop = function() { 
            fun() || raf(loop,elem,dt);
            };
          loop();
          }
        },
      pause: function() { 
        loop = noloop;
        },
      isPlaying: function() { 
        return (loop != noloop);
        }
      }
    if (!paused)
      F.play();
    return F;
    };
/*
 * Texture stuff.
 */

  this.textureCreate = function(eng)
    {
    var T = gl.createTexture();

    if (eng == undefined)
      eng =  gl.TEXTURE_2D ;
    
    function bind()    { gl.bindTexture(eng, T); }
    function unbind()  { gl.bindTexture(eng, null); }
    function destroy() { gl.deleteTexture(T); }

    function set(engnum, where) {
      gl.activeTexture(gl.TEXTURE0 + engnum);
      bind();
      gl.uniform1i(where, engnum);
      }
    
    function params(min_f, mag_f, wrap_s, wrap_t, flip) {
      bind();
      if (isDefined(flip))
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip);

      gl.texParameteri(eng, gl.TEXTURE_MIN_FILTER, min_f );
      gl.texParameteri(eng, gl.TEXTURE_MAG_FILTER, mag_f );
      gl.texParameteri(eng, gl.TEXTURE_WRAP_S,     wrap_s );
      gl.texParameteri(eng, gl.TEXTURE_WRAP_T,     wrap_t );
      }


    function fromArray(w, h, arr, type, fmt) {
      if (isUndefined(type))
        type = gl.UNSIGNED_BYTE;
      if (isUndefined(fmt))
        fmt = gl.RGBA;
      bind();
      gl.texImage2D(eng, 0, fmt, w, h, 0, fmt, type, arr);
      }

    function fromElement(e, type) {
      if (isUndefined(type))
        type = gl.UNSIGNED_BYTE;
      bind();
      gl.texImage2D(eng,0, gl.RGBA, gl.RGBA, type ,e);
      }

    T.awe_gl       = gl;
    T.awe_eng      = eng;
    T.aweBind      = bind;
    T.aweUnbind    = unbind; 
    T.aweDestroy   = destroy;
    T.aweFromArray = fromArray;
    T.aweSet       = set;
    T.aweFromElem  = fromElement;
    T.aweParams    = params;

    return T;
    }

  A.textureUnbindAll = function (g) {
    for (var i = 0; i < 16; ++i) {
      g.activeTexture(g.TEXTURE0 + i);
      g.bindTexture(g.TEXTURE_2D,null); 
      }
    }

/* 
 * Renderbuffer stuff
 */
  A.renderBufferCreate = function (att, width, height) {
    var rb = gl.createRenderbuffer();
    rb.awe_gl = gl;
    rb.awe_eng = gl.RENDERBUFFER;
    rb.aweDestroy = function() { gl.deleteRenderbuffer(rb); }

    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, att, width, height);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    return rb;
    }

/*
 * Framebuffer stuff
 */

  A.frameBufferCreate = function () {
    var fb = gl.createFramebuffer();

    fb.attachTexture = function(att, tex, level) {
      fb.aweAtts[att] = tex;
      gl.framebufferTexture2D(gl.FRAMEBUFFER, att, tex.awe_eng, tex, level);
      }

    fb.attachRenderbuffer = function(att, rb) {
      fb.aweAtts[att] = rb;
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, att, rb.awe_eng, rb);
      }

    fb.awe_gl     = gl;
    fb.aweAtts    = new Object();
    fb.aweBind    = function()  { gl.bindFramebuffer(gl.FRAMEBUFFER, fb); }
    fb.aweUnBind  = function()  { gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    fb.aweUnbind  = unbind;
    fb.aweDestroy = function() { gl.deleteFramebuffer(fb); }

    return fb;
    }

/*
 * Array buffers.
 */
  A.makeBuffer = function(buftype, datatype, stride, hint, arr) {
    var b = gl.createBuffer();
    var warr;
    var N = arr.length / stride;

    if (datatype == gl.FLOAT)
      warr = new Float32Array(arr)
    else if (datatype == gl.UNSIGNED_SHORT)
      warr = new Uint16Array(arr)
    else 
      throw "Unsuported buffer type.";
    function bind()   { gl.bindBuffer(buftype, b); }
    function unbind() { gl.bindBuffer(buftype, null); }
    
    bind();
    gl.bufferData(buftype, warr, hint);
    unbind();

    b.awe_gl = gl;
    b.aweNumItems = N;
    b.aweStride = stride;
    b.aweDType = datatype;
    b.aweBType = buftype;
    b.aweBind  = bind;
    b.aweUnbind = unbind;
    b.aweSetVertexAttPtr = function (where,x,y) {
      if (buftype != gl.ARRAY_BUFFER)
        throw("set vertex attributes must be of ARRAY_BUFFER type");
      else {
        bind();
        gl.vertexAttribPointer(where, stride, datatype, false, x, y);
        gl.enableVertexAttribArray(where);
        }
      }

    b.drawElements = function (type,n) { // should make this have start,end
      if (buftype != gl.ELEMENT_ARRAY_BUFFER)
        throw("draw elements must must be of ELEMENT_ARRAY_BUFFER type");
      else {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b);
        gl.drawElements(type, (n || N*stride), datatype, 0 );
        }
      }

    return b;
    }

  A.glThrow = glThrow;
  A.exportNames =  exportNames ;
  A.compile = compile ;
  A.link = link ;
  A.compileAndLink = compileAndLink;
  };

