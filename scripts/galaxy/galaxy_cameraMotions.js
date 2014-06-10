Galaxy.Settings = Galaxy.Settings || {};

Galaxy.CameraMotions = function(camera){
    _.bindAll(this,'zoomToFitPointsFrom','startAnimation','endAnimation','cameraSetupForParameter','beginAutomaticTravel');
    this.target = Galaxy.Settings.cameraDefaultTarget.clone();
    this.camera = camera;

    // delete this property eventually
    this.firstClick = true;

    this.isAnimating = false;
}

Galaxy.CameraMotions.prototype = {
    constructor: Galaxy.CameraMotions,
    startAnimation: function(){
        // startAnimation refers to user-initiated animations. The default animation must be removed if ongoing.
        this.endAutomaticTravel();
        this.isAnimating = true;
    },
    endAnimation: function(){this.isAnimating = false;},
    zoomAndDollyToPoint: function(point,callback){
        if (this.isAnimating === true) return;
        // temporarily: the first click will zoom in, and we'll strafe after that.
        if (this.firstClick === false) {
            //this.strafeFromPointToPoint(this.target,point,callback);
            this.zoomToFitPointsFrom([point],this.CAMERA_RELATION.TOWARD_CENTER,callback);
            return;
        }
        this.firstClick = false;

        var that = this,
            pointClone = point.clone(),
            cameraPath = this.cameraPathToPoint(this.camera.position.clone(), point.clone()),
            currentPosition = {now: 0},
            duration = 1.3,
            upClone = Galaxy.Settings.cameraDefaultUp.clone(),
            targetCurrent = this.target.clone();
        TweenMax.to(targetCurrent,duration/1.5,{
            x: pointClone.x,
            y:pointClone.y,
            z:pointClone.z
        });
        TweenMax.to(currentPosition,duration,{
            now:0.8,
            onUpdate: function(){
                var pos = cameraPath.getPoint(currentPosition.now);
                that.target = new THREE.Vector3(targetCurrent.x,targetCurrent.y,targetCurrent.z);
                that.camera.position.set(pos.x,pos.y,pos.z);
                that.camera.up.set(upClone.x,upClone.y,upClone.z);
                that.camera.lookAt(that.target);
                that.camera.updateProjectionMatrix();
            },
            onStart: that.startAnimation,
            onComplete: function(){
                that.endAnimation();
                if (typeof callback === "function") callback();
            }
        });
    },

    cameraPathToPoint: function(fromPoint,toPoint){
        var spline = new THREE.SplineCurve3([
           fromPoint,
           new THREE.Vector3( (toPoint.x-fromPoint.x)*0.5 + fromPoint.x, (toPoint.y-fromPoint.y)*0.5 + fromPoint.y, (toPoint.z-fromPoint.z)*0.7 + fromPoint.z),
           toPoint
        ]);

        return spline;
    },

    strafeFromPointToPoint: function(fromPoint,toPoint,callback){
        var dest = toPoint.clone(),
            current = this.camera.position.clone(),
            duration = 0.5,
            that = this;
        dest.sub(fromPoint.clone());
        dest.add(current.clone());
        //console.log("\n\n",fromPoint,toPoint,current,dest);

        if (that.isAnimating === true) return;

        TweenMax.to(this.camera.position,duration,{x: dest.x,y: dest.y, z: dest.z,
            onComplete: function(){
                that.endAnimation();
                that.camera.lookAt(toPoint.clone());
                that.target = toPoint.clone();
                if (typeof callback === "function") callback();
            },
            onStart: that.startAnimation
        })
    },

    reset: function(callback){
        var duration = 2,
            that = this,
            home = Galaxy.Settings.cameraDefaultPosition.clone(),
            center = Galaxy.Settings.cameraDefaultTarget.clone(),
            upGoal = Galaxy.Settings.cameraDefaultUp.clone(),
            upCurrent = this.camera.up.clone(),
            targetCurrent = this.target.clone(),
            positionCurrent = this.camera.position.clone();

        // never do anything when nothing will suffice. The callback should have no delay.
        if (this.camera.up.equals(Galaxy.Settings.cameraDefaultUp) &&
            this.camera.position.equals(Galaxy.Settings.cameraDefaultPosition) &&
            this.target.equals(Galaxy.Settings.cameraDefaultTarget)) {

            duration = 0.1;
        }
        if (that.isAnimating === true) return;

        TweenMax.to(upCurrent,duration/1.5,{x: upGoal.x,y: upGoal.y,z: upGoal.z});
        TweenMax.to(targetCurrent,duration/1.5,{x: center.x,y: center.y, z: center.z});
        TweenMax.to(positionCurrent,duration,{x: home.x,y: home.y, z: home.z,ease: Power1.easeInOut,
            onUpdate: function(){
                that.target = new THREE.Vector3(targetCurrent.x,targetCurrent.y,targetCurrent.z);
                that.camera.position.set(positionCurrent.x,positionCurrent.y,positionCurrent.z);
                that.camera.up.set( upCurrent.x,upCurrent.y,upCurrent.z );
                that.camera.lookAt(that.target.clone());
                that.camera.updateProjectionMatrix();
            },
            onComplete: function(){
                that.endAnimation();
                that.firstClick = true;
                if (typeof callback === "function") callback();
            },
            onStart: that.startAnimation
        })
    },

    CAMERA_RELATION : {
        ABOVE: 0,
        SAME_ANGLE: 1,
        TOWARD_CENTER: 2
    },

    zoomToFitPointsFrom: function(pointList,cameraRelation,callback) {
        if (!_.has(_.values(this.CAMERA_RELATION),cameraRelation)) {
            // console.log(_.values(this.CAMERA_RELATION));
            console.error(cameraRelation + " is not one of RELATIVE_LOCATION");
            return;
        }
        if (this.isAnimating === true) return;

        // pointList assumed to already be in world coordinates. Figure out bounding sphere, then move camera relative to its center
        var bSphere = new THREE.Sphere(new THREE.Vector3(0,0,0),5);
        bSphere.setFromPoints(pointList);

        // how far away do we need to be to fit this sphere?
        var targetDistance = (bSphere.radius / (Math.tan(Math.PI*this.camera.fov/360))),
            cameraPositionEnd,
            that = this,
            duration = 1,
            up = this.camera.up.clone(),
            currentCameraPosition = this.camera.position.clone();

        switch (cameraRelation) {
            case 0:
                // CAMERA_RELATION.ABOVE
                cameraPositionEnd = bSphere.center.clone().add(new THREE.Vector3(40,40,targetDistance));
                break;

            case 1:
                // CAMERA_RELATION.SAME_ANGLE dollies the camera in/out such that these points become visible
                var center = bSphere.center.clone(),
                    currentPos = that.camera.position.clone(),
                    finalViewAngle = currentPos.sub(center).setLength(targetDistance);
                cameraPositionEnd = bSphere.center.clone().add(finalViewAngle);

                // to prevent camera from going under the background plane:
                cameraPositionEnd.z = Math.max(cameraPositionEnd.z,40);
                break;

            case 2:
                // CAMERA_RELATION.TOWARD_CENTER Draws a line from world origin through the bounding sphere's center point,
                // and puts the camera at the end of a vector twice that length.
                cameraPositionEnd = bSphere.center.clone().multiplyScalar(2);
                if (cameraPositionEnd.length() < 125) cameraPositionEnd.setLength(125);  // It's weird when the camera gets too close to stars in the middle
                break;

        }
        var cameraTargetCurrent = {x: this.target.x, y: this.target.y, z: this.target.z};
        var cameraTargetEnd = bSphere.center.clone();

//        that.logVec('up',that.camera.up.clone());
//        that.logVec('target',that.target.clone());
//        that.logVec('position',that.camera.position.clone());
        TweenMax.to(cameraTargetCurrent,duration/1.5,{x: cameraTargetEnd.x,y: cameraTargetEnd.y, z: cameraTargetEnd.z});

        // DO NOT change "up" for  high angle. It gets screwy and spins the camera unpleasantly.
        if (cameraRelation !== 0) {TweenMax.to(up,duration/1.5,{x: 0,y: 0, z: 1});}

        TweenMax.to(currentCameraPosition,duration,{x: cameraPositionEnd.x,y: cameraPositionEnd.y, z: cameraPositionEnd.z,
            onUpdate: function(){
                that.target = new THREE.Vector3(cameraTargetCurrent.x,cameraTargetCurrent.y,cameraTargetCurrent.z);
                that.camera.position.set(currentCameraPosition.x,currentCameraPosition.y,currentCameraPosition.z);
                that.camera.up.set( up.x,up.y,up.z );
                that.camera.lookAt(that.target.clone());
                that.camera.updateProjectionMatrix();
            },
            onComplete: function(){
//                that.logVec('up',that.camera.up.clone());
//                that.logVec('target',that.target.clone());
//                that.logVec('position',that.camera.position.clone());
                that.endAnimation();
                if (typeof callback === "function") callback();
            },
            onStart: that.startAnimation
        })
    },

    showThreePointsNicely: function(pointList, callback){
        // Find a camera location and rotation such that the first point appears towards the bottom of the screen, and
        // the other two appear up and to the left and right. Or so.
        if (this.isAnimating === true) return;
        this.firstClick = false;
        if (!_.isArray(pointList)) {
             throw new Error ("Array of points required for showThreePointsNicely");
        } else if (pointList.length !== 3) {
            // just show the first one.
            this.zoomAndDollyToPoint(pointList[0],callback);
            return;
        }

        var pointZero = pointList[0].clone();

        // look at the world from the perspective of the star that will be centered:
        var viewFromPointZero = function(vector){
            return vector.clone().sub(pointZero.clone());
        };

        // The "bisect" vector is a central angle between the Left and Right stars that we're trying to make visible on screen, along with vector Zero
        var bisectLocal = viewFromPointZero( pointList[1]).add(viewFromPointZero( pointList[2])).multiplyScalar(0.5);

        // The linear path would be described as....
        var A = viewFromPointZero(pointList[1]);
        var B = viewFromPointZero(pointList[2]);
        var theta = Math.acos(A.clone().dot(B.clone()) / A.length() / B.length() );
        var distanceAwayBasedOnAngle = Math.min(Math.max(theta*2.5,2),4);

        var cameraEndPosition = pointZero.clone().sub(bisectLocal.clone().multiplyScalar(distanceAwayBasedOnAngle));
        var cameraStartPosition = this.camera.position.clone();
        var cameraPathMidpoint = cameraEndPosition.clone().add(cameraStartPosition.clone()).multiplyScalar(0.5);

        // The circular path around the linear path's midpoint would be, then:
        var radius = cameraStartPosition.clone().sub(cameraPathMidpoint.clone()).length();

        var that = this;
        var worldPointOnCircularPath = function(t){
            var x = radius * Math.cos(t);
            var y = radius * Math.sin(t);
            var vectorPointLocal = new THREE.Vector3(x,y,0);
            return vectorPointLocal.add(cameraPathMidpoint.clone());
        };

        // backsolve the start angle for the circular path. It's the inverse of x=a+r*cos(theta) => theta = acos((x-a)/r);
        var startPointRelativeToMidpoint = cameraStartPosition.clone().sub(cameraPathMidpoint.clone());
        var startAngle = Math.atan(startPointRelativeToMidpoint.y/startPointRelativeToMidpoint.x);

        // Is this the start angle or the end angle? It's one or the other, but we need to know which.... The other will be this + PI
        if (worldPointOnCircularPath(startAngle).setZ(0).distanceTo(cameraStartPosition.clone().setZ(0)) > 100) {
            // gotta start halfway around instead. such is the world of inverse trig functions
            startAngle += Math.PI;
        }

        var parameters = {
                t: startAngle,
                z: cameraStartPosition.clone().z
            },
            duration = 2.0,
            up = that.camera.up.clone();

        var pointZeroClone = pointZero.clone();
        TweenMax.to(that.target,duration/1.5,{x: pointZeroClone.x,y: pointZeroClone.y,z: pointZeroClone.z});
        TweenMax.to(up,duration/1.5,{x: 0,y: 0, z: 1});

        TweenMax.to(parameters,duration,{
            t: startAngle - Math.PI,
            z: cameraEndPosition.clone().z,
            ease: Power1.easeOut,
            onUpdate: function(){
                var xyCurrent = worldPointOnCircularPath(parameters.t);
                that.camera.position.set(xyCurrent.x,xyCurrent.y,parameters.z);
                that.camera.up.set( up.x,up.y,up.z );
                that.camera.lookAt(that.target);
                that.camera.updateProjectionMatrix();
            },
            onComplete: function(){
                that.endAnimation();
                if (typeof callback === "function") callback();
            },
            onStart: that.startAnimation
        });
    },


    // The camera can also "travel" while in unattended mode. This behavior requires some code to parametrically define and then animate the complex path,
    // But it is somewhat different in kind from the user-initiated camera motions described above.
    beginAutomaticTravel: function(){
        // This function absolutely positively must begin from the camera home positions.
        // console.log('commencing automatic camera travel');
        var obj = {cameraParameter: Math.PI/2},
            that=this,
            loopConstants = this.loopConstants();
        this.reset(function(){
            that.__automaticCameraAnimation = TweenMax.to(obj, loopConstants.duration, {
                cameraParameter: 5*Math.PI/2,
                onUpdate:function(){
                    that.cameraSetupForParameter(obj.cameraParameter,loopConstants);
                },
                ease: null,
                repeat: -1 // loop infinitely
            });
        });
    },
    loopConstants: function(){
        var galaxyLoopStart = new THREE.Vector3(200,0,15),
            targetLoopStart = new THREE.Vector3(200,200,5),
            upLoopStart = new THREE.Vector3(0,0,1);
        return {
            duration : 400, // seconds
            galaxyLoopStart : galaxyLoopStart,
            targetLoopStart: targetLoopStart,
            upLoopStart: upLoopStart,
            galaxyLoopToHome : Galaxy.Settings.cameraDefaultPosition.clone().sub(galaxyLoopStart.clone()),
            targetLoopToHome : Galaxy.Settings.cameraDefaultTarget.clone().sub(targetLoopStart.clone()),
            upLoopToHome : Galaxy.Settings.cameraDefaultUp.clone().sub(upLoopStart.clone())
        }
    },
    cameraSetupForParameter: function(cameraParameter,loopConstants){
        var pos,lookAt = loopConstants.targetLoopStart.clone(),up = loopConstants.upLoopStart.clone();
        if (cameraParameter < 2*Math.PI && cameraParameter > Math.PI) {
            cameraParameter -= Math.PI;
            // go a full circle around the galaxy
            pos = new THREE.Vector3(200*Math.cos(cameraParameter),200*Math.sin(cameraParameter),15);
            var copy = pos.clone();
            lookAt = new THREE.Vector3(copy.x ,copy.y + copy.x,5);
        } else {
            // after going a full circle around the galaxy, animate all camera characteristics to the "home" position, then repeat from start
            var pathMultiplier = Math.sin(cameraParameter );  // good from 0 to PI. Outside that range, this goes negative and looks haywire.
            pos = loopConstants.galaxyLoopStart.clone().add(loopConstants.galaxyLoopToHome.clone().multiplyScalar(pathMultiplier));
            lookAt = loopConstants.targetLoopStart.clone().add(loopConstants.targetLoopToHome.clone().multiplyScalar(pathMultiplier));
            up = loopConstants.upLoopStart.clone().add(loopConstants.upLoopToHome.clone().multiplyScalar(pathMultiplier));
        }
        this.camera.position.set(pos.x,pos.y,pos.z);
        this.camera.up.set(up.x,up.y,up.z);
        this.target = lookAt;
        this.camera.lookAt(lookAt);
        this.camera.updateProjectionMatrix();
    },
    endAutomaticTravel: function(){
        if (this.__automaticCameraAnimation) {
            this.__automaticCameraAnimation.kill();
        }
    },

    // DEBUGGING TOOLS
    logVec: function(message,vec){
        console.log(message + ": " + vec.x + " " + vec.y + " " + vec.z);
    },
    addTestCubeAtPosition: function(position){
        var cube = new THREE.Mesh( new THREE.CubeGeometry( 5, 5, 5 ), new THREE.MeshNormalMaterial() );
        cube.position = position.clone();
        Galaxy.Scene.add( cube );
    }

}