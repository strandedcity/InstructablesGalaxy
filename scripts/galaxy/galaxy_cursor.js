function GalaxyCursor() {
    this.init();
};
GalaxyCursor.prototype.init = function(){
    var that = this;
    this.currentNode = undefined;
    this.instructableWindow = undefined;
    this.textLayer = null;
    this.currentAnimation = undefined;
    this.currentConstellation = undefined;
    this.stage = window.SKYMAP.kineticStage;
    this.cursor = this.makeCursor();
    this.stage.add(this.cursor);
    this.threshold = 1;

    this.stage.on("mousedown click touchstart",function(e){
        // route the click based on what was clicked.
        try {
            // This will have the effect of halting all execution, then starting over with the route handler below.
            throw '';
        } catch(ex) {
            GALAXYHISTORY.resetIdleTimer.apply(GALAXYHISTORY,[e]);
            that.routeStageClick.apply(that,[e]);
        }
    });

    this.stage.on("cursorMove",function(evt){
        var node = evt.targetNode;
        if (_.isUndefined(node)) return; // nothing to do here

        // hang on to a reference, in case the project needs to be opened
        that.currentNode = node;

        // update tooltip if we're hovering over an active node
        var nodeData = window.SKYMAP.dataNodes[node.getId()];
        if (!_.isUndefined(nodeData)) {
            window.ANNOTATION.annotateProject(nodeData,false);
            that.updateText(nodeData.title);
        }
    });
};

GalaxyCursor.prototype.currentConstellationData = function(){
    if (!_.isUndefined(this.currentConstellation)){
        return this.currentConstellation.getProperties();
    }
    return null;
};

GalaxyCursor.prototype.openConstellationWithOptions = function(options,callback){
    if (this.currentConstellation.getProperties() == options) {
        console.log('correct constellation already visible.');
        if (typeof callback == "function") callback();
        return;
    }

    var showConstellation = function(){
        this.currentConstellation = new constellationMaker(this.stage,options);
        if (typeof callback == "function") callback();
    };

    // clear constellation if necessary
    this.clearAndShow(showConstellation);
};

GalaxyCursor.prototype.makeCursor = function(){
    var color = "#D14719", strokeWidth = 0.5,cursorSize= 20;
    color = "white";
    var layer = new Kinetic.Layer({
        id: 'cursorLayer'
    });
    var redLine1 = new Kinetic.Line({
        points: [cursorSize/2, 0, 2000, 0],
        stroke: color,
        strokeWidth: strokeWidth,
    });
    var redLine2 = new Kinetic.Line({
        points: [-cursorSize/2, 0, -2000, 0],
        stroke: color,
        strokeWidth: strokeWidth,
    });
    var redLine3 = new Kinetic.Line({
        points: [0, cursorSize/2, 0, 2000],
        stroke: color,
        strokeWidth: strokeWidth,
    });
    var redLine4 = new Kinetic.Line({
        points: [0, -cursorSize/2, 0, -2000],
        stroke: color,
        strokeWidth: strokeWidth,
    });
    var center = new Kinetic.Rect({
        x: -cursorSize/2,
        y: -cursorSize/2,
        width: cursorSize,
        height: cursorSize,
        stroke: color,
        strokeWidth: strokeWidth,
        lineCap: 'round',
        lineJoin: 'round',
        drawHitFunc: function(canvas) { } // no hit area means this can figure out which "star" is being targeted
    });
    var label = new Kinetic.Text({
        x: cursorSize + 10,
        y: -22,
        id: "cursorLabel",
        text: '',
        fontSize: 18,
        fontStyle: "bold",
        align: "left",
        fontFamily: 'Calibri',
        fill: 'white'
    });
    layer.add(redLine1);
    layer.add(redLine2);
    layer.add(redLine3);
    layer.add(redLine4);
    layer.add(center);
    layer.add(label);
    this.textLayer = label;
    return layer;
};

GalaxyCursor.prototype.updateText = function(message){
    this.textLayer.setText(message);
};

