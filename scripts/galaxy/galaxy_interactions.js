Galaxy.InteractionHandler = function (camera, particleSystemsArray){
    this.cameraMotions = new Galaxy.CameraMotions(camera);
    _.bindAll(this,'canvasClickEvent','selectVertex','clearConstellation','initiateSearch','displaySearchResultsForQuery','displayBadge');
    _.bindAll(this,'showChannel','showCategory','showAuthor','showInstructable','showRelated','getTagManager','resetInteractionTimer');

    // need status right away, in case we need to report something:
    this.__statusIndicator = new window.GalaxyStatusIndicator();

    this.camera = camera;
    this.particleSystemsArray = particleSystemsArray;
    this.frozen = false;

    this.__interactionTimer = null;
    this.__constellation = null;
    this.__onscreenKeyboardView = null;

    var that = this;
    $('#three-canvas').on('click',this.canvasClickEvent);

    // Because of the confusing contexts, it's a little easier to do this than to handle each of the types of links properly
    $(document).on('click','a',{context: that},this.clickAnchor);

    this.searchButton = new window.GalaxyToolbar();
    this.searchButton.on("requestSearchKeyboard",this.initiateSearch);

    this.__tagManager = new Galaxy.ProjectTagManager(particleSystemsArray,camera,Galaxy.Settings,Galaxy.Datasource);
    _.delay(function(){that.getTagManager().maintainTagCount(5);},5000);
    $(this.__tagManager).on('clickTag',function(e){
        that.resetInteractionTimer();
        that.clearProjectDescriptionLong(); // do this even if nothing else gets done
        if (that.cameraMotions.isAnimating === false) {
            that.showInstructable(e.instructableId);
        }
    });

    this.resetInteractionTimer();
}

