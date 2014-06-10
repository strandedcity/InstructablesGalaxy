// Galaxy history manages a running list of actions that have been performed, either automatically or by the user.
// It also sets up the automatic mode so that the screen runs autonomously, and can be interrupted any time.

window.STAGE = window.STAGE || {};
window.CURSOR = window.CURSOR || {};

GalaxyHistory = function(){
    this.init();
};

GalaxyHistory.prototype.init = function(){
    this.idleTimeToAutomaticMode = 60;
    this.idleTimer = undefined;
    this.autoModeRunning = false;
    this.automationTimer = undefined;

    // Set up the idle timer. Don't bother to reset any more than is strictly necessary.
    var that = this;

    // To simplify closures and contexts, it's easiest to simply bind to a global event for the automation stuff
    $('body').on('nextEnqueuedEvent',function(){
        if (that.autoModeRunning === true) {
            that.executeItemFromQueuedStack.apply(that);
        }
    });

    // next/back just move events from one stack to the other using push() or pop(), executing in between.
    this.historyStack = [];
    this.enqueuedStack = [];

    // just to get started in auto mode
    _.delay(function(){
        // starts auto mode
        that.goToRandomNodeOfAvailableNodes.apply(that);
        that.userIsIdle.apply(that);
    },1000);
};

// This function used to be called from the history's own init. HOWEVER: THERE IS A VERY STRANGE PATTERN I'M USING
// TO APPROXIMATE INTERRUPTS IN JAVASCRIPT, IT INVOLVES THROWING AND CATCHING AN ERROR TO HALT ALL EXECUTION WHEN NODES
// ARE CLICKED. SINCE THIS OCCURS INSIDE THE ONCLICK EVENT HANDLER, THIS MUST BE CALLED FROM THE TOP OF GALAXYCURSOR INSTEAD.
GalaxyHistory.prototype.resetIdleTimer = function(e){
    // Selected events are triggered by the automation, and should not trigger a reset of the idle timer
    var className = $(e.target).attr('class');
    if (!_.isUndefined(className) && className.indexOf("osk-") > -1) {
        return;
    }

    var that = this;
    this.autoModeRunning = false;
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(function(){that.userIsIdle.apply(that);},that.idleTimeToAutomaticMode*1000);
};

GalaxyHistory.prototype.userIsIdle = function(){
    this.autoModeRunning = true; // this makes it so that the automatic events don't have to have their own interval. Each event can just set its own timer after it completes.

    // fired when the user has been idle for idleTimeToAutomaticMode seconds
    this.enterAutomaticMode();
};

GalaxyHistory.prototype.executeItemFromQueuedStack = function(){
    var that = this;

    if (this.autoModeRunning === true) {
        // Make sure there's a supply of "next" actions
        if (that.enqueuedStack.length == 0) {
            //that.enqueuedStack = that.queueUp(150);
            window.location.reload();
            return;
        }

        // Do the next item in the stack! Individual actions place their own items in the history stack, since they may do things like select random nodes along the way
        var queuedItem = that.enqueuedStack.shift();
        that[queuedItem.action].apply(that,[queuedItem]);

        // Cue up the next one
        that.setAutomationTimerFor(queuedItem.pauseAfter);
    }
};

GalaxyHistory.prototype.setAutomationTimerFor = function(timeInSeconds){
    clearTimeout(this.automationTimer);
    this.automationTimer = setTimeout(function(){
        $('body').trigger("nextEnqueuedEvent");
    },timeInSeconds*1000);
};

GalaxyHistory.prototype.goBack = function(){
    // There should be no interference between this functionality and the automated functionality, since the automated
    // stuff will turn off instantly when the user taps the back button (or anything else)
    console.warn('back button not yet supported');
//    var that=this, queuedItem = that.historyStack.pop();
//    that[queuedItem.action].apply(that,[queuedItem]);
};


GalaxyHistory.prototype.enterAutomaticMode = function(){
    this.enqueuedStack = this.queueUp(150);

    $('body').trigger("nextEnqueuedEvent");
};

GalaxyHistory.prototype.queueUp = function(count){
    var actions = ["goToRandomNodeOfAvailableNodes","clearScreen","searchForRandomAuthor"],
    priorAction, stack = [];

    // always start with a clear
    stack.push({
        action: "clearScreen",
        pauseAfter: 3
    });

    for (var i = 1; i < count; i++){
        var action, wait, next, seed = Math.random();
        if (seed > 0.92 && priorAction != "clearScreen") action = actions[1]; // don't repeat clearscreen
        else if (seed > 0.78 ) action = actions[2]; // show random author
        else action = actions[0];   // click available project

        if (priorAction == "clearScreen") wait = 8;
        else if (action == "clearScreen") wait = 3;
        else if (action == "searchForRandomAuthor") wait = 13;
        else wait = 5;

        next = {
            action: action,
            pauseAfter: wait
        };
        priorAction = action;

        stack[i] = next;
    }

    return stack;
};



//////////////////////////////
// The "Queueable" Actions that can be called by their string names appear here
//////////////////////////////

GalaxyHistory.prototype.goToRandomNodeOfAvailableNodes = function(queuedItem){
    var possible = SKYMAP.activeNodes.apply(SKYMAP),
    selected = possible[parseInt(Math.random()*(possible.length))];

    // However, there might be another node on top. If so, click the one on top instead so that the nomenclature matches
    var evt = STAGE.getIntersection([selected.getX(),selected.getY()]);
    if (evt !== null && !_.isUndefined(evt.shape)) {
        //console.log(selected.getId(),evt.shape.getId());
        selected = evt.shape;
    }

//    // store something that we can use to get back to this point
//    this.historyStack.push({
//        action: "visitNodeInConstellation",
//        node: selected,
//        constellationOptions: CURSOR.currentConstellationData(),
//        pauseAfter: 5
//    });

    // no bubbling, so we don't reset the idle timer
    STAGE.fire("mousedown",{targetNode: selected},false);
};

GalaxyHistory.prototype.searchForRandomAuthor = function(){
    OPENTOOLBAR = new window.GalaxyTextInputModal({searchFor: "author"});

    var that=this,
    possible = ["randofo","scoochmaroo","noahw","makendo","wholman","mikeasaurus","Mrballeng","seamster","bajablue","jessyratfink","Kiteman"],
    selected = possible[parseInt(Math.random()*(possible.length))],
    typeName = function(name){
        var firstLetter = name.charAt(0);
        $('#searchInput').val($('#searchInput').val() + firstLetter);
        if (name.length > 1) {
            _.delay(function(){typeName(name.slice(1));},150);
        } else {
            // done typing. Simulate a search executing, but without clicking anything (that would disable auto mode)
            _.delay(function(){
                OPENTOOLBAR.searchAuthors(selected);
            },1500);
        }
    };

    // For clarity, we'll show the user the whole typing experience and such
    _.delay(function(){typeName(selected)},1500);
};

GalaxyHistory.prototype.clearScreen = function(queuedItem){
    // Clear everything
    CURSOR.clearConstellationIfNeeded();
    if (!_.isUndefined(window.OPENTOOLBAR)) window.OPENTOOLBAR.closeModal();

//    this.historyStack.push({
//        action: "clearScreen",
//        pauseAfter: 5
//    });
};

//GalaxyHistory.prototype.visitNodeInConstellation = function(queuedItem){
//    var stage = STAGE;
//    CURSOR.openConstellationWithOptions.apply(CURSOR,[queuedItem.constellationOptions,function(){
//        console.log(queuedItem.constellationOptions);
//        stage.fire("mousedown",{targetNode: queuedItem.node},false);
//    }]);
//};