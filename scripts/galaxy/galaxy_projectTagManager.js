Galaxy.ProjectTagManager = function(particleSystemsArray,camera,settings,data){
    _.bindAll(this,
        'addTagForProjectId',
        'addRandomTags',
        'updateActiveTagPositions',
        'removeTagForProjectId',
        'removeAllTags',
        'currentPositionForProjectId',
        'updateTagPosition',
        'cullOverlaps',
        'maintainTagCount',
        'tagOverlapsAnother'
    );

    this.activeTags = {};
    this.__activeTagCount = 0;
    this.__projectSubset = null;
    this.particleSystems = particleSystemsArray;
    this.camera = camera;
    this.settings = settings;
    this.projectData = data;
    this.$container = $('body');

    this.addPickRandomMixin();

    var that = this;
    setInterval(that.cullOverlaps,1500);
};

Galaxy.ProjectTagManager.prototype = {
    constructor: Galaxy.ProjectTagManager,
    tagSubsetOfProjects: function(subset){
        var maintainTags = this.__activeTagCount.toString();
        this.removeAllTags();   // sets activeTagCount to zero
        this.__projectSubset = subset;
        this.addRandomTags(parseInt(maintainTags));
    },
    tagAnyProjects: function(){
        this.__projectSubset = null;
    },
    buildTagForProjectId: function(projectId){
        if (_.has(this.activeTags,projectId)){
//            if (!_.isUndefined(console)) {
//                console.warn("You can't add a tag for a project that's already tagged!");
//            }
            return null;
        }

        // create the tag
        this.projectData[projectId]['squareUrl'] = this.projectData[projectId]['imageUrl'].replace("SQUARE3","SQUARE");
        var tag = $(_.template($('#template_project_tag_small').html(),this.projectData[projectId]));
        this.$container.append(tag);

        // find its corresponding node's position in the world, then on screen xy
        tag.css({display: 'block'});
        tag.attr('maxCullings',parseInt(Math.random()*7 + 7));
        this.updateTagPosition(tag,projectId);

        // clicking a tag is handled here so event paths are clear.
        // It triggers an event that gets passed to the interactionHandler, which will do the camerawork
        tag.attr('instructable',projectId);
        tag.on('click',{context: this},this.handleTagClick);

        return tag;
    },
    addTag: function(tag){
        // adding 'in' right away looses the transition. wait for the next frame
        _.defer(function(){
            tag.addClass('in'); // fade in manually, since we're not really using popover() as intended
        });

        // add it to the list of active tags
        var projectId = tag.attr('id').substr(4);
        this.activeTags[projectId] = $('#tag_'+projectId);
    },
    addTagForProjectId: function(projectId){
        var tag = this.buildTagForProjectId(projectId);
        if (!_.isNull(tag)){
            this.addTag(tag);
        }
        return tag;
    },
    handleTagClick: function(e){
        e.stopPropagation();
        var that = e.data.context,
            clickedElement = $(this),
            referencedItem = clickedElement.attr('instructable');

        // trigger an event that can be listened to from the outside
        $(that).trigger({
            instructableId: referencedItem,
            type: 'clickTag'
        });

        _.delay(that.removeAllTags,1000);
    },
    tagOverlapsAnother: function(tag){
        // Note that for efficiency, code is largely repeated here and in 'cullOverlaps' below. This code runs a lot and fast, so it seems plausible to be worth it
        var tagOffset = tag.offset();
        var noOverlap = _.every(this.activeTags,function(compareTag){
            var compareOffset = compareTag.offset();
            if ( Math.abs(tagOffset.left - compareOffset.left) < (tag.width()+20) && Math.abs(tagOffset.top - compareOffset.top) < (tag.height()+20) ) {
                return false; // these tags overlap
            }
            return true; // no overlap
        });
        return !noOverlap;
    },
    cullOverlaps: function(){
        var that = this;

        // Cull overlapping tags
        _.every(this.activeTags,function(tag){
            // by using "every" we can prevent ourselves from removing too many tags per culling operation. We don't want to remove BOTH overlapping
            // tags, for example. If one tag is removed, that's enough for this culling round.
            var tagOffset = tag.offset();
            return _.every(that.activeTags,function(compareTag){
                var compareOffset = compareTag.offset();
                if (compareTag !== tag && Math.abs(tagOffset.left - compareOffset.left) < (tag.width()+20) && Math.abs(tagOffset.top - compareOffset.top) < (tag.height()+20) ) {
                    var pid = tag.attr('id').substr(4);
                    that.removeTagForProjectId(pid);
                    return false;
                }
                return true;
            });
        });

        // Cull tags that go offscreen. Cull tags that have been onscreen for too long.
        _.each(that.activeTags,function(tag){
            var pid = tag.attr('id').substr(4);

            // Cull offscreen tags
            var position = that.currentPositionForProjectId(pid);
            if (!_.isUndefined(position) && that.positionIsInBounds(position) === false) {
                that.removeTagForProjectId(pid);
            }

            // Cull tags that have been onscreen too long
            var cullings = parseInt(tag.attr('cullings'));
            var maxCullings = parseInt(tag.attr('maxCullings'));
            if (cullings > maxCullings) {
                that.removeTagForProjectId(pid);
            } else {
                tag.attr('cullings',cullings+1);
            }
        });

        // If we're short on the total number of tags onscreen, add some:
        this.addRandomTags(this.__activeTagCount);
    },
    maintainTagCount: function(howMany){
        this.__activeTagCount = howMany;
        this.addRandomTags(howMany);
    },
    addRandomTags: function(howMany){
        // we ADD howMany - currentNumber
        var numberToAdd = Math.max(0,howMany - _.keys(this.activeTags).length);
        if (numberToAdd === 0) {
            //console.warn('Adding zero tags because ' + howMany + ' are already active.');
            return;
        }

        // pick out some ids at random
        var projects = !_.isNull(this.__projectSubset) ? this.__projectSubset : this.projectData,
            ids = _.keys(projects),
            that = this;
        ids = _.pickRandom(ids,numberToAdd + 5); // we'll build more tags than we need, in case some fail their cull-tests right away
        var addedCount = 0;
        _.each(ids,function(id){
            if (addedCount === numberToAdd) return; // don't add more tags than we're supposed to

            var proposedTag = that.buildTagForProjectId(id);
            if (!_.isNull(proposedTag)) {
                var overlaps = that.tagOverlapsAnother(proposedTag),
                    position = that.currentPositionForProjectId(id),
                    inBounds =  that.positionIsInBounds(position);

                // if position is in bounds & tag doesn't overlap another
                if (inBounds === true && overlaps === false) {
                    addedCount ++;
                    that.addTag(proposedTag);
                } else {
                    proposedTag.off();
                    proposedTag.remove();
                }
            }
        });
    },
    updateActiveTagPositions: function(){
        var that = this;
        _.each(this.activeTags,function(tag,projectId){
            that.updateTagPosition(tag,projectId);
        });
    },
    updateTagPosition: function(tag,projectId){
        var position = this.currentPositionForProjectId(projectId);
        if (!_.isUndefined(position)) {
            tag.css({
                top: Math.round(position.y),
                left: Math.round(position.x)
            });
        }
    },
    positionIsInBounds: function(position){
        if (_.isUndefined(position)) return false;
        if (position.x < 5 || position.y < 40 || position.x > this.settings.width - 200 || position.y > this.settings.height - 40) {
            return false;
        }
        return true;
    },
    currentPositionForProjectId: function(projectId){
        if (_.isUndefined(this.projectData[projectId])){
            //console.log(projectId);
            throw new Error("Can't find project data associated with that id");
        }

        var particleSystem = Galaxy.Utilities.particleSystemForProjectid(projectId);
        if (_.isUndefined(particleSystem)) {console.log("Couldn't find category ring for project "+projectId); return;}

        var vector = Galaxy.Utilities.vertexForProjectId(projectId, particleSystem).clone();
        particleSystem.updateMatrixWorld();
        vector.applyMatrix4(particleSystem.matrix);

        return Galaxy.Utilities.vectorWorldToScreenXY(vector,this.camera);
    },
    removeTagForProjectId: function(projectId){
        var tag = this.activeTags[projectId],
            that=this;
        if (_.isUndefined(tag)) {
            return;
        }

        var deleteTag = function(){
            tag.remove();
            delete that.activeTags[projectId];
        };

        tag.removeClass('in');
        tag.off();

        if (tag.hasClass('out')) {
            deleteTag();
        } else {
            _.delay(deleteTag,150);
        }
    },
    removeAllTags: function(){
        var that = this;
        this.__activeTagCount = 0;
        _.each(_.keys(this.activeTags),function(projectId){
            that.removeTagForProjectId(projectId);
        });
    },
    addPickRandomMixin: function(){
        _.mixin({
            // from https://gist.github.com/skagedal/1709989
            pickRandom: function(array, n, guard) {
                if (n == null  || guard)
                    return array[Math.floor(Math.random() * array.length)];

                n = Math.max(0, Math.min(array.length, n));

                return (function pickR(array, n, length) {
                    var i, picked, rest, hasIndex;

                    if (n === 0) return [];

                    i = Math.floor(Math.random() * length);
                    hasIndex = array.hasOwnProperty(i);	// This is needed for restoration of dense arrays
                    picked = array[i];
                    array[i] = array[length - 1];
                    rest = pickR(array, n - 1, length - 1);
                    // Restore array
                    if (hasIndex) {
                        array[i] = picked;
                    } else {
                        delete array[i];
                    }
                    rest.push(picked);
                    return rest;
                }) (array, n, array.length);
            }
        });
    }
};
