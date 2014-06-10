

function GalaxySkymap(dataNodes, stage){
    this.init(dataNodes,stage);
}


GalaxySkymap.prototype.init = function(dataNodes,stage){

    this.animationLayer = new Kinetic.Layer();
    stage.add(this.animationLayer);
    this.mainStarLayer = new Kinetic.Layer();
    stage.add(this.mainStarLayer);

    this.dataNodes = dataNodes;
    this.kineticStage = stage;
    this.kineticNodes();
};

GalaxySkymap.prototype.kineticNodes = function(){
    var that = this;
    var tooltipLayer = new Kinetic.Layer();
    var dragLayer = new Kinetic.Layer();

    var tooltip = new Kinetic.Label({
        opacity: 0.75,
        visible: false,
        listening: false
    });

    tooltip.add(new Kinetic.Tag({
        fill: 'black',
        pointerDirection: 'down',
        pointerWidth: 10,
        pointerHeight: 10,
        lineJoin: 'round',
        shadowColor: 'black',
        shadowBlur: 10,
        shadowOffset: 10,
        shadowOpacity: 0.2
    }));

    tooltip.add(new Kinetic.Text({
        text: '',
        fontFamily: 'Calibri',
        fontSize: 18,
        padding: 5,
        fill: 'white'
    }));

    tooltipLayer.add(tooltip);

    // render data
    var nodeCount = 0;
    var layer = this.mainStarLayer;
    var shadowLayer = new Kinetic.Layer();
    for (var ibleId in this.dataNodes) {
        this.dataNodes[ibleId]["kineticNode"] = this.addNode(this.dataNodes[ibleId], layer, shadowLayer);
        nodeCount++;
    }

    // Blur and add the shadow layer
    this.kineticStage.add(shadowLayer)
    shadowLayer.toImage({
        callback: function(img){
            var i = new Kinetic.Image({
                image: img,
                filter: Kinetic.Filters.Blur,
                filterRadius: 12
            });
            var blurred = new Kinetic.Layer();
            blurred.add(i);
            that.kineticStage.add(blurred);
            shadowLayer.destroy();

            // continue setup only after blurred layer is added
            that.kineticStage.add(layer);
            that.kineticStage.add(dragLayer);
            that.kineticStage.add(tooltipLayer);
        }
    });



};

GalaxySkymap.prototype.addNode = function(obj, layer, shadowLayer){
    var prominence = Math.min(obj.views/10000,40)/10;
    var size = 0.5 + prominence;

    var shadowColor = tinycolor.lighten(tinycolor(obj.fillColor),65);

    var node = new Kinetic.skyNode({
        x: obj.x,
        y: obj.y,
        radius: size,
        fill: "white",
        id: obj.id,

        drawHitFunc: function(canvas) {
            var context = canvas.getContext();
            context.beginPath();
            context.arc(0,0, 7, 0, Math.PI * 2, false);
            context.closePath();
            context.fillStyle="white";
            context.fill();
            canvas.fillStroke(this);
        }
    });
    node.naturalSize = size;

    var shadowNode = new Kinetic.Circle({
        x: obj.x,
        y: obj.y,
        radius: size*3,
        fill: shadowColor.toRgbString(),
        opacity: 0.3
    });
    shadowLayer.add(shadowNode);

    layer.add(node);
    return node;
};

GalaxySkymap.prototype.nodesByIds = function(nodeIds){
    var that = this,
        collectedNodes = [];
    _.each(nodeIds, function(val){
        var foundNode = that.dataNodes[val];
        if (!_.isUndefined(foundNode)) {
            collectedNodes.push(foundNode["kineticNode"]);
        }
//        else {
//            console.log('could not find ' + val);
//        }
    });

//    console.log('finding nodes by id', _.map(collectedNodes, function(node){return node.getAttr('id');}));
    return collectedNodes;
}

GalaxySkymap.prototype.nodesByCategoryAndChannel = function(categoryName,channelName){
    var that = this,
        collectedNodes = [];
    _.each(that.dataNodes,function(val){
        if (val.category == categoryName) {
            if (_.isUndefined(channelName) || val.channel == channelName) {
                collectedNodes.push(val["kineticNode"])
            }
        }
    });
    return collectedNodes;
}

GalaxySkymap.prototype.glowNodes = function(obj) {
    var nodes = obj.nodes, callback = obj.callback, opacity = obj.opacity;
    if (_.isUndefined(opacity)) opacity = 0.5;

    var that = this;
    Galaxy.Utilities.dimBackground(this.kineticStage, function(){
        var animationLayer = that.animationLayer;
        animationLayer.moveToBottom();
        _.each(nodes,function(node){
            node.moveTo(animationLayer);
            node.setAttrs({
                radius: 5,
                fill: "white"
            });
        });
        animationLayer.toImage({
            callback: function(img){
                var blurred = new Kinetic.Layer({
                    name: 'glowBlur'
                });
                that.kineticStage.add(blurred);
                blurred.moveToBottom();

                var i = new Kinetic.Image({
                    image: img,
                    filter: Kinetic.Filters.Blur,
                    filterRadius: 6
                });
                blurred.add(i);
                blurred.setOpacity(0);
                blurred.moveToTop();

                new Kinetic.Tween({
                    duration: 0.3,
                    node: blurred,
                    opacity: 1,
                    onFinish: function(){
                        animationLayer.getChildren().each(function(shape){
                            shape.setRadius(2);
                        });
                        animationLayer.moveToTop();
                        animationLayer.batchDraw();
                        // proceed!
                        if (typeof callback == "function") callback();
                    }
                }).play();
            }
        });
    },opacity);
};

GalaxySkymap.prototype.unGlowNodes = function(callback){
    var mainStarLayer = this.mainStarLayer;
    var glowingNodesLayer = this.animationLayer;
    var that = this;
    if (_.isUndefined(glowingNodesLayer)) {
        if (typeof callback == "function") callback();
        return;
    }

    // Shrink nodes back to normal size:
    var glowing = _.clone(glowingNodesLayer.getChildren());  // without cloning, the references get lost
    glowingNodesLayer.removeChildren();
    _.each(glowing,function(node){
        node.setRadius(node.naturalSize);
        mainStarLayer.add(node);
    });
    mainStarLayer.batchDraw();
    glowingNodesLayer.batchDraw();

    var completed = _.debounce(function(){
        Galaxy.Utilities.dimBackgroundHide(callback);
    },500);

    this.kineticStage.get('.glowBlur').each(function(blurredLayer){
        new Kinetic.Tween({
            node: blurredLayer,
            duration: 0.4,
            opacity: 0,
            onFinish: function(){
                blurredLayer.destroy();
                completed();
            }
        }).play();
    });
};

GalaxySkymap.prototype.activeNodes = function(){
    var glowingNodesLayer = this.animationLayer;
    if (glowingNodesLayer.getChildren().length > 0) {
        return _.clone(glowingNodesLayer.getChildren());
    }
    return _.clone(this.mainStarLayer.getChildren());
};
