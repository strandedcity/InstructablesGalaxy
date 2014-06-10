window.GalaxyTextInputModal = window.GalaxyTextInputModal || {};

window.GalaxyToolbar = Backbone.View.extend({
    template: _.template($('#template_toolbar').html()),
    tagName: "div",
    events: {
        "click #toolbar": "searchAction"
    },
    initialize: function(){
        this.render();
    },
    render: function(){
        this.$el.append($(this.template()));
        $('body').append(this.$el);
    },
    searchAction: function(e){
        e.preventDefault();
        this.trigger("requestSearchKeyboard");
    }
});

window.GalaxyTextInputModal = Backbone.View.extend({
    template: _.template($('#template_textInputModal').html()),
    tagName: "div",
    events: {
        "click div.backdrop": "closeModal"
    },
    initialize: function(options){
        this.options = options || {};
        this.render();
    },
    render: function(){
        var that = this;

        this.$el.append($(this.template()));
        $('body').append(this.$el);
        this.$el.find('.titleLine').html(this.options.titleLine);
        this.$el.find('.promptLine').html(this.options.promptLine);

        _.defer(function(){that.$el.find('.fade').addClass('in');});

        this.$el.find('.osk-trigger').onScreenKeyboard({
            rewireReturn : that.options.enterButtonTitle,
            rewireTab : true
        });
        $('#searchInput').trigger("click");
        $('#searchForm').on('submit',function(e){
            that.submitSearch.apply(that,[e]);
        });
    },
    submitSearch: function(e){
        e.preventDefault();
        e.stopPropagation();
        var searchTerm = $('#searchInput').val();

        // Backdoor for easy reset without keyboard/mouse!
        if (searchTerm == "WOPR") { // hey there, future programmer. Seen "War Games" Recently?
            window.location.reload();
        } else if (!_.isUndefined(this.options) && !_.isUndefined(this.options.callback)) {
            this.options.callback(searchTerm);
        }
    },
    closeModal: function(callback){
        var that = this;

        this.$el.find('.fade.in').removeClass('in');
        _.delay(function(){
            that.trigger('removed');
            that.$el.find('#searchForm').off();
            that.remove();
            if (typeof callback == "function") callback();
        }, 250);
    }
});

window.GalaxyStatusIndicator = Backbone.View.extend({
    tagName: "h3",
    className: "statusIndicator fade",
    initialize: function(){
        _.bindAll(this,'showMessage','clearMessage','clearAfterTimeout');
        this.render();
    },
    render: function(){
        $('body').append(this.$el);

        var that = this;
        this.timeOut = setTimeout(function(){
            that.showMessage("Good to go.",false,true);
        },1000);
    },
    showMessage: function(message,isError,autoHide){
        if (!_.isUndefined(this.timeOut)) {
            clearTimeout(this.timeOut);
        }

        // label-danger, label-success
        var labelClass = isError ? "label-danger" : "label-success";

        this.$el.html("<span class='label "+labelClass+"'>"+message+"</span>");
        this.$el.addClass('in');

        if (autoHide !== false){
            this.clearAfterTimeout();
        }
    },
    clearAfterTimeout: function(){
        var that = this;
        this.timeOut = setTimeout(function(){
            that.clearMessage();
        },6000);
    },
    clearMessage: function(){
        this.$el.removeClass('in');
    }
});