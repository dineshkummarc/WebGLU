/** @author Benjamin DeLillo */
/*
     *  Copyright (c) 2009 Benjamin P. DeLillo
     *  
     *  Permission is hereby granted, free of charge, to any person
     *  obtaining a copy of this software and associated documentation
     *  files (the "Software"), to deal in the Software without
     *  restriction, including without limitation the rights to use,
     *  copy, modify, merge, publish, distribute, sublicense, and/or sell
     *  copies of the Software, and to permit persons to whom the
     *  Software is furnished to do so, subject to the following
     *  conditions:
     *  
     *  The above copyright notice and this permission notice shall be
     *  included in all copies or substantial portions of the Software.
     *  
     *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
     *  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
     *  OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
     *  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
     *  HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
     *  WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
     *  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
     *  OTHER DEALINGS IN THE SOFTWARE.
*/

/** 
 * The primary WebGLU namespace.
 * Holds drawing related data and has useful functions and objects for
 * working with WebGL.
 * @namespace The primary WebGLU namespace.
 */
$W = {
    /** Various paths used by WebGLU. 
     * Call $W.initPaths before using.
     */
    paths:{
        /** Where shaders are stored */
        shaders : "../../shaders/",
        /** Where external libraries, like Sylvester, are stored */
        external : "../../external/",
        /** Which Sylvester lib to load
         * Sylvester.src.js or Sylvester.js
         * */
        sylvester : "Sylvester.src.js"
    },

    /** The raw WebGL object for low level work.  */
    GL : null,

    /** Simulated world */
    world: {
        /** Physical objects */
        objects: []
    },

    /** Renderable objects */
    objects  : [],

    /** GLSL shaders */
    shaders  : [],

    /** GLSL shader programs */
    programs : [],

    /** Textures */
    textures : [],

    /** Model-View transform matrix */
    modelview:null,

    /** Projection transform matrix */
    projection:null,

    /** Viewport camera
     * @type Camera
     */
    camera:null,

    /** Keeps track of the FPS */
    fpsTracker:null,
    /** Quick access to FPS */
	FPS : 0,

    /** Provides frame timing */
    timer:null,

    /** Canvas object being rendered to */
    canvas:null,

    /** Clears the entire WebGLU system to pre-init state */
    reset: function() {
        $W.GL = null;
        $W.modelview = null;
        $W.projection = null;
        $W.camera = null;
        $W.fpsTracker = null;
        $W.FPS = 0;
        $W.timer = null;
        $W.canvas = null;
        $W.objects = [];
        $W.shaders = [];
        $W.programs = [];
        $W.textures = [];
    },


    /** 
     * @namespace Contains objects for working with GLSL shaders and
     * shader programs
     */
    GLSL: {
        /** Must be called */
        initialize:function() {
            // XXX get these at shader compile time instead
            $W.GLSL.Shader.prototype.types = [];
            $W.GLSL.Shader.prototype.types['int']  = 1;
            $W.GLSL.Shader.prototype.types['float']= 1;
            $W.GLSL.Shader.prototype.types['bool'] = 1;
            $W.GLSL.Shader.prototype.types['vec2'] = 2;
            $W.GLSL.Shader.prototype.types['vec3'] = 3;
            $W.GLSL.Shader.prototype.types['vec4'] = 4;
        },

        /** @class Holds data for shader attribute variables.
         * @param {String} name Attributes have the name they are given in
         * the shader code.
         */
        Attribute: function (name, length) {
            this.name = name;
            this.length = length;
            this.location;
            this.buffer;
            this.clone = function() {
                return new $W.GLSL.Attribute(this.name, this.length);
            }
        },

        /** @class Holds data for shader uniform variables
         * @param {String} name Uniforms have the name they are given in
         * the shader code.
         * @param {Function} action The function to update the data in the 
         * uniform each frame.
         */
        Uniform: function (name, action) {
            this.name = name;
            this.location = 0;  // only used by the shader program
            this.action = action;

            this.clone = function() {
                return new $W.GLSL.Uniform(this.name, this.action);
            }
        },

        /** @class Handles compilation, attributes, and uniforms of a GLSL
         * shader.
         * @param {String} name All shaders need a unique name
         * @param {String} source The source code or the DOM element Id 
         * to a script element containing the source code for a shader.
         * @param type The type of shader, valid types are<br>
         * $W.GL.VERTEX_SHADER<br>
         * $W.GL.FRAGMENT_SHADER<br>
         */
        Shader: function(name, source, type) {
            //console.groupCollapsed("creating shader '" + name + "'");
            console.log("creating shader '" + name + "'");
            $W.shaders[name] = this;

            /** Name of the shader. */
            this.name 	  = name;

            /** Source code of the shader. */
            this.source   = "";

            /** Shader type $W.GL.VERTEX_SHADER or $W.GL.FRAGMENT_SHADER. */
            this.type 	  = -1;

            /** The WebGL shader object. */
            this.glShader = null;

            /** Attributes for this shader. */
            this.attributes = [];
            /** Uniforms for this shader. */
            this.uniforms   = [];

            /** Names of programs which use this shader. */
            this.programs 	= [];

            /** Tracks if this shader need to be (re)compiled. */
            this.isDirty = true;

            // TODO Have _dirty and _clean update the dirty status of all
            // programs which use this shader.
            this._dirty = function() {
                this.glShader = null;
                this.isDirty = true;
            }
            this._clean = function() {
                this.isDirty = false;
            }

            this._addProgram = function(name) {
                this.programs.push(name);
            }
            this._removeProgram = function(name) {
                this.programs = this.programs.remove(name);
            }
            
            /** Change the source for this shader 
             * @param {String} src The source code.
             */
            this.setSource = function(src) {
                this._dirty();
                this.source = src;
            }

            /** Set up a Uniform for the modelview matrix.
             * Creates the appropriate action for sending the matrix
             * each frame.
             * @param {String} name Name of the uniform in the shader.
             */
            this.setModelViewUniform = function(name) {
                console.log("using '" + name + "' as ModelView uniform");

                var uniform;
                for (var i = 0; i < this.uniforms.length; i++) {
                    if (this.uniforms[i].name == name) {
                        uniform = this.uniforms[i];
                    }
                }

                uniform.action = function(wglu) {
                    //wglu.log('processing modelview uniform');
                    wglu.GL.uniformMatrix4fv(this.location, false, 
                            $W.modelview.getForUniform());
                }
            }

            /** Set up a Uniform for the projection matrix.
             * Creates the appropriate action for sending the matrix
             * each frame.
             * @param {String} name Name of the uniform in the shader.
             */
            this.setProjectionUniform = function(name) {
                console.log("using '" + name + "' as Projection uniform");

                var uniform;
                for (var i = 0; i < this.uniforms.length; i++) {
                    if (this.uniforms[i].name == name) {
                        uniform = this.uniforms[i];
                    }
                }

                uniform.action = function(wglu) {
                    //wglu.log('processing projection uniform');
                    wglu.GL.uniformMatrix4fv(this.location, false, 
                            $W.projection.getForUniform());
                }
            }

            /** Set up a Uniform for the normal matrix.
             * Creates the appropriate action for sending the matrix
             * each frame.
             * @param {String} name Name of the uniform in the shader.
             */
            this.setNormalMatrixUniform = function(name) {
                console.log("using '" + name + "' as normal transformation matrix");

                var uniform;
                for (var i = 0; i < this.uniforms.length; i++) {
                    if (this.uniforms[i].name == name) {
                        uniform = this.uniforms[i];
                    }
                }

                uniform.action = function(wglu) {
                    wglu.GL.uniformMatrix3fv(this.location, false, 
                            $W.util.getNormalMatrixForUniform());
                }
            }

            /** @returns The raw WebGL shader object */
            this.getGLShader = function() {
                // Ensure the shader is valid before we return it
                if (this.isDirty) {
                    console.log("'" + this.name + "' is dirty");
                    if (!this.compile()) {
                        return false;
                    }else {
                        this._clean();
                    }
                }else {
                    console.log("'" + this.name + "' is clean, using");
                }
                return this.glShader;
            }

            /** Store the information about this named uniform. 
             * @param {String} name The uniform variable name as defined in
             * the shader source.
             * @param {Function} [action=function(){}] The function to call 
             * each frame to prep/send this uniform to the shader.
             */
            this.addUniform = function(name, action) {
                console.log("adding uniform '" + name + "'");
                if (!action) {
                    action = function(){}
                }
                this.uniforms.push(new $W.GLSL.Uniform(name, action));
            }

            /** Store the information about this named attribute. 
             * @param {String} name The attribute variable name as defined in
             * the shader source.
             * @param {Integer} [length=3] The length of the attribute.
             */
            this.addAttribute = function(name, length) {
                console.log("adding attribute '" + name + "'");
                if (!length) { length = 3; }
                //this.attributes.push([name, length]);
                this.attributes.push(new $W.GLSL.Attribute(name, length));
            }

            // Find and initialize all uniforms and attributes found in the source
            this._parseShaderVariables = function(str) {
                var tokens = str.split(/[\s\n;]+?/);

                for (var i = 0; i < tokens.length; i++) {
                    if (tokens[i] == "attribute") {
                        var type = tokens[i+1];
                        var name = tokens[i+2];
                        var length = this.types[type];
                        this.addAttribute(name, length);
                    }                               
                    if (tokens[i] == "uniform") {
                        var type = tokens[i+1];
                        var name = tokens[i+2];
                        this.addUniform(name);

                        if (name == $W.constants.ModelViewUniform) {
                            this.setModelViewUniform($W.constants.ModelViewUniform);

                        }else if (name == $W.constants.ProjectionUniform) {
                            this.setProjectionUniform($W.constants.ProjectionUniform);

                        }else if (name == $W.constants.NormalMatrixUniform) {
                            this.setNormalMatrixUniform($W.constants.NormalMatrixUniform);
                        }
                    }
                }
            }

            /** Compile the shader if able.
             * Lets any shader programs which use this shader know they need to
             * relink
             */
            this.compile = function() {
                if (this.type == $W.GL.VERTEX_SHADER) {
                    console.log("compiling '" + this.name + "' as vertex shader");
                }else if (this.type = $W.GL.FRAGMENT_SHADER) {
                    console.log("compiling '" + this.name + "' as vertex shader");
                }else {
                    console.error("compiling '" + this.name + "' as unknown type " + this.type);
                }   
                if (this.glShader !== null) {
                    $W.GL.deleteShader(this.glShader);
                    this.glShader = null;
                }

                var shader = $W.GL.createShader(this.type);
                
                $W.GL.shaderSource(shader, this.source);
                $W.GL.compileShader(shader);

                if (!$W.GL.getShaderParameter(shader, $W.GL.COMPILE_STATUS)) {
                    console.group('Compile error');
                    //console.error('error compiling ' + this.name + ': ' + $W.GL.getShaderInfoLog(shader));
                    console.log(this.source);
                    console.groupEnd();
                    this.glShader = null;
                } else {
                    this._clean();
                    this.glShader = shader;
                }

                return (this.glShader !== null);
            }

            // If the source wasn't passed in we assume name is an element
            // ID in the page
            if (!source) {
                var getShaderSourceById = function(id) {
                    var source;
                    var shaderScript = document.getElementById(id);
                    if (!shaderScript) {
                        console.error("No script with id '" + id + "'");
                        return null;
                    }

                    source = "";
                    var k = shaderScript.firstChild;
                    while (k) {
                        if (k.nodeType == 3) {
                            source += k.textContent;
                        }
                        k = k.nextSibling;
                    }

                    return source;
                }

                var getShaderTypeById = function(id) {
                    var type;
                    var shaderScript = document.getElementById(id);
                    if (!shaderScript) {
                        console.error("No script with id '" + id + "'");
                        return null;
                    }

                    if (shaderScript.type == "x-shader/x-fragment") {
                        type = $W.GL.FRAGMENT_SHADER;
                    } else if (shaderScript.type == "x-shader/x-vertex") {
                        type = $W.GL.VERTEX_SHADER;
                    } else {
                        console.log('invalid shader type' + shaderScript.type);
                    }

                    return type;
                }

                this.source = getShaderSourceById(name);
                this.type  	= getShaderTypeById(name);

            // Else we just use the provided source and type
            }else {
                this.source = source;
                this.type   = type;
            }

            this._parseShaderVariables(this.source);
            //this.compile();

            console.groupEnd();
        },

        /** @class Handles data and linking for a shader program.
         * Also ensures all shaders which it uses are compiled and up
         * to date.
         * @param {String} name All shader programs need a unique name.
         */
        ShaderProgram: function(name) {
            console.log("creating shader program '" + name + "'");

            /** Global name of the shader program. */
            this.name = name;

            /** WebGL shader program object. */
            this.glProgram 	= null;

            /** Link state */
            this.isLinked 	= false;
            
            /** Tracks link state and compile state of all attached shaders. */
            this.isDirty 	= true; // So we know when to relink
            
            /** Attached shaders */
            this.shaders 	= [];

            /** Attributes from all attached shaders. */
            this.attributes = [];

            /** Uniforms from all attached shaders. */
            this.uniforms 	= [];

            this._setupAttributes = function() {
                this.attributes = [];

                // Each shader keeps track of its attributes,
                for (var i = 0; i < this.shaders.length; i++) {
                    var shader = $W.shaders[this.shaders[i]];

                    for (var j = 0; j < shader.attributes.length; j++) {
                        var attribute = shader.attributes[j].clone();

                        // but attribute locations are unique to each program
                        attribute.location = $W.GL.getAttribLocation(this.glProgram, attribute.name);
                        attribute.buffer   = $W.GL.createBuffer();

                        this.attributes.push(attribute);
                    }
                }
            }

            this._setupUniforms = function() {


                // Each shader keeps track of its uniforms
                for (var i = 0; i < this.shaders.length; i++) {
                    var shader = $W.shaders[this.shaders[i]];

                    for (var j = 0; j < shader.uniforms.length; j++) {
                        var uniform = shader.uniforms[j].clone();

                        // locations are unique to each shader program (I think)
                        uniform.location = $W.GL.getUniformLocation(this.glProgram, uniform.name);
                        this.uniforms.push(uniform);
                    }
                }
            }

            /** Set the action to take per fram for a particular uniform.
             * Here instead of the shader because different programs can both
             * use the same shader, but treat it differently.
             * XXX What if two shaders have the same named variable
             * but need different data?
             * @param {String} name The name of the uniform.
             * @param {Function} action The function to call per frame.
             */
            this.setUniformAction = function(name, action) {
                this.use();

                var uniform;
                for (var i = 0; i < this.uniforms.length; i++) {
                    if (this.uniforms[i].name == name) {
                        uniform = this.uniforms[i];
                    }
                }

                if (uniform === undefined) {
                    console.error("Cannot set uniform `" + name + "` in shader program `" + this.name + "`, no uniform with that name exists");
                    return;
                }else {
                    console.log("Setting action for uniform `" + name + "` in shader program `" + this.name + "`");
                }

                uniform.action = action;
            }

            /** Set the named uniform variable to a single value.
             * Overloaded to allow 1-4 values to be passed. This allows 
             * this function to set the value of int, float, vec2, vec3, and
             * vec4 uniform variables in a shader.
             * @param {String} name The name of the uniform to set.
             * @param optional1 A value
             * @param optional2 A value
             * @param optional3 A value
             * @param optional4 A value
             */
            this.setUniform = function(name) {
                // Program must be active before we can do anything with it
                this.use();

                var uniform;
                for (var i = 0; i < this.uniforms.length; i++) {
                    if (this.uniforms[i].name == name) {
                        uniform = this.uniforms[i];
                    }
                }

                if (uniform === undefined) {
                    console.error("Cannot set uniform `" + name + "` in shader program `" + this.name + "`, no uniform with that name exists");
                    return;
                }else {
                    console.log("Setting uniform `" + name + "` in shader program `" + this.name + "`");
                }

                if (arguments.length == 2) {
                    uniform.action = function() {
                        $W.GL.uniform1f(this.location, 
                            arguments[1]);
                    }

                } else if (arguments.length == 3) {
                    uniform.action = function() {
                        $W.GL.uniform2f(this.location, 
                            arguments[1], arguments[2]);
                    }

                } else if (arguments.length == 4) {
                    uniform.action = function() {
                        $W.GL.uniform3f(this.location, 
                            arguments[1], arguments[2], 
                            arguments[3]);
                    }

                } else if (arguments.length == 5) {
                    uniform.action = function() {
                        $W.GL.uniform4f(this.location, 
                            arguments[1], arguments[2], 
                            arguments[3], arguments[4]);
                    }

                }
            }

            /** Called once per frame to calculate and set uniforms. */
            this.processUniforms = function() {
                for (var i = 0; i < this.uniforms.length; i++) {
                    this.uniforms[i].action($W);
                }
            }

            /** Link this shader program to make it useable.
             * Will [re]compile all attached shaders if necessary.
             */
            this.link = function() {
                console.groupCollapsed("linking '" + this.name + "'");

                if (this.isLinked) {
                    console.log("already exists, deleting and relinking");

                    // Only delete the program if one already exists
                    if (!!this.glProgram) {
                        $W.GL.deleteProgram(this.glProgram);
                        this.attributes = [];
                        this.glProgram = null;
                    }
                }

                this.glProgram = $W.GL.createProgram();

                // Attach all the shaders
                for (var i = 0; i < this.shaders.length; i++) {
                    var shader = $W.shaders[this.shaders[i]];
                    var glShader = shader.getGLShader();

                    // if the shader is still dirty after calling get,
                    // which should have cleaned it, then the compile failed.
                    if (shader.isDirty) {
                        console.log(this.shaders[i] + " failed to compile");
                    }else {
                        $W.GL.attachShader(this.glProgram, 
                                $W.shaders[this.shaders[i]].glShader);
                    }	
                }

                $W.GL.linkProgram(this.glProgram);

                // Check for errors
                if (!$W.GL.getProgramParameter(this.glProgram, $W.GL.LINK_STATUS)) {
                    console.group('Link error');
                    console.error($W.GL.getProgramInfoLog(this.glProgram));
                    this.isLinked = false;
                    console.groupEnd();
                }
                    
                this.isLinked = true;
                this.isDirty = false;
                this._setupAttributes();
                this._setupUniforms();

                console.groupEnd();
                return this.isLinked;
            }

            /** XXX @Deprecated */
            this.detachShaderByName = function(name) {
                console.warn("detachShaderByName is deprecated, use detachShader instead");
                detachShader(name);
            }

            /** Remove the named shader from this program.
             * Can be used to alter a shader program on the fly.
             * @param {String} name
             */
            this.detachShader = function(name) {
                var tempShaders = [];

                for (var i = 0; i < this.shaders.length; i++) {
                    if (this.shaders[i] != name) {
                        tempShaders.push(this.shaders[i]);
                    }
                }

                this.isDirty = true;
                this.shaders = tempShaders;
            }

            /** Attach a shader to this shader program.
             * Overloaded to work with as <br>
             * attachShader(GLSL.Shader shader)<br>
             * attachShader(String name, String source, type)<br>
             * attachShader(String name, String filePath)<br>
             * attachShader(String name, String source, type)<br>
             */
            this.attachShader = function(shader, path, type) {
                // Shader from node ID, filename, or source.
                // Otherwise we've been passed a shader object.
                if (typeof shader == 'string') { 
                    // Shader from ID
                    if (arguments.length == 1) {
                        shader = new $W.GLSL.Shader(shader);

                    // Shader from file
                    }else if (arguments.length == 2){

                        // Try to infer type
                        var ext = path.slice(path.length - 4)
                        if (ext == 'vert' || ext.slice(2) == 'vp') type = $W.GL.VERTEX_SHADER;
                        if (ext == 'frag' || ext.slice(2) == 'fp') type = $W.GL.FRAGMENT_SHADER;

                        try {
                            shader = new $W.GLSL.Shader(shader, $W.util.loadFileAsText(path), type); 
                        }catch (e) {
                            console.error(e);
                            return;
                        }

                    // Shader from source
                    }else {
                        shader = new $W.GLSL.Shader(shader, path, type);
                    }
                }

                this._attachShader(shader);
            }

            this._attachShader = function(shader) {
                console.log("attaching '" + shader.name + "' to '" + this.name + "'");
                try{
                    shader._addProgram(this.name);
                }catch(e) {
                    console.error(" ");
                }
                this.isDirty = true;
                this.shaders.push(shader.name);
            }

            /** XXX @Deprecated */
            this.attachShaderByID = function(name) {
                console.warn("attachShaderByID is deprecated, use attachShader instead");
                this.attachShader(new $W.GLSL.Shader(name));
            }

            /** Set this shader program to be the active program for
             * rendering.
             */
            this.use = function() {
                // Try to link if needed
                if (!this.isLinked || this.isDirty) {
                    if (!this.link()) return false;
                }
                $W.GL.useProgram(this.glProgram);
                return true;
            }

            console.groupEnd();
        }

    },

    /** @namespace Contains (semi)constant values that generally shouldn't be 
     * changed.
     */
    constants:{ 
        /** @namespace Color constants */
        colors: {
          RED  :[1.0, 0.0, 0.0],
          GREEN:[0.0, 1.0, 0.0],
          BLUE :[0.0, 0.0, 1.0],
          GREY :[0.5, 0.5, 0.5],
          WHITE:[1.0, 1.0, 1.0],
          BLACK:[0.0, 0.0, 0.0]
        },

        /** Data for a unit cube.
         * Intended to be used with setElements.
         */
        unitCube:{
            /** Vertices on the unit cube. */
            vertices : [
                // Front face
                -1.0, -1.0,  1.0,
                 1.0, -1.0,  1.0,
                 1.0,  1.0,  1.0,
                -1.0,  1.0,  1.0,
                
                // Back face
                -1.0, -1.0, -1.0,
                -1.0,  1.0, -1.0,
                 1.0,  1.0, -1.0,
                 1.0, -1.0, -1.0,
                
                // Top face
                -1.0,  1.0, -1.0,
                -1.0,  1.0,  1.0,
                 1.0,  1.0,  1.0,
                 1.0,  1.0, -1.0,
                
                // Bottom face
                -1.0, -1.0, -1.0,
                 1.0, -1.0, -1.0,
                 1.0, -1.0,  1.0,
                -1.0, -1.0,  1.0,
                
                // Right face
                 1.0, -1.0, -1.0,
                 1.0,  1.0, -1.0,
                 1.0,  1.0,  1.0,
                 1.0, -1.0,  1.0,
                
                // Left face
                -1.0, -1.0, -1.0,
                -1.0, -1.0,  1.0,
                -1.0,  1.0,  1.0,
                -1.0,  1.0, -1.0

            ],
              
            /** Normals on the unit cube. */
            normals : [
                // Front
                 0.0,  0.0,  1.0,
                 0.0,  0.0,  1.0,
                 0.0,  0.0,  1.0,
                 0.0,  0.0,  1.0,
                
                // Back
                 0.0,  0.0, -1.0,
                 0.0,  0.0, -1.0,
                 0.0,  0.0, -1.0,
                 0.0,  0.0, -1.0,
                
                // Top
                 0.0,  1.0,  0.0,
                 0.0,  1.0,  0.0,
                 0.0,  1.0,  0.0,
                 0.0,  1.0,  0.0,
                
                // Bottom
                 0.0, -1.0,  0.0,
                 0.0, -1.0,  0.0,
                 0.0, -1.0,  0.0,
                 0.0, -1.0,  0.0,
                
                // Right
                 1.0,  0.0,  0.0,
                 1.0,  0.0,  0.0,
                 1.0,  0.0,  0.0,
                 1.0,  0.0,  0.0,
                
                // Left
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0

            ],
              
            /** Texture coordinates on the unit cube. */
            textureCoordinates : [
                // Front
                0.0,  0.0,
                1.0,  0.0,
                1.0,  1.0,
                0.0,  1.0,
                // Back
                0.0,  0.0,
                1.0,  0.0,
                1.0,  1.0,
                0.0,  1.0,
                // Top
                0.0,  0.0,
                1.0,  0.0,
                1.0,  1.0,
                0.0,  1.0,
                // Bottom
                0.0,  0.0,
                1.0,  0.0,
                1.0,  1.0,
                0.0,  1.0,
                // Right
                0.0,  0.0,
                1.0,  0.0,
                1.0,  1.0,
                0.0,  1.0,
                // Left
                0.0,  0.0,
                1.0,  0.0,
                1.0,  1.0,
                0.0,  1.0
            ],

            /** Per element indices for unit cube */
            indices : [
                0,  1,  2,      0,  2,  3,    // front
                4,  5,  6,      4,  6,  7,    // back
                8,  9,  10,     8,  10, 11,   // top
                12, 13, 14,     12, 14, 15,   // bottom
                16, 17, 18,     16, 18, 19,   // right
                20, 21, 22,     20, 22, 23    // left
            ]

        },

        /** The name that a uniform variable needs to have to be automatically
         * identified as the Model-View Matrix.
         */
        ModelViewUniform    : 'ModelViewMatrix',

        /** The name that a uniform variable needs to have to be automatically
         * identified as the Projection Matrix.
         */
        ProjectionUniform   : 'ProjectionMatrix',

        /** The name that a uniform variable needs to have to be automatically
         * identified as the Normal Matrix.
         */
        NormalMatrixUniform : 'NormalMatrix'
    },

    /** @namespace Utility functions. */
    util:{
        integrateEuler:function(fun, t, dt) {
            return fun(t + dt);
        },

        /** XXX Not yet implemented. */
        getPickRay : function(x, y) {

        },

        /** Get axis/angle representation of the rotation.
         * Based on http://www.euclideanspace.com/maths/geometry/rotations/conversions/eulerToAngle/index.htm
         */
        getAxisAngle : function(rotation) {
            if (rotation.elements == [0,0,0]) return {angle:0,axis:[1,0,0]};
            var c1 = Math.cos(rotation.e(2) / 2); // c1 = cos(heading / 2)
            var c2 = Math.cos(rotation.e(1) / 2); // c2 = cos(attitude / 2)
            var c3 = Math.cos(rotation.e(3) / 2); // c3 = cos(bank / 2)
            var s1 = Math.sin(rotation.e(2) / 2); // s1 = sin(heading / 2) 
            var s2 = Math.sin(rotation.e(1) / 2); // s2 = sin(attitude / 2)
            var s3 = Math.sin(rotation.e(3) / 2); // s3 = sin(bank / 2)    

            var result = {};

            result.angle = 2 * Math.acos(c1*c2*c3 - s1*s2*s3);

            result.axis = [];
            result.axis[0] = s1*s2*c3 + c1*c2*s3;
            result.axis[1] = s1*c2*c3 + c1*s3*s3;
            result.axis[2] = c1*s2*c3 - s1*c2*s3;

            // Normalize
            var mag = Math.sqrt(result.axis[0]*result.axis[0] + result.axis[1]*result.axis[1] + result.axis[2]*result.axis[2]);
            //if (Math.abs(result.axis[0]) > 1) result.axis[0] /= mag;
            //if (Math.abs(result.axis[1]) > 1) result.axis[1] /= mag;
            //if (Math.abs(result.axis[2]) > 1) result.axis[2] /= mag;

            return result;
        },

        /** Generate vertices, normals, texture coordinates, and element 
         * indices for a sphere. Intended to be rendered with setElements.
         * XXX Not a 'sliced' sphere, need to fix that.
         * @param rings Number of horizontal rings that make up the sphere.
         * @param slices Number of triangles per ring.
         * @param [r] The radius of the sphere, defaults to 1.0 if omitted.
         *
         * @returns sphere Object containing sphere data.
         * @returns {Array} sphere.vertices Vertices for sphere of radius r.
         * @returns {Array} sphere.normals Normals for sphere with given number
         * of rings and slices.
         * @returns {Array} sphere.texCoords Texture coordinates for sphere 
         * with given number of rings and slices.
         * @returns {Array} sphere.indices Per element indices.
         */
        genSphere: function(rings, slices, r) {
            // Default to unit sphere
            if (r === undefined) r = 1;

            sphere = {};
            sphere.vertices = [];
            sphere.normals  = [];
            sphere.texCoords= [];
            sphere.indices  = [];

            for (var ring = 0; ring <= rings; ++ring) {
                for (var slice   = 0; slice <= slices; ++slice) {
                    var theta    = ring * Math.PI / rings;
                    var phi      = slice * 2 * Math.PI / slices;
                    var sinTheta = Math.sin(theta);
                    var sinPhi   = Math.sin(phi);
                    var cosTheta = Math.cos(theta);
                    var cosPhi   = Math.cos(phi);

                    var x = cosPhi * sinTheta;
                    var y = cosTheta;
                    var z = sinPhi * sinTheta;

                    var u = 1 - (slice / slices);
                    var v = ring / rings;

                    
                    sphere.vertices = sphere.vertices.concat([r*x, r*y, r*z]);
                    sphere.normals = sphere.normals.concat([x, y, z]);
                    sphere.texCoords = sphere.texCoords.concat([u,v]);
                }
            }

            for (var ring = 0; ring < rings; ++ring) {
                for (var slice   = 0; slice < slices; ++slice) {
                    var first = (ring * slices) + (slice % slices);
                    var second = first + slices;

                    sphere.indices = sphere.indices.concat([first, second, first+1, second, second+1, first+1]);                    
                }
            }

            return sphere;
        }, 

        /** XXX Not yet implemented.
         * Spherical linear interpolation. For interpolating quaternions.
         * @param {Quaternion} q1 Quaternion to interpolate from.
         * @param {Quaternion} q2 Quaternion to interpolate to.
         * @param t How far along to interpolate.
         */
        slerp:function(t, q1, q2) {

        },

        /** Linear interpolation between numbers
         * @param {Number} a Value to interpolate from.
         * @param {Number} b Value to interpolate to.
         * @param {Number} t Value from 0 to 1 representing the fraction
         * between the two values to interpolate by.
         */
        lerp:function(t,a,b) {
            return a + t * (b - a);
        },

        /** Linear interpolation between triples
         * @param {Array of 3 elements} a Array of values to interpolate from.
         * @param {Array of 3 elements} b Array of values to interpolate to.
         * @param {Number} t Value from 0 to 1 representing the fraction
         * between the two sets of values to interpolate by.
         */
        lerpTriple:function(t,a,b) {
            return [$W.util.lerp(t, a[0], b[0]),
                    $W.util.lerp(t, a[1], b[1]),
                    $W.util.lerp(t, a[2], b[2])
            ];
        },

        /** Parse a .obj model file
         * XXX Should I build the vertex/normal/texture coordinate arrays
         * explicitly from the face data? Can it work otherwise?
         * XXX Not quite working.
         * @return model An object containing model data as flat
         * arrays.
         * @return model.vertices Vertices of the object.
         * @return model.normals Normals of the object.
         * @return model.texCoords Texture coordinates of the object.
         * @return model.faces Element indices of the object.
         */
        parseOBJ:function(obj) {
            console.group("Processing .obj file...");
            var data = {};
            var model = {};
            var counts = [0,0,0,0];

            // Parse vertices
            model.vertices = obj.match(/^v\s.+/gm);
            if (model.vertices != null) {
                console.log("Parsing vertices");
                for (var i = 0; i < model.vertices.length; i++) {
                    model.vertices[i] = model.vertices[i].match(/[-0-9\.]+/g);
                    counts[0]++;
                }
                model.vertices = model.vertices.flatten();
                model.vertices = model.vertices.flatten();

                // convert to numbers
                for (var i = 0; i < model.vertices.length; i++) {
                    model.vertices[i] = model.vertices[i] * 1; 
                    counts[0]++;
                }
            }

            // Parse normals
            model.normals = obj.match(/^vn.+/gm);
            if (model.normals != null) {
                console.log("Parsing normals");
                for (var i = 0; i < model.normals.length; i++) {
                    model.normals[i] = model.normals[i].match(/[0-9\.]+/g);
                    counts[1]++;
                }
                model.normals = model.normals.flatten();
            }

            // Parse texture coordinates
            model.texCoords = obj.match(/^vt.+/gm);
            if (model.texCoords != null) {
                console.log("Parsing texture coordinates");
                for (var i = 0; i < model.texCoords.length; i++) {
                    model.texCoords[i] = model.texCoords[i].match(/[0-9\.]+/g);
                    counts[2]++;
                }
                model.texCoords = model.texCoords.flatten();
                model.texCoords = model.texCoords.flatten();
            }
            /*
            // parse faces
            // faces start with `f `
            // `f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3 [v4/vt4/vn4]
            model.faces = obj.match(/^f[\s.]+/gm); 
            if (model.faces != null) {}
                model.indices = {};
                console.log("parsing faces");
                // face format : v/vt/vn
                
                // pull the vertices from each face
                model.indices.vertex = [];
                for (var i = 0; i < model.faces.length; i++) {
                    // vertex indices match ` 123/`
                    model.indeces.vertex.push(/\s\d*\//g);
                    model.faces[i] = model.faces[i].match(/\s\d*\//g);

                }
            */

            // Parse faces
            model.faces = obj.match(/^f.+/gm);
            if (model.faces != null) {
                console.log("Parsing faces");
                // face format : v/vt/vn
                for (var i = 0; i < model.faces.length; i++) {
                    // Parse face vertices
                    model.faces[i] = model.faces[i].match(/\s\d*\//g);
                    for (var j = 0; j < model.faces[i].length; j++) {
                        model.faces[i][j] = model.faces[i][j].slice(1, model.faces[i][j].length-1) - 1; // -1 to force into numeral form and change to zero indexing
                    }



                    //model.faces[i] = model.faces[i].match(/[0-9\/]+/g);

                    // Convert quads to triangles
                    /*
                    if (model.faces[i].length == 4) {
                        model.faces[i] = [
                            model.faces[i][0],model.faces[i][1],model.faces[i][2],
                            model.faces[i][1],model.faces[i][2],model.faces[i][3]
                            ];
                    }

                    for (var j = 0; j < model.faces[i].length; j++) {
                        model.faces[i][j] = (model.faces[i][j]).split("/");
                    }
                    */
                    counts[3]++;
                }
                model.faces = model.faces.flatten();
                model.faces = model.faces.flatten();

                // convert to numbers
                for (var i = 0; i < model.faces.length; i++) {
                    model.faces[i] = model.faces[i] * 1; 
                    counts[0]++;
                }
            }

            console.log("Processed\n  " + counts[0] + " vertices" +
                                 "\n  " + counts[1] + " normals" +
                                 "\n  " + counts[2] + " texture coordinates" +
                                 "\n  " + counts[3] + " faces"
            );
            console.groupEnd();
            return model;
        },

        /** Load the file at the given path as text.
         * @param {String} path The path to the file.
         * @return {String} Data in the file as text.
         */
        loadFileAsText:function(path) {
            console.log("Loading file `" + path + "`");
            var xhr = null;
            xhr = new XMLHttpRequest();
            xhr.overrideMimeType("text/xml");

            if (!xhr) return null;

            try {
                var nsPM = netscape.security.PrivilegeManager;
                if (document.location.href.match(/^file:\/\//)) {
                    if (nsPM !== undefined) {
                        nsPM.enablePrivilege("UniversalBrowserRead");
                    }
                }
            }catch (e) {
                console.groupEnd();
                throw "Browser security has restricted access to local files";
            }

            try {
                xhr.open("GET", path, false);
                xhr.send(null);

            }catch (e) { 
                throw e; 
            }

            console.log("\tCompleted with status: " + xhr.status);

            return xhr.responseText;
        },

        /** Calculates the 3x3 inverse transpose of the Model-View matrix.
         * Returns it in a format suitable to be passed directly as shader
         * uniform.
         * @return {WebGLFloatArray} 3x3 inverse transpose, ready to be sent as
         * a uniform.
         */
        getNormalMatrixForUniform: function() {
            return new WebGLFloatArray($W.modelview.matrix.inverse().transpose().make3x3().flatten());
        },

        /** Create a WebGL context for the specified canvas.
         * @param {Canvas} canvas A canvas element.
         * @return {WebGL Context} A WebGL context for the passed
         * canvas.
         */
        getGLContext: function(canvas) {
            var gl = null;
            var type = '';

            try { if (!gl) {                       
                      type = '3d';                 
                      gl = canvas.getContext(type);
            }} catch (e){}
            try { if (!gl) { 
                      type = 'moz-webgl';
                      gl = canvas.getContext(type); 
            }} catch (e){}
            try { if (!gl) {                       
                      type = 'webkit-3d';          
                      gl = canvas.getContext(type);
            }} catch (e){}

            console.log('using ' + type);

            return gl;
        },

        /** A place to put any code to ensure cross-browser compatability */
        ensureCrossBrowserCompat:function() {
            // This temporary code provides support for Google Chrome, which
            // as of 30 Nov 2009 does not support the new names for the
            // functions to get shader/program parameters (among other things).
            // It should be unnecessary soon, and is only a partial fix
            // in the meantime (as, for example, there's no way to get shader
            // or program parameters that are vectors of integers).
            // See http://learningwebgl.com/blog/?p=1082 for details.
            if (!this.GL.getProgramParameter)
            {
                this.GL.getProgramParameter = this.GL.getProgrami
            }
            if (!this.GL.getShaderParameter)
            {
                this.GL.getShaderParameter = this.GL.getShaderi
            }
            // End of Chrome compatibility code
        }

    },

    /** @namespace Contains animation objects 
     * XXX unnecessary, flatten
     */
    anim:{
        /** @class A procedurally generated animation. 
         * Starts updating immediately.
         */
        ProceduralAnimation:function() {
            $W.ObjectState.call(this); // subclass of ObjectState

            /** XXX The right way to do this? */
            var ptyp = $W.anim.ProceduralAnimation.prototype;

            /** The time in milliseconds since this animation began */
            this.age = 0;

            /** Call to advance the animation by `dt` milliseconds */
            this.update = function(dt){};

            /** Internal.
             * @return {Function} Update this animation.
             */
            ptyp._play = function() {
                return (function(dt) {
                        this.preUpdate(dt);

                        this.age += dt;

                        this.updatePosition(dt);
                        this.updateRotation(dt);
                        this.updateScale(dt);

                        this.postUpdate(dt);
                });
            }

            /** Internal.
             * @return {Function} Do nothing.
             */
            ptyp._pause = function() {
                return (function() {});
            }

            /** This animation will advance on subsequent update() 
             * calls.
             */
            this.play = function() {
                this.update = ptyp._play();
            }

            /** This animation will not change on subsequent update() 
             * calls.
             */
            this.pause = function() {
                this.update = ptyp._pause();
            }

            /** Called before `dt` is added to this.age 
             * Does nothing by default.
             */
            this.preUpdate      = function(dt){}

            /** Update the position. Does nothing by default. */
            this.updatePosition = function(dt){}
            /** Update the rotation. Does nothing by default. */
            this.updateRotation = function(dt){}
            /** Update the scale. Does nothing by default. */
            this.updateScale 	= function(dt){}

            /** Called after all other update calls.
             * Does nothing by default.
             */
            this.postUpdate     = function(dt){}

            this.play();
        },


        /** @class A single frame of animation.
         * A position, rotation, and scale at a particular point in time.
         *
         * @param {3 Array} pos Position.
         * @param {3 Array} rot Rotation.
         * @param {3 Array} scl Scale.
         * @param {Number} atTime Time, in seconds, this keyframe occurs at.
         */
        KeyFrame:function (pos, rot, scl, atTime) {
            if (arguments.length == 4) {
                $W.ObjectState.call(this, pos, rot, scl); // Subclass ObjectState
                this.atTime = atTime * 1000; // time, in seconds, this keyframe occurs at
            }else {
                $W.ObjectState.call(this); 
                this.atTime = 0;
            }
        },

        /** @class A keyframe based animation 
         * XXX Works, but doesn't use quaternions for rotation interpolation.
         */
        KeyFrameAnimation:function() {
            $W.anim.ProceduralAnimation.call(this); // Subclass ProceduralAnimation

            this.keyframes = [];
            /** Frame index to interpolate from. */
            this.A = 0; 
            /** Frame index to interpolate to. */
            this.B = 1; 

            /** Time scale multiplier */
            this.timeScale = 1;


            this.preUpdate = function(dt) {
                this.age += dt * this.timeScale;

                // Time for next frame?
                if (this.age >= (this.keyframes[this.B]).atTime) {

                    // Increment frame counters
                    this.A = ++this.A % this.keyframes.length;
                    this.B = ++this.B % this.keyframes.length;

                    // Account for slop (by throwing it out)
                    this.age = (this.keyframes[this.A]).atTime;
                }


                var progress = this.age - (this.keyframes[this.A]).atTime;
                var duration = (this.keyframes[this.B]).atTime - (this.keyframes[this.A]).atTime;
                var t = progress / duration;


                var A = this.A;
                var B = this.B;

                // Interpolate position
                this.position.elements = $W.util.lerpTriple(t, 
                        this.keyframes[A].position.elements,
                        this.keyframes[B].position.elements);

                // XXX naive interpolation
                // Interpolate rotation
                this.rotation.elements = $W.util.lerpTriple(t, 
                        this.keyframes[A].rotation.elements,
                        this.keyframes[B].rotation.elements);

                // Interpolate scale
                this.scale.elements = $W.util.lerpTriple(t, 
                        this.keyframes[A].scale.elements,
                        this.keyframes[B].scale.elements);
            }

            /** Add a new keyframe. 
             * For now it needs to be added in time order as it
             * doesn't sort on its own.
             * @param {Keyframe} keyframe The keyframe to add.
             */
            this.addKeyframe = function(keyframe) {
                this.keyframes.push(keyframe);
            }

            /** Remove the keyframe at index from the list of keyframes.
             * @param {Integer} index The index of the keyframe to remove.
             */
            this.removeKeyframe = function(index) {
                var result = [];

                // - 1 for frame -1
                for (var i = 0; i < this.keyframes.length - 1; i++) {
                    if (i != index) {
                        result.push(this.keyframes[i]);
                    }
                }
            }
        },

        /** @class A physical simulation.
         */
        Simulation:function() {
            $W.anim.ProceduralAnimation.call(this); // subclass of ProceduralAnimation

            /** Bounding sphere radius */
            this.radius = 1;
            /** Object mass */
            this.mass = 1;
            /** Object velocity */
            this.velocity = Vector.Zero(3);
            /** Angular velocity */
            this.omega = Vector.Zero(3);

            this.update = function(dt) {
                // calculate forces
                // integrate position/rotation
                // update momentum
                // calculate velocities
            }

        }

    },


    /** @namespace Texture classes */
    texture:{
        /** A dynamic texture from a `video` element.    
         * XXX Can I use createElement('video') and eliminate need for id?
         * @param {String} name The global name this texture will be referenced
         * by elsewhere.
         * @param {String} id Video element id. 
         */
        Video: function(name, id) {
            this.texture = $W.GL.createTexture();
            this.video = document.getElementById(id);

            this.video.texture = this;
            $W.textures[name]  = this;

            this.update = function() {
                with ($W.GL) {
                    bindTexture(TEXTURE_2D, this.texture.texture);
                    texImage2D(TEXTURE_2D, 0, this.texture.video);
                    texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
                    texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
                    //generateMipmap(TEXTURE_2D);
                    //bindTexture(TEXTURE_2D, null); // clean up after ourselves
                }
            }

            this.video.play();
            this.video.addEventListener("timeupdate", this.update, true);

        },

        /** A static texture from an image file.
         * @param {String} name The global name this texture will be referenced
         * by elsewhere.
         * @param {String} src Path to image file.
         */
        Image: function(name, src) {
            this.texture = $W.GL.createTexture();
            this.image = new Image();

            this.image.texture = this;
            $W.textures[name]  = this;

            this.image.onload = function() {
                with ($W) {
                    console.group('Loading texture `' + name + "`");
                    with (GL) {
                        bindTexture(TEXTURE_2D, this.texture.texture);
                        texImage2D(TEXTURE_2D, 0, this.texture.image);
                        texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
                        texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
                        //bindTexture(TEXTURE_2D, null); // clean up after ourselves
                    }
                    console.log('Done');
                    console.groupEnd();
                }                 
            }

            this.setSource = function(src) {
                this.image.src = src;
            }

            if (src !== undefined) {
                this.setSource(src);
            }
        }
    },

    // Classes
    /** @class Quaternion implementation.
     * based on reference implementation at 
     * http://3dengine.org/Quaternions
     */
    Quaternion:function() {
        // Called as Quaternion(x, y, z, theta)
        if (arguments.length == 4) {
            var angle = (arguments[3] / 180.0) * Math.PI;
            var result = Math.sin(angle / 2);
            this.w = Math.cos(angle / 2);
            this.x = arguments[0] * result;
            this.y = arguments[1] * result;
            this.z = arguments[2] * result;

        // Called as Quaternion([w, x, y, z])
        }else if (arguments[0] != undefined && arguments[0].length == 4) {
            this.w = arguments[0][0];
            this.x = arguments[0][1];
            this.y = arguments[0][2];
            this.z = arguments[0][3];

        // Called as Quaternion()
        }else {
            this.w = 1;
            this.x = 0;
            this.y = 0;
            this.z = 0;
        }

        this.matrix = function() {
            var w = this.w;
            var x = this.x;
            var y = this.y;
            var z = this.z;
            var xx = x * x;
            var yy = y * y;
            var zz = z * z;
            var xy = x * y;
            var xz = x * z;
            var xw = x * w;
            var yz = y * z;
            var yw = y * w;
            var zw = z * w;

            var m = [[],[],[],[]];

            m[0][0] = 1 - 2 * (yy + zz);
            m[0][1] = 2 * (xy + zw);
            m[0][2] = 2 * (xz - yw);
            m[0][3] = 0;
            m[1][0] = 2 * (xy - zw);
            m[1][1] = 1 - 2 * (xx + zz);
            m[1][2] = 2 * (yz + xw);
            m[1][3] = 0;
            m[2][0] = 2 * (xz + yw);
            m[2][1] = 2 * (yz - xw);
            m[2][2] = 1 - 2 * (xx + yy);
            m[2][3] = 0;
            m[3][0] = 0;
            m[3][1] = 0;
            m[3][2] = 0;
            m[3][3] = 1;
            
            return $M(m);
        }

        this.multiply = function(q) {
            var result = new $W.Quaternion();
            result.w = this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z;
            result.x = this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y;
            result.y = this.w * q.y + this.y * q.w + this.z * q.x - this.x * q.z;
            result.z = this.w * q.z + this.z * q.w + this.x * q.y - this.y * q.x;
            return result;
        }
    },

    /** @class Quaternion implementation XXX broken */
    /*
    Quaternion:function(m) {
        this.vec = Vector.Zero(4);

        if (m !== undefined) {

            var s = Math.sqrt(m.e(0,0) + m.e(1,1) + m.e(2,2) + 1) / 2;

            var c = 1 - (2 * this.s * this.s); // c = 1 - 2s^2;

            var x = Math.sqrt(m.e(0,0) + c) / 2;
            var y = Math.sqrt(m.e(1,1) + c) / 2;
            var z = Math.sqrt(m.e(2,2) + c) / 2;

            this.vec.setElements([s,x,y,z]);
        } 

        this.s = function() { return this.vec.e(1); }
        this.x = function() { return this.vec.e(2); }
        this.y = function() { return this.vec.e(3); }
        this.z = function() { return this.vec.e(4); }

        this.add = function(q) {
            result = new $W.Quaternion();

            result.vec.setElements((this.vec.add(q.vec)).elements);

            return result;
        }
    },
    */

    /** @class Common state representation (position, rotation, scale).
     * A position, rotation, and scale.
     * @param {3 Array} pos Position.
     * @param {3 Array} rot Rotation.
     * @param {3 Array} scl Scale.
     */
    ObjectState:function(position, rotation, scale) {
        if (arguments.length == 3) {
            this.position	= $V(position);
            this.rotation	= $V(rotation);
            this.scale      = $V(scale);
        }else {
            this.position	= Vector.Zero(3);
            this.rotation	= Vector.Zero(3);
            this.scale      = $V([1,1,1]);
        }


        /*
        var mx = Matrix.RotationX(this.rotation.e(1) * Math.PI / 180.0);
        var my = Matrix.RotationY(this.rotation.e(2) * Math.PI / 180.0);
        var mz = Matrix.RotationZ(this.rotation.e(3) * Math.PI / 180.0);

        this.m = (mx.multiply(my)).multiply(mz); // Get complete rotation matrix
        */

        //this.q = new $W.Quaternion(this.m);

        /** Set a new position. */
        this.setPosition = function(x, y, z) { 
            this.position.elements = [x, y, z]; 
        }

        /** Set a new rotation. */
        this.setRotation = function(x, y, z) { 
            this.rotation.elements = [x, y, z]; 
        }

        /** Set a new scale. */
        this.setScale = function(x, y, z){ 
            this.scale.elements    = [x, y, z]; 
        }


        this.equals = function(other) {
            if ((other.scale != undefined &&
                        other.position != undefined &&
                        other.rotation != undefined) && (

                            this.scale == other.scale &&
                            this.position == other.position &&
                            this.rotation == other.rotation )) {

                return true;
            }else {
                return false;
            }
        }
    },

    /** @class Contains pertinent render information for an individual renderable entity.
     *
     * Make sure to set vertexCount correctly
     * Animations are clunky right now, I'm working on it.
     *
     * @param type The type of rendering to use for this object, possible values
     * are:<br>
     * $W.GL.POINTS         <br>
     * $W.GL.LINES          <br>
     * $W.GL.LINE_LOOP      <br>
     * $W.GL.LINE_STRIP     <br>
     * $W.GL.TRIANGLES      <br>
     * $W.GL.TRIANGLE_STRIP <br>
     * $W.GL.TRIANGLE_FAN   <br>
     * @param {Boolean} shouldAdd Set to false to not add this the the object
     * list in case you want to handle rendering in a specific manner, e.g. as
     * the child of another object.
     */
    Object:function (type, shouldAdd) {
        console.group("Creating object");

        if (!(shouldAdd === false)) {
            $W.addObject(this);
        }

        /** Name of shader program used to render this object */
        this.shaderProgram = 'default';

        /** Number of vertices in this object.
         * Used when rendering with drawArrays.
         */
        this.vertexCount = 0;

        /* The type of rendering to use for this object, possible values are:<br>
         * $W.GL.POINTS         <br>
         * $W.GL.LINES          <br>
         * $W.GL.LINE_LOOP      <br>
         * $W.GL.LINE_STRIP     <br>
         * $W.GL.TRIANGLES      <br>
         * $W.GL.TRIANGLE_STRIP <br>
         * $W.GL.TRIANGLE_FAN   <br>
         */
        this.type = type; // render type (wglu.GL.LINES, wglu.GL.POINTS, wglu.GL.TRIANGLES, etc.)

        this._elements = false;
        this._elementBuffer = null;;
        this._elementCount = 0;

        /** WebGL array buffers for attribute data. */
        this.buffers    = [];

        /** WebGL*array's of attribute data. */
        this.arrays 	= [];
        this._debugArrays = [];

        /** Names of textures this object uses. */
        this.textures 	= [];

        this._children = [];

        $W.ObjectState.call(this);

        /** The animation for this object. */
        this.animation = new $W.anim.ProceduralAnimation();

        this._drawFunction = null;

        /** Set the shader program to the named program 
         * @param {String} program Program name.
         */
        this.setShaderProgram = function (program) {
            this.shaderProgram = program
        }

        /** Add an object as a child to this object.
         * @param {Object} obj The object to add as a child.
         */
        this.addChild = function(obj) {
            this._children.push(obj);
        }

        /** Set the indices for the elements of this object.
         * Draws this object with drawElements unless set with
         * false.
         * @param {Array|Boolean} elements The array of indices of the
         * elements or false, which disabled drawElements rendering
         * for this object.
         */
        this.setElements = function(elements) {
            // don't use drawElements
            if (elements === false) {
                this._elements = false;
                this._drawFunction = this._drawArrays();

            // use drawElements
            }else {
                this._elements = elements.flatten();
                this._elementCount = this._elements.length;
                this._elementBuffer = $W.GL.createBuffer();
                this._drawFunction = this._drawElements();
            }
        }

        /** Fills the array of the given name, where name is a 
         * vertex attribute in the shader. 
         * Also creates a buffer to hold the data in WebGL.
         * @param {String} name The attribute variable name in a shader
         * attached to the shader program used by this object. (this is
         * not verified for you)
         * @param {Array} contents The data to pass to the attribute.
         */
        this.fillArray = function(name, contents) {
            console.log("Filling `" + name + "` array");
            this._debugArrays = contents;
            this.arrays[name] = new WebGLFloatArray(contents.flatten());

            if (this.buffers[name] === undefined) {
                this.buffers[name] = $W.GL.createBuffer();
            }
        }

        /** XXX Not working Buffers the data for this object once. */
        this.bufferArrays = function() {
            var gl = $W.GL;
            var prg= $W.programs[this.shaderProgram];
            //with ($W.GL){ with ($W.programs[this.shaderProgram]) {

            for (var i = 0; i < prg.attributes.length; i++) {
                try{
                    if (this.arrays[prg.attributes[i].name] != undefined) {
                        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[prg.attributes[i].name]);
                        gl.bufferData(gl.ARRAY_BUFFER, this.arrays[prg.attributes[i].name], 
                                gl.STATIC_DRAW);
                        gl.vertexAttribPointer(prg.attributes[i].location, 
                                prg.attributes[i].length, 
                                gl.FLOAT, false, 0, 0);

                        gl.enableVertexAttribArray(prg.attributes[i].location);
                    }
                }catch (err) {
                    console.error(e);
                }
            }

            if (!(this._elements === false)) {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._elementBuffer);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new WebGLUnsignedShortArray(this._elements), 
                        gl.STATIC_DRAW);
            }

            //}}
        }

        /** XXX Not working Binds the data buffers for rendering. */
        this.bindBuffers = function() {
            var gl = $W.GL;
            var prg= $W.programs[this.shaderProgram];
            //with ($W.GL){ with ($W.programs[this.shaderProgram]) {

            for (var i = 0; i < prg.attributes.length; i++) {
                try {
                    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[prg.attributes[i].name]);
                    gl.bufferData(gl.ARRAY_BUFFER, this.arrays[prg.attributes[i].name], gl.STATIC_DRAW);
                    gl.vertexAttribPointer(prg.attributes[i].location, 
                            prg.attributes[i].length, 
                            gl.FLOAT, false, 0, 0);
                    gl.enableVertexAttribArray(prg.attributes[i].location);
                }catch (e) {
                    console.error(e);
                    //$W.draw = function() {};
                    // Stop rendering after error
                }
            }

            if (!(this._elements === false)) {
                $W.GL.bindBuffer($W.GL.ELEMENT_ARRAY_BUFFER, this._elementBuffer);
            }
            //}}
        }

        /** Buffer all the data stored in this object's attribute
         * arrays and set vertexAttribPointers for them.
         * XXX I'm pretty sure this is naive. I think I can buffer once,
         * then just rebind when I draw
         */
        this._bufferArrays = function() {
            var program = $W.programs[this.shaderProgram];

            for (var i = 0; i < program.attributes.length; i++) {
                var name  	  = program.attributes[i].name; 
                var attribute = program.attributes[i].location;
                var length 	  = program.attributes[i].length;
                var buffer 	  = program.attributes[i].buffer;

                try{
                    $W.GL.bindBuffer($W.GL.ARRAY_BUFFER, this.buffers[name]);
                    $W.GL.bufferData($W.GL.ARRAY_BUFFER, 
                            this.arrays[name], $W.GL.STATIC_DRAW);

                    $W.GL.vertexAttribPointer(attribute, length, $W.GL.FLOAT, false, 0, 0);
                    $W.GL.enableVertexAttribArray(attribute);
                }catch (err) {
                    
                    if (this.arrays[name] === undefined) {
                        // Fail silently
                        //console.error("data for `" + name + "` attribute does not exist");
                    }
                }
            }

            
            // if elements aren't disabled
            // XXX convert to callback to avoid `if`
            if (!(this._elements === false)) {
                $W.GL.bindBuffer($W.GL.ELEMENT_ARRAY_BUFFER, this._elementBuffer);
                $W.GL.bufferData($W.GL.ELEMENT_ARRAY_BUFFER,new WebGLUnsignedShortArray(this._elements), 
                        $W.GL.STATIC_DRAW);
            }
        }


        /** Bind the textures for this object.
         * XXX Will only work with single texturing
         */
        this.bindTextures = function() {
            var gl = $W.GL;
            for (var i = 0; i < this.textures.length; i++) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, $W.textures[this.textures[i]].texture);
                gl.uniform1i(gl.getUniformLocation($W.programs[this.shaderProgram].glProgram, 'sampler'), 0);
            }
        }

        // XXX these are also clunky
        /** @returns {Vector} The sum of the object's base position and its 
         * animation.
         */
        this.animatedPosition = function() { 
            return this.position.add(this.animation.position); 
        }

        /** @returns {Vector} The sum of the object's base rotation and its 
         * animation. 
         */
        this.animatedRotation = function() { 
            return this.rotation.add(this.animation.rotation); 
        }

        /** @returns {Vector} The product of the object's base scale and its 
         * animation. 
         */
        this.animatedScale    = function() { 
            return $V([
                this.scale.e(1) * this.animation.scale.e(1),
                this.scale.e(3) * this.animation.scale.e(2),
                this.scale.e(3) * this.animation.scale.e(3)
            ]);
        }

        /** Set the x y and z components of the object's scale to the given
         * value.
         * @param {Number} s New scale of the object.
         */
        this.setScaleUniformly = function(s) { 
            this.scale = $V([s,s,s]); 
        }

        // These allow us to do array or element drawing without
        // testing a boolean every frame
        this._drawArrays = function() {
            return (function() {
                try {
                    $W.GL.drawArrays(this.type, 0, this.vertexCount)
                }catch (e) {
                    console.error(e);
                }
            });
        }

        this._drawElements = function() {
            return (function() {
                try {
                    $W.GL.drawElements(this.type, this._elementCount, 
                        $W.GL.UNSIGNED_SHORT, this._elements);
                }catch (e) {
                    console.error(e);
                }
            });
        }

        // drawArrays by default
        this._drawFunction = this._drawArrays();
        
        /** draw this object at the given postion, rotation, and scale
         * @param {Vector} pos The position to draw at.
         * @param {Vector} rot The rotation to rotate by.
         * @param {Vector} scale The scale to scale by.
         */
        this.drawAt = function(pos, rot, scale) {
                $W.modelview.pushMatrix();
                $W.modelview.translate(pos.elements);

                /*
                var rotation = $W.util.getAxisAngle(rot);
                $W.modelview.rotate(rotation.angle, rotation.axis);
                */

                $W.modelview.rotate(rot.e(1), [0, 1, 0]);
                $W.modelview.rotate(rot.e(2), [1, 0, 0]);
                $W.modelview.rotate(rot.e(3), [0, 0, 1]);
                $W.modelview.scale(scale.elements);

                for (var i = 0; i < this._children.length; i++) {
                    this._children[i].draw();
                }

                $W.programs[this.shaderProgram].use();
                
                $W.programs[this.shaderProgram].processUniforms();
                $W.modelview.popMatrix();

                //this.bindBuffers();
                this._bufferArrays();
                this.bindTextures();
                this._drawFunction();

        }

        /** draw this object at its internally stored position, rotation, and
         * scale, INCLUDING its current animation state.
         */
        this.draw = function() {
            this.drawAt(
                this.animatedPosition(), 
                this.animatedRotation(), 
                this.animatedScale()
            );
        }

        /** Update this object's animation state. 
         * @param {Number} dt The delta time since the previous call to
         * update.
         */
        this.update = function(dt) {
            this.animation.update(dt);

            for (var i = 0; i < this._children.length; i++) {
                this._children[i].update(dt);
            }
        }

        console.groupEnd();
    },

    /** 
     * Useful, but not necessay if provide your own draw calls
     * @class Keeps track of viewport camera characteristics. 
     */
    Camera:function() {
        $W.ObjectState.call(this); // subclass of ObjectState

        /** Vertical field of view in degrees. */
        this.yfov = 75;

        /** Aspect ratio */
        this.aspectRatio = 1;

        /** Coordinates the camera will point at.
         * @type {Vector}
         */
        this.target = $V([0,0,0]);

        /** Set a new target for the camera .
         * Changes the camera target without recreating the
         * target vector.
         */
        this.setTarget = function(x, y, z) {
            this.target.elements = [x, y, z];
        }

        /** Per frame update.
         * Replace as needed.
         */
        this.update = function() {}
    },


    /** @class Keeps track of time since application start.
     * Provides delta time between ticks.
     */
    Timer:function () {
        /** The time passed since this timer was started to the time of
         * the most recent tick in milliseconds.
         */
        this.age = 0;

        /** The current application time in milliseconds. */
        this.t  = (new Date()).getTime();

        /** The delta time between the previous two ticks. */
        this.dt = 0;

        /** The time of the previous tick */
        this.pt = this.t;

        /** Update the timer */
        this.tick = function() {
            this.t = (new Date()).getTime();
            this.dt = this.t - this.pt;
            this.pt = this.t;
            this.age += this.dt;
        }

        /** The time passed since this timer was started to the time of
         * the most recent tick in seconds.
         */
        this.ageInSeconds = function() {
            return this.age / 1000;
        }
    },

    /** @class Provides an easy way to track FPS. */
    FPSTracker:function () {
        /** Number of frames to average over. */
        this.frameAvgCount = 20;  

        // frame timing statistics
        
        /** Milliseconds per frame. */
        this.mspf= 0; 

        /** Frames per second. */
        this.fps = 0;

        this.recentFPS = []; // last several FPS calcs to average over

        /** Update the FPS. */
        this.update = function(dt) {
            this.mspf += dt; // add this past frame time and renormalize
            this.mspf /= 2;

            if (this.recentFPS.unshift(Math.floor(1000 / this.mspf)) > this.frameAvgCount) {
                this.recentFPS.pop();
            } // average FPS over the past frameAvgCount frames
            
            this.fps = 0;
            for (var i = 0; i < this.recentFPS.length; i++) {
                this.fps += this.recentFPS[i];
            }
            this.fps /= this.recentFPS.length;
        }
    },


    /** @namespace Functions with similar functionaliy to the original GLU
     * libraries.
     */
    GLU:{
       /** Given a point in screen-space, transform to an object-space point */
       unproject:function(winX, winY, winZ, model, proj, view) {
           if (model === undefined) model = $W.modelview.matrix;
           if (proj === undefined) proj = $W.projection.matrix;
           if (view === undefined) view = [0,0, $W.canvas.width, $W.canvas.height];

           var pickMatrix = (model.multiply(proj)).inverse();

       },
        
       /* @class Operates similarly to the standard OpenGL built in matricies. 
        * However * it is not identical. Rather than calling glMatrixMode, 
        * you specify the matrix you want to modify prior to the call.
        * e.g. if `myTranslationVector` is the vector to translate by then to 
        * translate the ModelView matrix you would call
        * `$W.modelview.translate(myTranslationVector);`
        */
        MatrixStack:function()  {
            this._matrixStack = [];
            this.matrix = Matrix.I(4);

            /** converts the matrix to the format we need when we send it to 
             * a shader.
             * @returns {WebGLFloatArray} The matrix as a flattened array.
             */
            this.getForUniform = function() {
               return new WebGLFloatArray(this.matrix.flatten());
            }


            /** glPushMatrix
             * (c) 2009 Vladimir Vukicevic
             * @param {Matrix} [m=this.matrix] A Sylvester matrix to add on 
             * top of the stack.
             */
            this.pushMatrix = function (m) {
                if (m) {
                    this._matrixStack.push(m.dup());
                    this.matrix = m.dup();
                } else {
                    this._matrixStack.push(this.matrix.dup());
                }
            }

            /** glPopMatrix
             * (c) 2009 Vladimir Vukicevic
             */
            this.popMatrix = function () {
                if (this._matrixStack.length === 0) {
                    throw "Invalid popMatrix!";
                }
                this.matrix = this._matrixStack.pop();
                return this.matrix;
            }

            /** glMultMatrix
             * (c) 2009 Vladimir Vukicevic
             * @param {Vector} m A Sylvester matrix to multiply by.
             */
            this.multMatrix = function (m) {
                this.matrix = this.matrix.x(m);
            }

            /** glTranslate
             * (c) 2009 Vladimir Vukicevic
             * @param {Vector} v A Sylvester vector to translate by
             */
            this.translate = function (v) {
                var m = Matrix.Translation($V([v[0],v[1],v[2]])).ensure4x4();
                this.multMatrix(m);
            }

            /** glRotate
             * (c) 2009 Vladimir Vukicevic
             * @param {Number} ang Angle to rotate by.
             * @param {Vector} v A Sylvester vector to rotate around.
             */
            this.rotate = function (ang, v) {
                var arad = ang * Math.PI / 180.0;
                var m = Matrix.Rotation(arad, $V([v[0], v[1], v[2]])).ensure4x4();
                this.multMatrix(m);
            }

            /** glScale
             * (c) 2009 Vladimir Vukicevic
             * @param {Vector} v A Sylvester vector to scale by.
             */
            this.scale = function (v) {
                var m = Matrix.Diagonal([v[0], v[1], v[2], 1]);
                this.multMatrix(m);
            }

            /** invert
             * (c) 2009 Vladimir Vukicevic
             */
            this.invert = function () {
                this.matrix = this.matrix.inv();
            }

            /** glLoadIdentity
             * (c) 2009 Vladimir Vukicevic
             */
            this.loadIdentity = function () {
                this.matrix = Matrix.I(4);
            }
        },

        //----------------------------
        // these are like the OpenGL functions of the same name
        
        /** glLookAt
         * (c) 2009 Vladimir Vukicevic
         */
        lookAt : function (ex, ey, ez,
                                tx, ty, tz,
                                ux, uy, uz) {
            var eye = $V([ex, ey, ez]);
            var target = $V([tx, ty, tz]);
            var up = $V([ux, uy, uz]);

            var z = eye.subtract(target).toUnitVector();
            var x = up.cross(z).toUnitVector();
            var y = z.cross(x).toUnitVector();

            var m = $M([[x.e(1), x.e(2), x.e(3), 0],
                    [y.e(1), y.e(2), y.e(3), 0],
                    [z.e(1), z.e(2), z.e(3), 0],
                    [0, 0, 0, 1]]);

            var t = $M([[1, 0, 0, -ex],
                    [0, 1, 0, -ey],
                    [0, 0, 1, -ez],
                    [0, 0, 0, 1]]);
            return m.x(t);
        },

        /** glOrtho
         * (c) 2009 Vladimir Vukicevic
         */
        ortho : 
            function (left, right,
                    bottom, top,
                    znear, zfar)
            {
                var tx = -(right+left)/(right-left);
                var ty = -(top+bottom)/(top-bottom);
                var tz = -(zfar+znear)/(zfar-znear);

                return $M([[2/(right-left), 0, 0, tx],
                        [0, 2/(top-bottom), 0, ty],
                        [0, 0, -2/(zfar-znear), tz],
                        [0, 0, 0, 1]]);
            },

        /** glFrustrum
         * (c) 2009 Vladimir Vukicevic
         */
        frustrum : 
            function (left, right,
                    bottom, top,
                    znear, zfar)
            {
                var X = 2*znear/(right-left);
                var Y = 2*znear/(top-bottom);
                var A = (right+left)/(right-left);
                var B = (top+bottom)/(top-bottom);
                var C = -(zfar+znear)/(zfar-znear);
                var D = -2*zfar*znear/(zfar-znear);

                return $M([[X, 0, A, 0],
                        [0, Y, B, 0],
                        [0, 0, C, D],
                        [0, 0, -1, 0]]);
            },

        /** glPerpective
         * (c) 2009 Vladimir Vukicevic
         */
        perspective : 
            function (fovy, aspect, znear, zfar)
            {
                var ymax = znear * Math.tan(fovy * Math.PI / 360.0);
                var ymin = -ymax;
                var xmin = ymin * aspect;
                var xmax = ymax * aspect;
     
                return $W.GLU.frustrum(xmin, xmax, ymin, ymax, znear, zfar);
            }
    },

    /** 
     * Initialize the WebGLU system, optionally initizlizing the WebGL
     * subsystem.
     * canvasNode - the DOM node of a canvas element to init WebGL,
     *              defaults to using the DOM element with ID 'canvas'.
     *              Pass `false` to skip init of WebGL subsystem.
     */
    initialize:function(canvasNode) {
        $W.initLogging();
        console.groupCollapsed("Initializing WebGLU");

        // Prep the shader subsystem
        $W.GLSL.initialize();

        // create the matrix stacks we'll be using to store transformations
        $W.modelview  = new $W.GLU.MatrixStack();
        $W.projection = new $W.GLU.MatrixStack();

        $W.camera     = new $W.Camera();
        $W.timer      = new $W.Timer();
        $W.fpsTracker = new $W.FPSTracker();

        var success = true;
        if (canvasNode === false) {
            console.log("WebGL init skipped");
        }else {
            success = $W.initWebGL(canvasNode);
        }

        console.groupEnd();
        return success;
    },

    /** 
     * We'll always need some sort of math lib, so I don't
     * feel bad semi-hardcoding it.
     * XXX Not working
     */
    loadSylvester:function() {
        syl = document.createElement("script");
        syl.type = "text/javascript";
        syl.src = $W.paths.external + $W.paths.sylvester;
        document.body.appendChild(syl);


        // XXX HACK!
        var start = new Date();
        while ((new Date()) - start < 2000){}

        if (typeof(Matrix) !== "undefined") {
            $W.augmentSylvester();
            console.log("Sylvester loaded");
        }else {
            console.error("Sylvester failed to load");
        }
    },

    /** Ensure that we can log, or at least not error if we try to */
    initLogging:function() {
        if (window.console === undefined) console = {}; // Dummy object

        if (console.log === undefined) {
            console.log = function(){};
            if (console.warn === undefined) console.warn = function(){};
            if (console.error === undefined) console.error = function(){};
            if (console.group === undefined) console.group = function(){};
            if (console.groupEnd === undefined) console.groupEnd = function(){};
        }else {
            // If console.log exists, but one or more of the others do not,
            // use console.log in those cases.
            if (console.warn === undefined) console.warn         = console.log;
            if (console.error === undefined) console.error       = console.log;
            if (console.group === undefined) console.group       = console.log;
            if (console.groupCollapsed === undefined) console.groupCollapsed = console.log;
            if (console.groupEnd === undefined) console.groupEnd = console.log;
        }

    },

    /** Setup the WebGL subsytem.
     * Create a WebGL context on the given canvas.
     *
     * XXX Can't yet handle multiple canvii
     * @param canvas DOM node or element id of a canvas.
     */
    initWebGL: function(canvas) {
        if (canvas === undefined) {
            $W.canvas = document.getElementById('canvas');

        }else if (typeof(canvas) == "string") {
            $W.canvas = document.getElementById(canvas);

        }else { $W.canvas = canvas; }

        $W.GL = null;
        $W.GL = $W.util.getGLContext($W.canvas);

        if ($W.GL !== null) {
            $W.constants.VERTEX = $W.GL.VERTEX_SHADER;
            $W.constants.FRAGMENT = $W.GL.FRAGMENT_SHADER;

            // on by default
            $W.GL.enable(this.GL.DEPTH_TEST);

            $W.newProgram('default');

            // XXX Fragile paths
            $W.programs['default'].attachShader('defaultVS', $W.paths.shaders + 'default.vert');
            $W.programs['default'].attachShader('defaultFS', $W.paths.shaders + 'default.frag');
            $W.programs['default'].link();


            console.log('WebGL initialized');
            return true;
        }else {
            console.log('WebGL init failed');
            return false;
		}
    },


    /** Create a new ShaderProgram and add it to the program list.
     * @param {String} name The global name for this program.
     */
    newProgram: function(name) {
        this.programs[name] = new $W.GLSL.ShaderProgram(name);
    },
            
    /** Add the given object to the object list.
     * @param {Object} obj The object to add.
     */
    addObject: function(obj) {
        this.objects.push(obj);
    },


    /** Draw all objects from the camera's perspective. */
    draw: function() {
        $W.clear();

        $W.modelview.loadIdentity();
        $W.projection.loadIdentity();

        $W.projection.multMatrix(
            $W.GLU.perspective( $W.camera.yfov, $W.camera.aspectRatio, 
                                0.01, 10000)); 
        $W.projection.multMatrix($W.GLU.lookAt(
            $W.camera.position.e(1),
            $W.camera.position.e(2),
            $W.camera.position.e(3),
            $W.camera.target.e(1),
            $W.camera.target.e(2),
            $W.camera.target.e(3),
            0,1,0));

        $W.modelview.rotate($W.camera.rotation.e(1), [1, 0, 0]);
        $W.modelview.rotate($W.camera.rotation.e(2), [0, 1, 0]);
        $W.modelview.rotate($W.camera.rotation.e(3), [0, 0, 1]);

        $W._drawObjects();                            
    },

	_updateState : function() {
		$W.timer.tick();
		$W.fpsTracker.update($W.timer.dt);
		$W.FPS = Math.round($W.fpsTracker.fps);
	},

    /** Update all objects. */
	update : function() {
		$W._updateState();

        for (var i = 0; i < this.objects.length; i++) {
            $W.objects[i].update($W.timer.dt);
        }

        $W.camera.update();
	},

    _drawObjects : function() {
        for (var i = 0; i < $W.objects.length; i++) {
            $W.objects[i].draw();
        }
    },

    /** Clear the canvas */
	clear : function() {
		// clearing the color buffer is really slow
		$W.GL.clear($W.GL.COLOR_BUFFER_BIT|$W.GL.DEPTH_BUFFER_BIT);
	}
}