GalaxyCursor.prototype.randomProject = function(){
    var ids = Object.keys(window.SKYMAP.dataNodes);
    return window.SKYMAP.dataNodes[ids[Math.round(Math.random()*ids.length)]];
};

GalaxyCursor.prototype.moveToCoords = function(x,y){
    this.cursor.setX(x);
    this.cursor.setY(y);
    this.cursor.draw();
    var evt = this.stage.getIntersection([this.cursor.getX(),this.cursor.getY()]);
    if (evt !== null) {
        evt = evt.shape;
        this.stage.fire("cursorMove",{ targetNode: evt },true);
        return true;
    } else return false;
};

GalaxyCursor.prototype.routeStageClick = function(evt){
    var that = this, node = evt.targetNode;
    if (_.isUndefined(node)) {
        console.warn('Undefined node! Investigate!');
        return;
    } else if (node.className == "Image" || node.className == "Rect") {
        // clicking a background triggers a 'cancel' event. clear constellation/glowing nodes as needed
        if (!_.isUndefined(that.currentConstellation)) {
            window.ANNOTATION.clearAnnotations(); // does nothing if there aren't any
            that.currentConstellation.destroy(function(){delete that.currentConstellation;});
        } else {
            SKYMAP.unGlowNodes();
        }
    } else if (node.className == "skyNode") {
        if (!_.isUndefined(this.currentConstellation)) {
            // Clicked a star. If there's a constellation to handle the click, tell the constellation to do its thang.
            this.currentConstellation.handleStarTap(node);
        } else {
            // Otherwise, go straight there.
            var nodeData = window.SKYMAP.dataNodes[node.getId()];
            if (nodeData) that.animateCursorToProject(nodeData, function(){
                that.showRelated.apply(that,[node]);
            });
            else console.warn('Error getting node data from skyNode');
        }
    } else console.log("No route for classname: " + node.className);
};

GalaxyCursor.prototype.animateCursorToProject = function(project, callback){
    if (!_.isUndefined(this.currentAnimation)) {
        this.killCurrentAnimation();
    }

    var that = this,
    cursor = this.cursor,
    distance = Math.sqrt(Math.pow(cursor.getX()-project.x,2)+Math.pow(cursor.getY()-project.y,2)),
    duration = 3+distance,
    start = {
        x: cursor.getX(),
        y: cursor.getY()
    }, diff = {
        x: project.x-start.x,
        y: project.y-start.y
    };

    if (_.isUndefined(this.currentConstellation)) {
        duration = 4*distance; // slower when no constellation, so you can see the 'water shimmer' effect of text at bottom
    }

    this.currentAnimation = new Kinetic.Animation(function(frame) {
        var moveProportion = Math.min(1,(frame.time / duration)); // never more than 100% of the way there
        that.moveToCoords.apply(that,[start.x + diff.x*moveProportion,start.y + diff.y*moveProportion]);
    }, cursor);

    this.currentAnimation.start();
    this.currentAnimation.completionTimer = setTimeout(function(){
        // Don't trust intersection events for final resting place
        var shape = SKYMAP.nodesByIds([project.id])[0];
        var triggered = that.moveToCoords(shape.getX(),shape.getY());
        if (!triggered) that.stage.fire("cursorMove",{ targetNode: shape },false);
        cursor.batchDraw(); // fire manually
        that.killCurrentAnimation.apply(that);
        if (typeof callback == "function") callback();
    },duration);
};

GalaxyCursor.prototype.killCurrentAnimation = function(){
    this.currentAnimation.stop();
    clearTimeout(this.currentAnimation.completionTimer);
    delete this.currentAnimation;
};

GalaxyCursor.prototype.showRelated = function(node){
    var that=this,
    showConstellation = function(){
        var options = {
            type: "relatedConstellation",
            showTags: true,
            relatedToNode: node
        };
        that.currentConstellation = new constellationMaker(that.stage,options);
    };

    // clear constellation if necessary
    this.clearAndShow(showConstellation);
};

