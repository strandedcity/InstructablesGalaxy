function ConstellationMaker3D(options){
    if (_.isUndefined(THREE) || _.isUndefined(Galaxy) || _.isUndefined(Galaxy.Utilities) || _.isUndefined(Galaxy.TopScene)) {
        throw new Error("Missing dependencies for ConstellationMaker3D");
    }

    // ConstellationMaker3D is a function of a camera object because the 2-dimensional rules need a particular projection to work from
    this.init(options);
}

ConstellationMaker3D.prototype.init = function(options){
    var camera = options.camera || Galaxy.Utilities.makeTemporaryCamera();
    var nodes = options.nodes;

    _.bindAll(this, 'getConnections');

    this.camera = camera;       // three.js camera object
    this.nodes = this.projectPoints(nodes);          // Vector2's (math -- flattened representation of XYZ points)
    this.segments = [];         // Line3's (math). Note these are 2D line segments; the 3d ones are rendered, but not part of the constellation construction
    this.connections = [];      // Array of connected instructable ids. ie, [[id1,id2],[id2,id3]]
//    this.lineGeometries = [];   // THREE.Line() objects (geometry, not math). Used for add the lines to the scene.
    this.disconnectedNodes = [];// Vector3's not yet dealt with
    this.lineObject = null; // THREE.Line() object

    this.calculateConstellation();

    if (options.hidden !== true) this.displayConstellation();
};

ConstellationMaker3D.prototype.projectPoints = function(vector3List){
    var that = this;
    return _.map(vector3List,function(vec){
        var position = Galaxy.Utilities.vectorWorldToScreenXY(vec,that.camera),
            vec2 = new THREE.Vector2(position.x,position.y);
        vec2.instructableId = vec.instructableId;
        return vec2;
    });
};

ConstellationMaker3D.prototype.spatialPointsForConnections = function(connectionList){
    return _.map(connectionList,function(connectionPair){
        return Galaxy.Utilities.worldPointsFromIbleIds(connectionPair);
    });
};

ConstellationMaker3D.prototype.displayConstellation = function(callback){
    // Place THREE.JS objects corresponding to the calculated objects into the scene
    var connectedPoints3d = this.spatialPointsForConnections(this.connections);
    var that = this;

    if (!_.isEmpty(connectedPoints3d)) {
        // Initialize geometry, add first point
        var lineGeometry = new THREE.Geometry();

        // connect subsequent dots along the chain of connected points
        _.each(connectedPoints3d,function(pair){
//            var closerPair = that.movePointsCloser(pair);
            var closerPair = pair;
            lineGeometry.vertices.push( closerPair[0] );
            lineGeometry.vertices.push( closerPair[1] );
        });

        // display the line
        var material = new THREE.LineBasicMaterial({
            linecap: "round",
            color: 0xffffff,
            linewidth: 2,
            transparent: true,
            opacity: 0.5
        });
        this.lineObject = new THREE.Line( lineGeometry, material, THREE.LinePieces );
        this.lineObject.name = "constellation";
        Galaxy.TopScene.add( this.lineObject );
    }

    if (typeof callback === "function") {
        callback();
    }
};

ConstellationMaker3D.prototype.movePointsCloser = function(pair){
    // part of displaying the constellation lines is shortening the segments for graphic effect.
    var end1 = pair[0].clone();
    var end2 = pair[1].clone();

    // move each point slightly towards the other
    var diff = end2.clone().sub(end1.clone());
    diff.multiplyScalar(0.08);

    return [end1.add(diff.clone()), end2.sub(diff.clone())];
};

ConstellationMaker3D.prototype.clear = function(){
    if (!_.isNull(this.lineObject)) {
        Galaxy.TopScene.remove(this.lineObject);
    }
};

ConstellationMaker3D.prototype.calculateConstellation = function(){
    var currentNode = this.nodes.shift(), that=this;
    while (this.nodes.length > 0) {
        currentNode = this.addSegmentFromNode(currentNode);
    }

//    // add some connections:
//    this.disconnectedNodes.push(_.clone(that.allNodes).shift());
//    _.each(this.disconnectedNodes,function(node){
//        that.connectNodeMultipleTimes.apply(that,[node,3]);
//    });
};

ConstellationMaker3D.prototype.closestNodeToNodeFromNodeSet = function(testNode,nodesToTest){
    _.each(nodesToTest,function(potentialNextNode){
        potentialNextNode.distance = testNode.distanceTo(potentialNextNode);
    });

    var sorted = _.sortBy(nodesToTest,"distance");
    return sorted;
}

