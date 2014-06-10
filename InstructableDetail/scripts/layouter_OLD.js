function IbleLayouter(container, instructable) {
    this.init(container, instructable);
};
IbleLayouter.prototype.init = function(container, instructable){
    this.columnWidth = 350;
    this.gutterWidth = 30;
    this.columnHeight = 500;
    this.imageBlocks(1,1);
}

IbleLayouter.prototype.imageBlocks = function(step, startingColumnPosition) {
    console.log('init');
    for (var i = 0; i < 10; i++){
        var imageBlock = this.imageBlockProperties(),
            position = this.imageBlockPositioning(imageBlock, i*2);
        var element = $("<div style='position:absolute;background-color: black;'></div>");
        element.css(position).addClass("stepImage");
        $('.contentContainer').append(element);
        this.flowTextBlocksAroundImageBlock(position, i*2);
//        console.log(imageBlock);
    }
}
IbleLayouter.prototype.imageBlockProperties = function(){
    /* Returns a dictionary with selections of properties in the following categories:
    * 1) Fix to top, middle, bottom
    * 2) Fix Left, Right
    * 3) Width: 1/2 column, full column, 2 column
    * 4) Aspect: vertical, horizontal, square
    * 5) Height (px) -- function of width & aspect
    * */
    var vLock, hLock, width, height, aspect;

    aspect = ['vertical','horizontal','square'][ parseInt(Math.random()*3) ];
    vLock = ['top','middle','bottom'][ parseInt(Math.random()*3) ];
    hLock = ['left', 'right'][ parseInt(Math.random()*2) ];

    // vertical aspect constricts choices for width / column spanning
    if (aspect == "vertical") {
//        width = [0.5,1][ Math.round(Math.random()) ];
        width = 1;
    } else if (aspect == "horizontal") {
        width = [1,2][ Math.round(Math.random()) ] ;
    } else {
        width = [1,2][ Math.round(Math.random()) ];
//        width = [0.5,1,2][ Math.round(Math.random()*2) ];
    }

    if (width == 2 && vLock == "middle") {
        vLock = ['top','bottom'][ parseInt(Math.random()*2) ];
    }

    return {
        vLock: vLock,
        hLock: hLock,
        widthDiscreet: width,
        aspect: aspect
    }
}
IbleLayouter.prototype.imageBlockPositioning = function(imageBlock, columnNumber) {

    var height, top, left,
    width = parseInt(imageBlock.widthDiscreet * this.columnWidth);
    if (imageBlock.widthDiscreet == 2) {width += this.gutterWidth;}

    // Calculate height
    if (imageBlock.aspect == 'square') {height = width;}
    else if (imageBlock.aspect == "horizontal") {height = width/1.61;}
    else {height = width * 1.61;}

    // Height can't be taller than column, and it has to either leave 1/3 of column height or none.
    height = Math.min(parseInt(height),this.columnHeight);
    if (height > this.columnHeight * 0.67 && height < this.columnHeight) height = this.columnHeight * 0.67;
    height = parseInt(height)

    // left position based on column
    left = columnNumber * (this.columnWidth + this.gutterWidth);
    if (imageBlock.hLock == "right" && imageBlock.widthDiscreet == 0.5) left += this.columnWidth/2;

    // top position
    if (imageBlock.vLock == 'top') top = 0;
    else if (imageBlock.vLock == 'bottom') top = this.columnHeight - height;
    else top = (this.columnHeight-height)/2;

    return {
        left: left,
        top: top,
        width: width,
        height: height
    };
}
IbleLayouter.prototype.flowTextBlocksAroundImageBlock = function(imageBlock,columnNumber){
    var block1 = this.defineBlockAbove(imageBlock, columnNumber),
        block2 = this.defineBlockBeside(imageBlock, columnNumber),
        block3 = this.defineBlockBelow(imageBlock, columnNumber),
        block4 = this.defineBlockNextColumn(imageBlock, columnNumber),
        iterable = [block1,block2,block3,block4];

    _.each(iterable,function(block){
        if (!_.isUndefined(block)){
            var element = $("<div style='position:absolute;'></div>");
            element.css(block).addClass("bodyText");
            $('.contentContainer').append(element);
        }
    });
}
IbleLayouter.prototype.defineBlockBeside = function(imageBlock,columnNumber){
    if (imageBlock.width > this.columnWidth/2+2) {return undefined;}
    var left = columnNumber*(this.columnWidth + this.gutterWidth), sideBlock;
    if (imageBlock.left - left < 2) {left += this.columnWidth/2;}
    sideBlock = {
        top: imageBlock.top,
        width: this.columnWidth/2,
        height: imageBlock.height,
        left: left
    };
    return sideBlock;
}
IbleLayouter.prototype.defineBlockBelow = function(imageBlock,columnNumber){
    if (imageBlock.top + imageBlock.height > this.columnHeight - 2) {return undefined;}
    return {
        top: imageBlock.top + imageBlock.height,
        left: columnNumber * (this.columnWidth + this.gutterWidth),
        width: this.columnWidth,
        height: this.columnHeight - (imageBlock.height + imageBlock.top)
    }
}
IbleLayouter.prototype.defineBlockAbove = function(imageBlock,columnNumber){
    if (imageBlock.top == 0) {return undefined;}
    return {
        top: 0,
        left: columnNumber * (this.columnWidth + this.gutterWidth),
        height: imageBlock.top,
        width: this.columnWidth
    }
}
IbleLayouter.prototype.defineBlockNextColumn = function(imageBlock,columnNumber){
    var nextColBlock = {
        left : (columnNumber + 1) * (this.columnWidth + this.gutterWidth),
        width : this.columnWidth,
        height : this.columnHeight - imageBlock.height
    };
    if (imageBlock.width - this.columnWidth < 2) {
        // full column!
        nextColBlock.height = this.columnHeight;
        nextColBlock.top = 0;
        return nextColBlock;
    }

    // The next-over column needs a block above or below. "middle" isn't a valid position for a 2-span image area.
    if (imageBlock.top == 0) {
        nextColBlock.top = imageBlock.height;
    } else {
        nextColBlock.top = 0;
    }
    return nextColBlock;
}