// Utility functions
//--------------------------------------------------------------------------
// Takes a 2D array [[1,2],[3,4]] and makes it 1D [1,2,3,4]
//--------------------------------------------------------------------------
Array.prototype.flatten = function() {
    var res = [];
    for (var i = 0; i < this.length; i++) {
        res = res.concat(this[i]);
    }
    return res;
}

Array.prototype.remove = function(item) {
	var res = [];

    if (item.equals !== undefined) {
        for (var i = 0; i < this.length; i++) {
            if (!(item.equals(this[i]))) {
                res.push(this[i]);
            }
        }
    }else{
        for (var i = 0; i < this.length; i++) {
            if (this[i] != item) {
                res.push(this[i]);
            }
        }
    }

	return res;
}


/* Calculate normals at each vertex in vertices, by looking
 * at triangles formed by every face and averaging.
 * (c) 2009 Vladimir Vukicevic
 */
function calculateNormals(vertices, faces)
{
    var nvecs;

    if (vertices[0].length == 3) {
        nvecs = new Array(vertices.length);

        for (var i = 0; i < faces.length; i++) {
            var j0 = faces[i][0];
            var j1 = faces[i][1];
            var j2 = faces[i][2];

            var v1 = $V(vertices[j0]);
            var v2 = $V(vertices[j1]);
            var v3 = $V(vertices[j2]);


            var va = v2.subtract(v1);
            var vb = v3.subtract(v1);

            var n = va.cross(vb).toUnitVector();

            if (!nvecs[j0]) nvecs[j0] = [];
            if (!nvecs[j1]) nvecs[j1] = [];
            if (!nvecs[j2]) nvecs[j2] = [];

            nvecs[j0].push(n);
            nvecs[j1].push(n);
            nvecs[j2].push(n);
        }

    }else { // handle flattened arrays
        nvecs = new Array(vertices.length / 3)

        for (var i = 0; i < faces.length; i+=3) {
            var j0 = faces[i+0];
            var j1 = faces[i+1];
            var j2 = faces[i+2];

            var v1 = $V([vertices[j0], vertices[j0+1], vertices[j0+2]]);
            var v2 = $V([vertices[j1], vertices[j2+1], vertices[j2+2]]);
            var v3 = $V([vertices[j2], vertices[j2+1], vertices[j2+2]]);


            var va = v2.subtract(v1);
            var vb = v3.subtract(v1);

            var n = va.cross(vb).toUnitVector();

            if (!nvecs[j0]) nvecs[j0] = [];
            if (!nvecs[j1]) nvecs[j1] = [];
            if (!nvecs[j2]) nvecs[j2] = [];

            nvecs[j0].push(n);
            nvecs[j1].push(n);
            nvecs[j2].push(n);
        }
    }

    var normals = new Array(vertices.length);

    // now go through and average out everything
    for (var i = 0; i < nvecs.length - 1; i++) {
        var count = nvecs[i].length;
        var x = 0;
        var y = 0;
        var z = 0;

        for (var j = 0; j < count; j++) {
            x += nvecs[i][j].elements[0];
            y += nvecs[i][j].elements[1];
            z += nvecs[i][j].elements[2];
        }

        normals[i] = [x/count, y/count, z/count];
    }

    return normals;
}