ConstellationMaker3D.prototype.findLineLineIntersection = function(line1,line2){
    var eqn1, eqn2, intx, inty;

    // if the two lines share an end (ie, they are drawn from the same node), pass
    if (this.shareEndpoint(line1, line2) === true) return false;

    eqn1 = this.equationForLine(line1);
    eqn2 = this.equationForLine(line2);

    // same slope = no intersection
    if (eqn1.m == eqn2.m) return false;

    // x-value of intersection point
    intx = (eqn2.b - eqn1.b) / (eqn1.m - eqn2.m);

    // y-value of intersection point
    inty = eqn1.m * intx + eqn1.b;

    // if x or y are out of range for either line, there's no intersection
    var range = {
        minx: Math.min(line1.start.x,line1.end.x),
        maxx: Math.max(line1.start.x,line1.end.x),
        miny: Math.min(line1.start.y,line1.end.y),
        maxy: Math.max(line1.start.y,line1.end.y)
    };
    if (intx < range.minx || intx > range.maxx) return false;
    if (inty < range.miny || inty > range.maxy) return false;

    range = {
        minx: Math.min(line2.start.x,line2.end.x),
        maxx: Math.max(line2.start.x,line2.end.x),
        miny: Math.min(line2.start.y,line2.end.y),
        maxy: Math.max(line2.start.y,line2.end.y)
    };

    if (intx < range.minx || intx > range.maxx) return false;
    if (inty < range.miny || inty > range.maxy) return false;

//    Information about the intersection that's been found
//    console.log(line1.getPoints(),line2.getPoints(), intx,inty, range,eqn1);
    return true;
}

ConstellationMaker3D.prototype.equationForLine = function(line){
    // eqn's store m & b from y = mx + b
    var m, b;

    // slope
    m = (line.end.y - line.start.y) / (line.end.x - line.start.x);

    // y-intercept: b = y-mx. Sub in values from a known point.
    b = line.end.y - m * line.end.x;
    return {m: m, b: b};
}
ConstellationMaker3D.prototype.shareEndpoint = function(line1,line2){
    if (line1.start.x == line2.end.x && line1.start.y == line2.end.y) return true;
    if (line1.end.x == line2.start.x && line1.end.y == line2.start.y ) return true;
    if (line1.end.x == line2.end.x && line1.end.y == line2.end.y) return true;
    if (line1.start.x == line2.start.x && line1.start.y == line2.start.y) return true;
    return false;
}

ConstellationMaker3D.prototype.addSegmentFromNode = function(node){
    var nextNodeList = this.closestNodeToNodeFromNodeSet(node,this.nodes);
    var proposedLine = this.lineConnectingNodes2D(node,nextNodeList[0]);

    if (this.lineIntersectsPriorLines(proposedLine) == true) {
        this.disconnectedNodes.push(node);
    } else {
        this.connections.push([node.instructableId,nextNodeList[0].instructableId]);
        this.segments.push(proposedLine);
    }

    this.nodes = _.without(this.nodes,nextNodeList[0]);
    return nextNodeList[0];
}

ConstellationMaker3D.prototype.connectNodeMultipleTimes = function(node,times){
    var closest = this.closestNodeToNodeFromNodeSet(node,this.allNodes),
    lineCount = 0;
    for (var i = 2; i < closest.length && lineCount < times; i++) {
        var proposedLine = this.lineConnectingNodes2D(node,closest[i]);
        if (!this.lineIntersectsPriorLines(proposedLine)) {
            this.segments.push(proposedLine);
            this.constellationLayer.add(proposedLine);
            lineCount++;
        }
    }
}

ConstellationMaker3D.prototype.lineIntersectsPriorLines = function(proposedLine){
    var that = this, intersectionFound = false;
    _.each(this.segments,function(testSegment){
        var intersect = that.findLineLineIntersection.apply(that,[testSegment, proposedLine]);
        if (intersect === true) {
            intersectionFound = true;
        }
    });
    return intersectionFound;
}

ConstellationMaker3D.prototype.lineConnectingNodes2D = function(node1,node2){
    return new THREE.Line3(new THREE.Vector3(node1.x,node1.y,0),new THREE.Vector3(node2.x,node2.y,0));
}

ConstellationMaker3D.prototype.getConnections = function(instructableId){
    // returns an array of instructable id's to which the supplied id has connections.
    var flat = _.uniq(_.flatten(this.connections));
    var index = _.indexOf(flat,instructableId);

    switch(index) {
        case -1:
            return [];
        case 0:
            return [flat[1]];
        case flat.length-1:
            return flat[flat.length-2];
        default :
            return [flat[index-1],flat[index+1]];
    }
    console.log(instructableId + ' found at ' + index + ' in '+ flat);
}