GalaxyCursor.prototype.clearAndShow = function(showConstellationFunction){
    var that = this;
    that.clearConstellationIfNeeded.apply(that,[showConstellationFunction]);
};

GalaxyCursor.prototype.clearConstellationIfNeeded = function(callback){
    var that = this,
    c = function(){ if (typeof callback == "function") { callback(); }};

    if (!_.isUndefined(this.currentConstellation)) {
        this.currentConstellation.destroy(function(){
            delete that.currentConstellation;
            c();
        });
    } else {
        c();
    }
};

GalaxyCursor.prototype.showAuthor = function(screenName,instructables){
    console.log('Showing author '+ screenName);  // authorInfo contains imageUrl and screenName

    var that=this,
    showAuthorConstellation = function(){
        var nodes = _.map(instructables,function(val){return val["kineticNode"];}),
        options = {
            type: "authorConstellation",
            screenName: screenName,
            showTags: true,
            nodes: nodes
        };
        that.currentConstellation = new constellationMaker(that.stage,options);
    };

    this.clearAndShow(showAuthorConstellation);
};

GalaxyCursor.prototype.showCategoryAndChannel = function(category,channel){
    var that=this,
    nodes = window.SKYMAP.nodesByCategoryAndChannel(category,channel),
    showChannelConstellation = function(){
        var options = {
            type: "channelConstellation",
            showTags: false,
            showLines: false,
            nodes: nodes
        };
        that.currentConstellation = new constellationMaker(that.stage,options);
    };

    this.clearAndShow(showChannelConstellation);
};

GalaxyCursor.prototype.showKeywordSearchResults = function(searchterm, nodes){
    console.log('Showing search: '+searchterm);

    var that = this,
    showConstellation = function(){
        var options = {
            type: "channelConstellation",
            showTags: false,
            showLines: false,
            nodes: nodes
        };
        that.currentConstellation = new constellationMaker(that.stage,options);
    };
    this.clearAndShow(showConstellation);
}

// JQuery Event Handlers
GalaxyCursor.prototype.tapInstructableAnnotationBlock = function(e){
    // This is a jquery event, since that text block is HTML.
    var that = this;

    // Cursor keeps a reference to the instructable currently on display. Open it for browsing!
    console.log('open! ' + this.currentNode.getId());

    OPENTOOLBAR = new this.GalaxyInstructableWindow({ibleId: this.currentNode.getId()});
};

// THIS IS AWFUL AND SHOULD BE FIXED, BUT I DON"T HAVE TIME RIGHT NOW
GalaxyCursor.prototype.GalaxyInstructableWindow = Backbone.View.extend({
    tagName: "div",
    initialize: function(options){
        this.ibleId = options.ibleId;
        this.render();
    },
    events: {
        "click div.backdrop": "closeModal"
    },
    render: function(){
        var that=this;
        $('body').append(this.$el);
        this.$el.append($('<div class="backdrop fade"></div>'));
        this.$el.append($('<div class="instructableWindow fade"><iframe frameBorder="0" src="InstructableDetail/sample.html?instructableId='+this.ibleId+'"></iframe></div>'));
        _.defer(function(){that.$el.find('.fade').addClass('in');});
    },
    closeModal: function(callback){
        var that = this;

        this.$el.find('.fade.in').removeClass('in');
        _.delay(function(){
            that.$el.find('#searchForm').off();
            that.remove();
            delete window.OPENTOOLBAR;
            if (typeof callback == "function") callback();
        }, 250);
    }
});


// Actions to coordinate:
//- dim the background
//- glow a set of stars
//- annotate those stars with numbers
//- match with descriptive text (author)
//- match with descriptive text (project)
//- draw constellation
//- remove constellation
//- un-dim the background
//- un-glow stars
//- move cursor
//
//// User interactions:
//- search for a category (glow only)
//- search for an author (show constellation)
//- search for a keyword (glow only)
//- tap a star (show related constellation)
//- tap a GLOWING star (show detail)
//- tap a project (open)
//- tap an author (show constellation)
//- back
//- next
