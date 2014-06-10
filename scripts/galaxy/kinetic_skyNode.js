
Kinetic.skyNode = function(config) {
    this._initMyCircle(config);
};

Kinetic.skyNode.prototype = {
    _initMyCircle: function(config) {
        Kinetic.Circle.call(this, config);
        this.className = "skyNode";
    }
};

Kinetic.Util.extend(Kinetic.skyNode, Kinetic.Circle);