// returns the index into this array of
// if it's an array of arrays it assumes the
// item in the first index of each subarry
// is the key.
Array.prototype.indexOf = function(item) {
	for (var i = 0; i < this.length; i++) {
        if (!this[i].length) {
            if (this[i] == item) {
                return i;
            }
        }else {
            if (this[i][0] == item) {
                return i;
            }
        }
	}

    return undefined;
}

//--------------------------------------------------------------------------
//
// augment Sylvester some
// (c) 2009 Vladimir Vukicevic
Matrix.Translation = function (v)
{
    if (v.elements.length == 2) {
        var r = Matrix.I(3);
        r.elements[2][0] = v.elements[0];
        r.elements[2][1] = v.elements[1];
        return r;
    }

    if (v.elements.length == 3) {
        var r = Matrix.I(4);
        r.elements[0][3] = v.elements[0];
        r.elements[1][3] = v.elements[1];
        r.elements[2][3] = v.elements[2];
        return r;
    }

    throw "Invalid length for Translation";
}


Matrix.prototype.trace = function() {
    return this[0][0] + this[1][1] + this[2][2];
}

Matrix.prototype.flatten = function ()
{
    var result = [];
    if (this.elements.length === 0) {
        return [];
    }


    for (var j = 0; j < this.elements[0].length; j++) {
        for (var i = 0; i < this.elements.length; i++) {
            result.push(this.elements[i][j]);
        }
    }
    return result;
}

