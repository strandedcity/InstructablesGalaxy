$(document).ready(function(){
    Galaxy.Utilities = new Galaxy.Utils(Galaxy.Settings);
    Galaxy.Composers = [];

    var camera, renderer, interactionHandler;
    var particleSystemsArray = [], sky;
    var attributes, uniforms,shaderMaterialsArray = [];

    function initGalaxy(parsedData) {
        Galaxy.Utilities.projectData = parsedData;
        Galaxy.Datasource = parsedData;
        var instructableIds = _.keys(parsedData);

        // create geometries for each of the six rings, so the particle systems can move independently
        var particleGeometries = [];
        _.each(window.Galaxy.Settings.categories,function(){
            particleGeometries.push(new THREE.Geometry());

            attributes = {
                size: { type: 'f', value: [] },
                ca: { type: 'c', value: [] },
                alpha: { type: 'f', value: [] }
            };

            uniforms = {
                color: { type: "c", value: new THREE.Color( 0xffffff ) },
                texture: { type: "t", value: THREE.ImageUtils.loadTexture( "images/particle4B.png" ) }
            };

            shaderMaterialsArray.push(new THREE.ShaderMaterial( {
                uniforms: uniforms,
                attributes: attributes,
				vertexShader:   document.getElementById( 'vertexshader' ).textContent,
				fragmentShader: document.getElementById( 'fragmentshader' ).textContent,
                blending: THREE.AdditiveBlending,
                depthTest: false,
                transparent: true
            }));
        });

        _.each(instructableIds,function(id){
            var pX = parsedData[id].x - window.Galaxy.Settings.width/2,
                    pY = parsedData[id].y - window.Galaxy.Settings.height/2,
                    pZ = Galaxy.Utilities.random(0,10),
                    particle = new THREE.Vector3(pX, pY, pZ);

            // add each particle to the correct geometry (ring) so it will end up in an associated particle system later
            var ring = indexForCategory(parsedData[id].category);
            if (ring !== -1) {
                particleGeometries[ring].vertices.push(particle);

                var appearance = Galaxy.Utilities.vertexAppearanceByViews(parsedData[id].views);
                shaderMaterialsArray[ring].attributes.size.value.push(appearance.size);
                shaderMaterialsArray[ring].attributes.ca.value.push(appearance.ca);
                shaderMaterialsArray[ring].attributes.alpha.value.push(appearance.alpha);

                // we need to keep references both directions. User clicks particle, we need to look up details by id
                // Also, if we want to highlight related instructables, we'll need fast easy access to vertices with referenced ids.
                particle.instructableId = id;
                parsedData[id].particleMaterial = shaderMaterialsArray[ring];
                parsedData[id].vertexNumber = particleGeometries[ring].vertices.length-1;
            }
        });

        // main scene, for all regular galaxy appearances
        var scene = new THREE.Scene();
        Galaxy.Scene = scene;

        // Separate scene excluded from postprocessing effects for constellations and other things to appear "on top" of main scene
        var topScene = new THREE.Scene();
        Galaxy.TopScene = topScene;

        // create the particle system
        _.each(particleGeometries,function(particleGeometry, index){
            particleGeometry.applyMatrix( new THREE.Matrix4().makeTranslation( Math.random()*50, Math.random()*50, 0 ) );
            var system = new THREE.ParticleSystem(
                    particleGeometry,
                    shaderMaterialsArray[index]
                );
            particleSystemsArray.push(system);
            scene.add(system);
        });

        // set this reference
        Galaxy.Utilities.particleSystems = particleSystemsArray;

        renderer = new THREE.WebGLRenderer({canvas: $('#three-canvas').get(0)});
        renderer.setDepthTest(false);
        renderer.setSize(Galaxy.Settings.width,Galaxy.Settings.height);

        var background = Galaxy.Utilities.createGalaxyBackgroundMaterial(function(hex){
            $('body').addClass('ready');

            // "material" can be returned right away (just missing textures), but we don't know "hex" (the background color) until the texture image actually loads:
            // background color of the blessed pixel: console.log(hex);
            var backgroundColor = tinycolor(hex);
            backgroundColor = tinycolor.darken( backgroundColor,10);
            var lightness = backgroundColor.toHsl().l;
            if (lightness > 0.06) {
//                console.log("(darkening)");
                backgroundColor = tinycolor.darken( backgroundColor,12);
            }
//            console.log('lightness ',lightness);
            renderer.setClearColor( parseInt("0x"+backgroundColor.toHex()), 1 );
        });
        var material = background.material,
        geometry = new THREE.PlaneGeometry(1000, 1000);
        sky = new THREE.Mesh( geometry, material);
        scene.add( sky );

        camera = new THREE.PerspectiveCamera(Galaxy.Settings.cameraDefaultFOV, Galaxy.Settings.width / Galaxy.Settings.height, 1, 1000000000);
        camera.rotation.order = "YXZ";
        camera.position = Galaxy.Settings.cameraDefaultPosition.clone();
        camera.up.set(Galaxy.Settings.cameraDefaultUp.x,Galaxy.Settings.cameraDefaultUp.y,Galaxy.Settings.cameraDefaultUp.z);
        camera.lookAt(Galaxy.Settings.cameraDefaultTarget.clone());

        // Set up interaction handler
        interactionHandler = new Galaxy.InteractionHandler(camera, particleSystemsArray);

        // prepare secondary composer
        var renderTargetParameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBufer: false };
        var renderTarget = new THREE.WebGLRenderTarget( Galaxy.Settings.width,Galaxy.Settings.height, renderTargetParameters );
        var renderTarget2 = new THREE.WebGLRenderTarget( Galaxy.Settings.width,Galaxy.Settings.height, renderTargetParameters );

        Galaxy.ComposeScene = function(options){
            var composers = [];

            var mainComposer = new THREE.EffectComposer( renderer, renderTarget );
            var renderPass = new THREE.RenderPass( scene, camera );
            mainComposer.addPass( renderPass );

            if (_.isObject(options) && options.blur === true) {
                var bluriness = 0.9;

                // Prepare the blur shader passes
                var hblur = new THREE.ShaderPass( THREE.HorizontalBlurShader );
                hblur.uniforms[ "h" ].value = bluriness / Galaxy.Settings.width;
                mainComposer.addPass(hblur);

                var vblur = new THREE.ShaderPass( THREE.VerticalBlurShader );
                vblur.uniforms[ "v" ].value = bluriness / Galaxy.Settings.height;
                mainComposer.addPass( vblur );

                var brightnessContrastPass = new THREE.ShaderPass( THREE.BrightnessContrastShader );
                brightnessContrastPass.uniforms[ "brightness" ].value = -0.3;
                brightnessContrastPass.uniforms[ "contrast" ].value = -0.2;
                mainComposer.addPass(brightnessContrastPass);
            } else {
                mainComposer.addPass( new THREE.ShaderPass( THREE.CopyShader ) );
            }
            var topComposer = new THREE.EffectComposer(renderer, renderTarget2);
            var topRenderPass = new THREE.RenderPass(topScene,camera);
            topComposer.addPass(topRenderPass);
            topComposer.addPass( new THREE.ShaderPass( THREE.CopyShader ) );

            ////////////////////////////////////////////////////////////////////////
            // final composer will blend composer2.render() results with the scene
            ////////////////////////////////////////////////////////////////////////
            var blendPass = new THREE.ShaderPass( THREE.AdditiveBlendShader );
            blendPass.uniforms[ 'tBase' ].value = mainComposer.renderTarget1;
            blendPass.uniforms[ 'tAdd' ].value = topComposer.renderTarget1;
            var blendComposer = new THREE.EffectComposer( renderer );
            blendComposer.addPass( blendPass );
            blendPass.renderToScreen = true;

            composers.push(mainComposer,topComposer,blendComposer);


            return composers;

        };

        Galaxy.Composers = Galaxy.ComposeScene();

        // Start the animation:
        update();
    }

    function indexForCategory(categoryName) {
        return _.indexOf(window.Galaxy.Settings.categories,categoryName);
    }

    // animation loop
    function update() {
        // note: three.js includes requestAnimationFrame shim
        requestAnimationFrame(update);

        // Move things around as need be:
        if (interactionHandler.frozen === false) {
            particleSystemsArray[0].rotation.z -=  0.00008;
            particleSystemsArray[1].rotation.z +=  0.00002;
            particleSystemsArray[2].rotation.z +=  0.00012;
            particleSystemsArray[3].rotation.z -=  0.00009;
            particleSystemsArray[4].rotation.z +=  0.00016;
            particleSystemsArray[5].rotation.z -=  0.00005;
            sky.rotation.z += 0.00015;
        }

        // The little tags that travel with stars need to have updated positions
        interactionHandler.getTagManager().updateActiveTagPositions();

        // draw
        _.each(Galaxy.Composers,function(composer){
            composer.render();
        });
    }

    // Older code still uses kineticjs as a helper to place the geometries correctly.
    // It's not really necessary, but it's also not a big deal to use it.
    var SkyLayouter = new window.SkyLayouter(
        window.json,
        new Kinetic.Stage({
            container: 'container',
            width: 1920,
            height: $(document).height()-200
        })
    );
    delete window.json;

    initGalaxy(SkyLayouter.getNodes());
    SkyLayouter.destroy();

    // remove the KineticJS canvas.... not needed after initial star placement
    $('#container').remove();

});