Galaxy.InteractionHandler.prototype = {

    constructor: Galaxy.InteractionHandler,

    setFrozen: function(frozen){
        this.frozen = frozen;
        $(this).trigger({
            type: 'frozenStateChanged',
            frozen: true
        });
    },
    resetInteractionTimer: function(){
        if (!_.isNull(this.__interactionTimer)) clearTimeout(this.__interactionTimer);

        var that = this;
        this.__interactionTimer = setTimeout(function(){
            // user has been inactive. Reset the display
            that.reset({projectTagsClear: false, projectTagsAddAfterCameraReset: true},function(){
                that.cameraMotions.beginAutomaticTravel();
            });
        },90000)
    },
    clickAnchor: function(e){
        if ($(this).hasClass('visitInstructable')) return;
        e.preventDefault();
        e.stopPropagation();

        var that = e.data.context,
            clickedElement = $(this),
            referencedItem = clickedElement.attr('href');
        that.resetInteractionTimer();

        // HALT! The world is already moving how can you possibly want to click stuff NOW??
        if (that.cameraMotions.isAnimating === true) return;

        if (clickedElement.hasClass('showChannel')) {
            that.showChannel(referencedItem);
        } else if (clickedElement.hasClass('showCategory')) {
            that.showCategory(referencedItem);
        } else if (clickedElement.hasClass('showAuthor')) {
            that.showAuthor(referencedItem);
        } else if (clickedElement.hasClass('showRelations')) {
            that.showRelated(referencedItem);
        } else if (clickedElement.hasClass('showInstructable')) {
            that.showInstructable(referencedItem);
        } else if (clickedElement.hasClass('emailInstructable')) {
            var fullInstructable = clickedElement.data('instructableJSON');
            if (_.isUndefined(fullInstructable)) throw new Error("emailInstructable links must have data attributes containing instructable JSON");
            that.emailInstructable(fullInstructable);
        }
    },

    showChannel: function(channel){
        this.displayBadge("Showing "+ this.capitaliseFirstLetter(channel) + ".",false);

        var channelIbles = _.where(Galaxy.Datasource,{channel: channel});
        this.glowIbles(channelIbles);
        this.clearProjectDescriptionLong();

        var points = Galaxy.Utilities.worldPointsFromIbleIds(_.map(channelIbles,function(ibleData){return ibleData.id;}));
        this.cameraMotions.zoomToFitPointsFrom(points,this.cameraMotions.CAMERA_RELATION.SAME_ANGLE);
    },
    showCategory: function(category){
        this.displayBadge("Showing "+ this.capitaliseFirstLetter(category) + ".",false);

        this.reset({freezeMotion: true});
        this.glowIbles(_.where(Galaxy.Datasource,{category: category}));
    },
    showAuthor: function(author){
        var authorIbles = _.sample(_.where(Galaxy.Datasource,{author: author}),Galaxy.Settings.maxIblesPerAuthor),
            that = this,
            authorIblesAlternate = {};

        // TODO: This is sloppy
        _.each(authorIbles,function(ibledata){
            authorIblesAlternate[ibledata.id] = ibledata;
        });

        this.__tagManager.removeAllTags();

        // If there's just one project, tell the touch user that there's only one. Otherwise, continue on to constellation.
        if (authorIbles.length > 1) {
            this.displayBadge("This is "+ author + ".",false);
        } else {
            this.displayBadge("Lonely Universe. "+ author + " has only one Instructable in the Galaxy.",true);
            return;
        }

        // clear any existing constellations right away
        this.reset({
            freezeMotion: true,
            cameraMotions: false,
            projectTagsAddAfterCameraReset: false,
            projectTagsClear: true
        }, _.bind(function(){
            this.glowIbles(authorIbles);
        },this));

        // we'll reset the camera motions directly rather than using the generic reset. This gets us a nicer looking order of events
        this.cameraMotions.reset(function(){
            var points,
                pointsTemp = Galaxy.Utilities.worldPointsFromIbleIds(_.map(authorIbles,function(ibleData){return ibleData.id;}));

            // filter out points that are offscreen:
            points = _.filter(pointsTemp,function(point){
                var testPoint = Galaxy.Utilities.vectorWorldToScreenXY(point,that.camera);
                return testPoint.x > 0 && testPoint.y > 0 && testPoint.x < Galaxy.Settings.width && testPoint.y < Galaxy.Settings.height;
            });

            // after reset complete, build a constellation
            that.__constellation = new ConstellationMaker3D({nodes: points, camera: that.camera, hidden: false});
            Galaxy.Composers = Galaxy.ComposeScene({blur: true});

            // Maintain tags for author's projects only
            _.delay(function(){
                // This delay just makes it so we see the constellation alone for a moment. it's pretty.
                that.__tagManager.tagSubsetOfProjects(authorIblesAlternate);
                that.__tagManager.maintainTagCount(6);
            },2000);
        });
    },
    showInstructable: function(projectId){
        this.setFrozen(true);

        // Glow selected vertex
        this.glowIbles([Galaxy.Datasource[projectId]]);

        var particleSystem = Galaxy.Utilities.particleSystemForProjectid(projectId);
        var point = Galaxy.Utilities.vertexForProjectId(projectId, particleSystem);

        var that = this,
            pointLocal = point.clone(),
            selectedPointWorldCoords = particleSystem.localToWorld(pointLocal);

        this.cameraMotions.zoomAndDollyToPoint(selectedPointWorldCoords,function(){
            var starLocation = Galaxy.Utilities.vectorWorldToScreenXY(pointLocal, that.camera);
            that.placeProjectDescriptionLong(starLocation,projectId);
        });
    },
    showKeyboard: function(settings){
        var popover = $('.popover.fade');

        // temporarily hide project description
        popover.removeClass('in');
        _.delay(function(){
            popover.addClass('out');
        },500);

        // make sure that the keyboard is closed in the callback
        var that = this,
            wrappedSettings = {
                enterButtonTitle: settings.enterButtonTitle,
                titleLine: settings.titleLine,
                promptLine: settings.promptLine,
                callback: function(keyBoardResult){
                    settings.callback(keyBoardResult);
                }
            };

        if (_.isEmpty(this.__onscreenKeyboardView)) {
            this.__onscreenKeyboardView = new GalaxyTextInputModal(wrappedSettings);
            this.__onscreenKeyboardView.on('removed',function(){
                // replace project description
                popover.removeClass('out').addClass('in');
                $(this).off();
                that.__onscreenKeyboardView = null;
            });
        }
    },
    initiateSearch: function(){
        var that = this;
        this.showKeyboard({
            callback: function(query){
                // Do a case-insensitive author search in memory first. Show results as constellation if existing.
                var authorIbles = _.filter(Galaxy.Datasource,function(ibleData){
                    return ibleData.author.replace(" ","").toLowerCase() === query.replace(" ","").toLowerCase();
                });
                if (authorIbles.length > 0) {
                    var canonicalAuthorname = authorIbles[0]["author"];
                    that.showAuthor(canonicalAuthorname);
                    return;
                }

                // No author found. Do a /searchInstructables solr search by title if none. Display top 10-15 results with "lite" annotations.
                that.displaySearchResultsForQuery(query);
            },
            enterButtonTitle: "Search",
            titleLine: "Search Authors & Keywords",
            promptLine: "Term"
        });
    },
    displaySearchResultsForQuery: function(query){
        // Useful to display "related" content as well as actual user-initiated searches
        var that = this;

        $.ajax({
            method: "GET",
            url: 'https://monitoring.strandedcity.com/cors.php?http://www.instructables.com/json-api/searchInstructables?limit=45&featured=true&type=id&search='+encodeURIComponent(query),
            success: function(data){
                // requested 45 results in case some of those aren't in the starsystem:
                var highlightedIbles = [], highlightedAlternate = {};
                _.each(data.items,function(ibleResult){
                    // max results to highlight: 15
                    if (highlightedIbles.length < 15){
                        var found = _.findWhere(Galaxy.Datasource,{id: ibleResult.id});
                        if (!_.isUndefined(found)) {
                            highlightedIbles.push(found);
                        }
                    }
                });

                // TODO: This is sloppy
                _.each(highlightedIbles,function(ibleData){
                    highlightedAlternate[ibleData.id] = ibleData;
                });

                if (highlightedIbles.length > 0){
                    Galaxy.Composers = Galaxy.ComposeScene({blur: true});
                    that.reset({freezeMotion: true,cameraMotions:false,projectTagsAddAfterCameraReset: false, sceneComposers: false, projectTagsClear: true});
                    var points = Galaxy.Utilities.worldPointsFromIbleIds(_.map(highlightedIbles,function(ibleData){return ibleData.id}));

                    // Zoom camera to fit these onscreen.
                    that.cameraMotions.zoomToFitPointsFrom(points,that.cameraMotions.CAMERA_RELATION.ABOVE,function(){
                        // In the callback, create a hidden constellation to browse
                        that.__constellation = new ConstellationMaker3D({nodes: points, camera: that.camera, hidden: true});

                        that.__tagManager.tagSubsetOfProjects(highlightedAlternate);
                        that.__tagManager.maintainTagCount(6);
                    });

                    that.displayBadge("Showing "+query,false);
                    that.glowIbles(highlightedIbles);
                } else {
                    that.reset({projectTagsAddAfterCameraReset: true});
                    that.displayBadge("Nothing quite fits what you're looking for.",true);
                }
            },
            error: function(){
                that.displayBadge("Connection Error. Please try again later.",true);
            }
        });
    },
    displayBadge: function(message,isError){
        this.__statusIndicator.showMessage(message,isError,true);
    },
    emailInstructable: function(instructableJSON){
        var that = this;
        var keyboardSettings = {
            enterButtonTitle: "Email Now",
            titleLine: "Subject: " + instructableJSON.title,
            promptLine: "To:",
            callback: function(emailAddress){
                that.displayBadge("Sending mail to "+emailAddress,false);

                $.ajax({
                    method: "POST",
                    url: 'mail-an-ible/mailInstructable.php',
                    data: {
                        ibleUrl: 'http://www.instructables.com/id/'+instructableJSON.urlString,
                        email: emailAddress,
                        ibleTitle: instructableJSON.title,
                        ibleImage: instructableJSON.mediumUrl
                    },
                    success: function(){
                        that.displayBadge("Sent!",false);
                    },
                    error: function(){
                        that.displayBadge("ERROR: Couldn't send your message. Please try later.",true);
                    }
                });
            }
        };

        this.showKeyboard(keyboardSettings);
    },
    showRelated: function(relatedToId){
        var project = _.findWhere(Galaxy.Datasource,{id: relatedToId});
        if (_.isUndefined(project)){
            this.displayBadge("Error finding related projects. Try another project for now.",true);
        } else {
            this.displaySearchResultsForQuery(project.title);
        }
    },

    glowIbles: function(ibleList){
        if (!_.isNull(this.__onscreenKeyboardView)) this.__onscreenKeyboardView.closeModal();

        var particles = new THREE.Geometry();
        _.each(ibleList,function(ibleData){
            var vec = Galaxy.Utilities.worldPointsFromIbleIds([ibleData.id])[0];
            var vertex = new THREE.Vector3(vec.x,vec.y,vec.z);
            vertex.instructableId = ibleData.id;
            particles.vertices.push(vertex);
        });

        var pMaterial = new THREE.ParticleBasicMaterial({
            size: 100,
            map: THREE.ImageUtils.loadTexture("images/particle4.png"),
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthTest: false
        });

        // create the particle system
        var particleSystem = new THREE.ParticleSystem(
            particles,
            pMaterial);

        // add it to the scene
        this.__glowingParticleSystems = this.__glowingParticleSystems || [];
        this.__glowingParticleSystems.push(particleSystem);
        Galaxy.TopScene.add(particleSystem);
    },

    clearGlowing: function(){
        _.each(this.__glowingParticleSystems, function(child){
            Galaxy.TopScene.remove(child);
        });
        delete this.__glowingParticleSystems;
    },

    canvasClickEvent: function(e){
        e.preventDefault();
        e.stopPropagation();
        this.resetInteractionTimer();

        // prevent galaxy rotation
        this.setFrozen(true);

        var vector = new THREE.Vector3( ( e.clientX / Galaxy.Settings.width ) * 2 - 1, - ( e.clientY / Galaxy.Settings.height ) * 2 + 1, 0.5 );
        var projector = new THREE.Projector();
        projector.unprojectVector( vector, this.camera );

        var ray = new THREE.Raycaster( this.camera.position, vector.sub( this.camera.position ).normalize() );

        // If there are already selected stars out in the field, ie, from an author constellation or related group,
        // we assume the user is trying to select one of those. However, if each of these systems contains
        // only a single vertex, that indicates the user may just be clicking around individually. So don't use pre-selected
        // stars for the intersection in that case.
        var intersectSystems = this.particleSystemsArray,
            that = this;
        if (!_.isUndefined(this.__glowingParticleSystems)) {
            _.each(this.__glowingParticleSystems,function(system){
                if (system.geometry.vertices.length !== 1) {
                    // intersec with the glowing systems instead
                    intersectSystems = that.__glowingParticleSystems;
                }
            });
        }

        // When the camera is very close to the star that's selected, distance is deceiving. We basically need to adjust hit tolerance based on the distance to camera
        // Calculate the distance camera --> star by converting star's position to world coords, then measuring
        // intersection.point = Vector3
        // intersection.object = ParticleSystem it's a part of
        var getCameraDistanceForHit = function(intersection){
            var intersectionVect = intersection.point.clone();
            intersectionVect = intersection.object.localToWorld(intersectionVect);
            return intersectionVect.distanceTo(that.camera.position.clone());
        };

        // intersects sorted by distance so the first item is the "best fit"
        var intersects = _.sortBy(ray.intersectObjects( intersectSystems, true ),function(intersection){
            return getCameraDistanceForHit(intersection) / intersection.distance;
        });

        // When a hit is too close to the camera for its hit tolerance, it doesn't count. Remove those values.
        intersects = _.filter(intersects, function(intersection){
            return getCameraDistanceForHit(intersection) / intersection.distance > 100;
        });

        if ( intersects.length > 0 ) {
            this.selectVertex(intersects[0])
        } else {
            // no intersections are within tolerance.
            this.reset({projectTagsAddAfterCameraReset: true});
        }
    },

    reset: function(thingsToReset, callback){
        // A default object will reset everything. Situations calling for a more nuanced reset can have that, too, by overriding defaults here.
        var resetSettings = {
            keyboard: true,
            sceneComposers: true,
            projectDescriptionLong: true,
            projectTagsAddAfterCameraReset: false,
            projectTagsClear: true,
            freezeMotion: false,
            glowingIbles: true,
            constellation: true,
            cameraMotions: true
        };
        // override any defaults
        thingsToReset = thingsToReset || {};
        _.extend(resetSettings,thingsToReset);

        // go about resetting things:
        var delay = 0;
        if (resetSettings.glowingIbles === true) this.clearGlowing();
        if (resetSettings.constellation) this.clearConstellation();

        // big project descriptions take jquery a moment to unbind. If there's one showing, delay all the rest of the reset a tiny bit.
        if (resetSettings.projectDescriptionLong === true) delay = this.clearProjectDescriptionLong() === 0 ? 0 : 250;
        _.delay(_.bind(function(){
            if (!_.isNull(this.__onscreenKeyboardView) && resetSettings.keyboard === true) this.__onscreenKeyboardView.closeModal();
            if (resetSettings.sceneComposers === true) Galaxy.Composers = Galaxy.ComposeScene();
            if (resetSettings.projectTagsClear === true) this.getTagManager().removeAllTags();
            this.setFrozen(resetSettings.freezeMotion);
            if (resetSettings.cameraMotions === true) {
                this.cameraMotions.reset(function(){
                    if (typeof callback === "function") callback();
                });
                var that = this;
                if (resetSettings.projectTagsAddAfterCameraReset === true) {
                    that.__tagManager.tagAnyProjects();
                    that.__tagManager.maintainTagCount(5);
                }
            } else {
                if (typeof callback === "function") callback();
            }
        },this),delay);
    },

    clearConstellation: function(){
        if (!_.isNull(this.__constellation)) {
            this.__constellation.clear();
            this.__constellation = null;
        }
    },

    selectVertex: function(vertex){
        var that = this,
            // before we begin, make sure there's no active stuff on the screen yet.
            projDescriptionCount = this.clearProjectDescriptionLong(),
            pointLocal = vertex.point.clone(),
            selectedPointWorldCoords = vertex.object.localToWorld(pointLocal),
            delay = projDescriptionCount === 0 ? 0 : 350;  // delay camera zooming if a big project description needs to be removed

        _.delay(_.bind(function(){
            // If there's an active constellation, visible or not, it can tell us which neighboring points to show.
            // that.__constellation.getConnections(that.__constellation.connections[3][0]);
            if (!(_.isUndefined(this.__constellation) || _.isNull(this.__constellation))) {
                var neighbors = this.__constellation.getConnections(vertex.point.instructableId);
                if (neighbors.length > 0) {
                    var pointList = Galaxy.Utilities.worldPointsFromIbleIds(_.union([vertex.point.instructableId],neighbors));
                    this.cameraMotions.showThreePointsNicely(pointList,function(){
                        var starLocation = Galaxy.Utilities.vectorWorldToScreenXY(pointLocal, that.camera);
                        that.placeProjectDescriptionLong(starLocation,vertex.point.instructableId);
                    });
                }
            } else {
                // When randomly selecting a point, it needs to glow:
                this.glowIbles([Galaxy.Datasource[vertex.point.instructableId]]);

                // zoom in, there's nothing specific we want on screen
                this.cameraMotions.zoomAndDollyToPoint(selectedPointWorldCoords,function(){
                    var starLocation = Galaxy.Utilities.vectorWorldToScreenXY(pointLocal, that.camera);
                    that.placeProjectDescriptionLong(starLocation,vertex.point.instructableId);
                });
            }
        },that),delay);
    },

    placeProjectDescriptionLong: function(screenLocation,projectId){
        var htmlElement = $("<div class='threejs-project-anchor project-description-long' id='project-"+projectId+"'></div>"),
        that=this;
        $('body').append(htmlElement);

        // fetch full instructable, display in callback:
        $.ajax({
            url: 'https://monitoring.strandedcity.com/cors.php?http://www.instructables.com/json-api/showInstructable?id=' + projectId,
            success: function(jsonData){
                var body = jsonData.body || jsonData.steps[0].body;
                jsonData.annotationText = that.screenBodyText(body);
                jsonData.categoryDisplay = that.capitaliseFirstLetter(jsonData.category);
                jsonData.channelDisplay = jsonData.displayChannel;

                htmlElement.popover({
                    html: true,
                    placement: 'right',
                    title: _.template($('#template_project_description_title').html(),jsonData),
                    content: _.template($('#template_project_description_content').html(),jsonData)
                }).css({
                    top: screenLocation.y + 'px',
                    left: screenLocation.x+10 + 'px'
                }).on('shown.bs.popover', function () {
                    var scrollingEl = $('div.popover.fade.right.in'); // stupid, but the only way it seems to grab the actual popover element

                    // start the slideshow (already added above)
                    scrollingEl.find('.slideshow').cycle({log: false});

                    // apply overscroll
                    scrollingEl.find('.scrollable').overscroll({
                        direction: 'vertical'
                    });
                    scrollingEl.find('a.emailInstructable').data('instructableJSON',jsonData);
                }).popover('show');

            },
            error: function(){
                throw new Error("Error retrieving full Instructable while annotating");
            }
        });
    },

    screenBodyText: function(text){
        // run some regexes to improve display of stuff:

        // display youtube with as little chrome as possible:
        function validYT(url) {
            var reg = /(?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=))([\w-]{10,12})/g;
            var found = reg.exec(url);
            if (!_.isNull(found)) {
                return found[1];
            }
            return false;
        }

        var $alterText = $("<div>" + text + "</div>");
        $alterText.find('iframe, object, embed').each(function(){
            var youtubeVideoId = validYT($(this).attr('src'));
            if (youtubeVideoId) {
                var frameId = _.uniqueId("YT");
                //modestbranding=1&autohide=1&showinfo=0&controls=0&autoplay=1&playsinline=1&rel=0
                var elementHTML = "<iframe id=\""+frameId+"\" type=\"text/html\" width=\"368\" height=\"250\" src=\"https://www.youtube.com/embed/" + youtubeVideoId + "?modestbranding=1&autohide=1&showinfo=0&controls=0&playsinline=1&rel=0&enablejsapi=1\" frameborder=\"0\"></iframe>";
                var youtubePlayerElement = $(elementHTML);
                $(this).before(youtubePlayerElement);
                $(this).before($("<div id=\""+frameId+"2\"></div>"));
                $(this).remove();

                // wait for the dom to render the video frame, then attach listeners
                setTimeout(function(){
                    var player = new YT.Player(frameId, {
                        videoId:youtubeVideoId
                    });

                    var videoFrame = $('#'+frameId);
                    if (videoFrame.length === 0) {console.warn("Youtube frame missing by the time it was supposed to be placed");return;}
                    $('#'+frameId+'2').css({
                        position: 'absolute',
                        top: videoFrame.position().top + 'px',
                        left: videoFrame.position().left + 'px',
                        width: videoFrame.width() + 'px',
                        height: videoFrame.height() + 'px'
                    }).click(function(){
                        player.playVideo();
                    });
                },500);
            }
        });

        return $alterText.html();
    },

    clearProjectDescriptionLong: function(){
        var el = $('div.threejs-project-anchor.project-description-long'),
            numberOfDescriptions = el.length;
        $('.slideshow').cycle('destroy');
        el.popover('destroy');
        el.remove();
        return numberOfDescriptions;
    },
    getTagManager: function(){
        return this.__tagManager;
    },
    capitaliseFirstLetter: function(string)
    {
        return string.charAt(0).toUpperCase() + string.slice(1);
    },
};
