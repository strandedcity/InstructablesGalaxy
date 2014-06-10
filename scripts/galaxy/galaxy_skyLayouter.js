Galaxy = Galaxy || {};
Galaxy.Utilities = Galaxy.Utilities || {};

// NOTE THAT THIS CLASS DOES NOT DO THE FINAL PLACEMENT OF THE STARS, IT JUST USES THE KINETIC STAGE'S EASY
// TRANSFORM FUNCTIONALITY TO CREATE CLUSTERS, THEN SAVES THOSE COORDINATES TO THE DATA THAT PERSISTS IN MEMORY

// THIS CLASS EATS ITS OWN TAIL.

function SkyLayouter(dataIn,stage){
    this.init(dataIn,stage);
}

SkyLayouter.prototype.init = function(dataIn,stage){
    this.stage = stage;
    this.categoryCount = 0;
    this.layers = {}; // Maintain a dictionary of layers, one for each channel name

    // Initial positions of things, setup of the dominant geometries:
    this.nodeData = this.dataParser(dataIn);

    // Reset the node's x & y values based on the absolute position. This is where they will actually be drawn later.
    var that = this;
    _.each(this.nodeData, function(val, key){
        var x = that.nodeData[key].tempnode.getAbsolutePosition().x,
            y = that.nodeData[key].tempnode.getAbsolutePosition().y;
        that.nodeData[key].x = x;
        that.nodeData[key].y = y;

        delete that.nodeData[key]["tempnode"];
    });

    _.each(this.layers,function(layer){
        layer.destroy();
    });
}

SkyLayouter.prototype.dataParser = function(unprocessed){
    var that = this, parsed = {};
    $.each(unprocessed, function (idx, val) {
        if (val.views > Galaxy.Settings.viewThreshold && !_.isEmpty(val.channel)) {
            parsed[val.id] = {
                id: val.id,
                related: val.related,
                title: val.title,
                category: val.category,
                channel: val.channel,
                author: val.author,
                views: val.views,
                imageUrl: val.imageUrl
            }
            parsed[val.id]["tempnode"] = that.addNodeToLayerByChannel.apply(that,[parsed[val.id]]);
        }
    });
    return parsed;
}

SkyLayouter.prototype.addNodeToLayerByChannel = function(nodeData){
    var layer = this.layerByCategoryAndChannel(nodeData.category,nodeData.channel);
    return this.addNode(nodeData,layer);
}

SkyLayouter.prototype.addNode = function(obj, layer){
    // The channel layers carry information about the proposed radius and spread of the "ring" on which a particular node should lie
    var position = this.nodePositionOnLayer(layer);
    var node = new Kinetic.Circle({
        x: position.x,
        y: position.y
    });
    layer.add(node); 
    return node;
};
SkyLayouter.prototype.nodePositionOnLayer = function(layer){
    // set x & y for regular distribution around the ring, which in all cases is centered at 0,0. Transforms will size this and move it later.
    var r, theta, x, y, that = this;
    r = Galaxy.Utilities.random(layer.radiusTarget, layer.radiusSpread);
    theta = Galaxy.Utilities.random(layer.angleTarget, layer.angleSpread);
    x = r * Math.cos(theta);
    y = r * Math.sin(theta);
    return {x: x, y: y};
}
SkyLayouter.prototype.repositionNodeOnLayerWithinBounds = function(node,layer){
    var newPosition = this.nodePositionOnLayer(layer);
    node.setX(newPosition.x);
    node.setY(newPosition.y);
}

SkyLayouter.prototype.layerByCategoryAndChannel = function(categoryName,channelName){
    if (!_.isUndefined(categoryName)) categoryName = categoryName.toLowerCase();
    if (!_.isUndefined(channelName)) channelName = channelName.toLowerCase();
    var categoryLayer = this.layers[categoryName], channelLayer = this.layers[channelName];
    if (_.isUndefined(categoryLayer)) {
        this.categoryCount = this.categoryCount + 1;
        // apply global transforms here: x,y,scaleXY, skewXY
        categoryLayer = new Kinetic.Layer({
            x: window.Galaxy.Settings.width/2,
            y: window.Galaxy.Settings.height/2
        });

        // how many categories already have layers assigned? Work from inside out
        categoryLayer.radiusTarget = 25+60 * this.categoryCount;
        categoryLayer.radiusSpread = 40;
        this.layers[categoryName] = categoryLayer;
    }

    if (_.isUndefined(channelLayer)) {
        // apply transforms here: mean radius, standard deviation -- definition of 'rings'
        channelLayer = new Kinetic.Layer();
        channelLayer.angleSpread = 2*Math.PI/32;  // Will also be fed into the standard deviation / mean functions for each node
        channelLayer.angleTarget = Math.random()*Math.PI*2; // represents the highest-density part of the ring for this channel
        channelLayer.radiusSpread = this.layers[categoryName].radiusSpread;  // inherit from category
        channelLayer.radiusTarget = this.layers[categoryName].radiusTarget;  // inherit from category

        this.layers[channelName] = channelLayer;
        categoryLayer.add(channelLayer);
    }

    return this.layers[channelName];
}

SkyLayouter.prototype.getNodes = function(){
    return this.nodeData;
}
SkyLayouter.prototype.destroy = function(){
    delete this.nodeData;
    delete this.stage;
    delete this.layers;
    delete this.categoryCount;
    delete this;
}
