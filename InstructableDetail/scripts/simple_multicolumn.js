function ColumnLayouter(){
    this.init();
}

ColumnLayouter.prototype.init = function(){
    this.columnWidth = 350;
    this.gutterWidth = 30;
    this.columnHeight = 590;

    this.currentColumnIndex = 0;
};

ColumnLayouter.prototype.layoutStep = function(titleHTML,bodyTextHTML,imageArray){
    // just lay out columns of text until done, no more than one column of text per image within step.


    var leftEdge = this.currentColumnIndex * (this.columnWidth+this.gutterWidth);
    var element = $("<div class='bodyText' style='left:"+leftEdge+";'></div>");
    $('.contentContainer').append(element);

    this.currentColumnIndex = this.currentColumnIndex+1;
};