Matrix.prototype.ensure4x4 = function()
{
    if (this.elements.length == 4 && 
            this.elements[0].length == 4) {
        return this;
    }

    if (this.elements.length > 4 ||
            this.elements[0].length > 4) {
        return null;
    }

    for (var i = 0; i < this.elements.length; i++) {
        for (var j = this.elements[i].length; j < 4; j++) {
            if (i == j) {
                this.elements[i].push(1);
            }else {
                this.elements[i].push(0);
            }
        }
    }

    for (var i = this.elements.length; i < 4; i++) {
        if (i === 0) {
            this.elements.push([1, 0, 0, 0]);
        }else if (i == 1) {
            this.elements.push([0, 1, 0, 0]);
        }else if (i == 2) {
            this.elements.push([0, 0, 1, 0]);
        }else if (i == 3) {
            this.elements.push([0, 0, 0, 1]);
        }
    }

    return this;
};

Matrix.prototype.make3x3 = function()
{
    if (this.elements.length != 4 ||
            this.elements[0].length != 4) {
        return null;
    }

    return Matrix.create([[this.elements[0][0], this.elements[0][1], this.elements[0][2]],
            [this.elements[1][0], this.elements[1][1], this.elements[1][2]],
            [this.elements[2][0], this.elements[2][1], this.elements[2][2]]]);
};

Vector.prototype.flatten = function ()
{
    return this.elements;
}; 
//--------------------------------------------------------------------------