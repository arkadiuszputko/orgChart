var graph = new joint.dia.Graph();

var paper = new joint.dia.Paper({
    width: 800,
    height: 800,
    gridSize: 1,
    model: graph,
    interactive: true
});

var paperScroller = new joint.ui.PaperScroller({
    paper: paper,
    autoResizePaper: true
});
paper.on('blank:pointerdown', paperScroller.startPanning);
paperScroller.$el.css({ width: '100%', height: '800px' }).appendTo('#paper');


$('#paper').append(paperScroller.render().$el);

paperScroller.centerContent();

graph.on('remove', function (cell) {
    if (cell.prop('tableId') && graph.getCell(cell.prop('tableId'))) {
        graph.getCell(cell.prop('tableId')).remove();
    }
});

$.get('./dependencies/data.json', function (data) {

    graph.fromJSON(data);
    prepareGraph(graph);
    createPapers(graph);
    layoutGraph(graph);
    layoutTables(graph);
});

var prepareGraph = function(graph) {

    var bfs = function(graph, element, iteratee, opt) {

        opt = opt || {};
        var visited = {};
        var distance = {};
        var queue = [];

        queue.push(element);
        distance[element.id] = 0;

        while (queue.length > 0) {
            var next = queue.shift();
            if (!visited[next.id]) {
                visited[next.id] = true;
                if (iteratee(next, distance[next.id]) === false) return;
                _.each(graph.getNeighbors(next, opt), function(neighbor) {
                    // Method taken from joint.dia.Graph
                    // This check is added here in order to keep
                    // sibling elements on the same rank
                    if (!_.isUndefined(distance[neighbor.id])) return;
                    distance[neighbor.id] = distance[next.id] + 1;
                    queue.push(neighbor);
                });
            }
        }
    };

    _.each(graph.getSources(), function(source) {
        bfs(graph, source, function(el, level) {
            el.set('rank', 'same_' + level);
        });
    });

    _.each(graph.getSinks(), function(sink) {
        if (sink.get('type') === 'orgChart.Node') {
            sink.attr('.expand/display', 'none');
            var sinkRank = sink.get('rank');
            _.each(graph.getNeighbors(sink, { inbound: true }), function(neighbor) {
                if (neighbor.get('rank') === sinkRank) {
                    // It's not really a parent but sibling
                    neighbor.attr('.expand/display', 'none');
                }
            });
        }
    });
};
var createPapers = function (graph) {

    paper.on("cell:pointerdown", function(cellView, evt, x, y) {
        if (cellView.model instanceof joint.shapes.orgChart.Node) {
            cellView.model.touchPosition = cellView.model.get('position');
            _.each(children(cellView.model), function (child) {
                child.distance = {
                    x: child.get('position').x - cellView.model.touchPosition.x,
                    y: child.get('position').y - cellView.model.touchPosition.y
                };
            });
        }
    });
    paper.on("cell:pointerup", function(cellView, evt, x, y) {
        if (cellView.model instanceof joint.shapes.orgChart.Node) {
            this.touchPosition = null;
        }
    });
    paper.on("cell:pointerclick", function(cellView, evt, x, y) {
        if (cellView.model instanceof joint.shapes.orgChart.Node) {
            if (V(evt.target).hasClass('expand')) {
                var cell = cellView.model;
                if (subtrees[cell.id]) {
                    graph.addCells(subtrees[cell.id].sort(function(a, b) {
                        return a instanceof joint.dia.Link ? 1 : -1;
                    }));
                    delete subtrees[cell.id];
                    return;
                }

                function store(cell) {
                    (subtrees[cellView.model.id] || (subtrees[cellView.model.id] = [])).push(cell);
                }
                graph.on("remove", store);
            //    getTree(cellView.model);
                removeSubtree(cellView.model);
                graph.off("remove", store);
                return false;
            } else {
                var cell = cellView.model;
                if (uptrees[cell.id]) {
                    graph.addCells(uptrees[cell.id].sort(function(a, b) {
                        return a instanceof joint.dia.Link ? 1 : -1
                    }));
                    delete uptrees[cell.id];
                    return;
                }

                function storeTree(cell) {
                    (uptrees[cellView.model.id] || (uptrees[cellView.model.id] = [])).push(cell)
                }
                graph.on("remove", storeTree);
                removeOtherTrees(cellView.model);
                graph.off("remove", storeTree);
                return false;
            }
        }
    });

    paper.on("cell:pointermove", function(cellView, evt, x, y) {
        if (cellView.model instanceof joint.shapes.orgChart.Node) {
            var modelPosition = cellView.model.get('position');
            if (cellView.model.touchPosition) {
                _.each(children(cellView.model), function (child) {
                    child.set('position', {
                        x: modelPosition.x + child.distance.x,
                        y: modelPosition.y + child.distance.y
                    })
                });
            }
        }
    });

    function getParent(element) {
        var parents = [];
        var rank = element.get('rank');
        _.each(graph.getConnectedLinks(element, {
            inbound: true
        }), function (link) {
            var source = graph.getCell(link.get('source').id);
            if (source && source.get('rank') !== rank) {
                parents.push(source);
            }
        });
        return parents;
    }
    function children(element) {
        var children = [];
        getChildren(element, children);
        return children;
    }
    function getChildren(element, children) {
        var rank = element.get('rank');
        _.each(graph.getConnectedLinks(element, {
            outbound: true
        }), function(link) {
            var target = graph.getCell(link.get('target').id);
            if (target && target.get('rank') !== rank) {
                children.push(target);
                getChildren(target, children);
            }
        });
    }

    function removeSubtree(element) {
        var rank = element.get('rank');
        _.each(graph.getConnectedLinks(element, {
            outbound: true
        }), function(link) {
            var target = graph.getCell(link.get('target').id);
            if (target && target.get('rank') !== rank) {
                removeSubtree(target);
                target.remove();
            }
        });
    }

    function removeUptree(element) {
        var rank = element.get('rank');
        _.each(graph.getConnectedLinks(element, {
            inbound: true
        }), function(link) {
            var source = graph.getCell(link.get('source').id);
            if (source && source.get('rank') !== rank) {
                removeUptree(source);
                source.remove();
            }
        });
    }

    function removeOtherTrees(element) {
        var childs = children(element);
        var parents = getParent(element);
        var table = element.prop('tableId');
        var tree = childs.concat(parents);
        tree.push(element);
        var treeTables = [];
        _.each(tree, function (node) {
            if (node.prop('tableId')) {
                treeTables.push(graph.getCell(node.prop('tableId')));
            }
        });
        var others = _.difference(graph.getElements(), tree.concat(treeTables));
        _.each(others, function (cell) {
            cell.remove();
        });
    }
};

var layoutGraph = function (graph) {

    var tmpGraph = new joint.dia.Graph();
    var nodes = _.filter(graph.getCells(), function(cell) {
        return !(cell instanceof joint.shapes.orgChart.Table);
    });
    tmpGraph.resetCells(nodes);
    joint.layout.DirectedGraph.layout(tmpGraph, {
        rankSep: 40,
        nodeSep: 40,
        edgeSep: 40,
        rankDir: 'TB'
    });
};

var layoutTables = function (graph) {
    var tmpGraph = new joint.dia.Graph();
    var tables = _.filter(graph.getCells(), function(cell) {
        return (cell instanceof joint.shapes.orgChart.Table);
    });
    var columnWidth = 0;
    _.each(tables, function (table) {
        columnWidth = table.getBBox().width > columnWidth ? table.getBBox().width : columnWidth;
    });
    tmpGraph.resetCells(tables);

    joint.layout.GridLayout.layout(tmpGraph, {
        columns: 200,
        columnWidth: columnWidth + 40,
        dx: 0,
        dy: 0,
        centre: false
    });

    var y = graph.getBBox(graph.getCells()).height + 200;
    _.each(tables, function(table) {
        table.position(table.prop('position/x'), y);
    });
};

var printPapers = [];


$('#printLandscape').click(function () {
    beforePrint(true);
    window.print();

    setTimeout(function(){
        $(window).one('mousemove', window.onafterprint);
    }, 1);
});
/*
$('#printPortrait').click(function () {
    beforePrint();
    window.print();

    setTimeout(function(){
        $(window).one('mousemove', window.onafterprint);
    }, 1);
});
*/
window.onafterprint = function(e){
    $(window).off('mousemove', window.onafterprint);
    afterPrint();
};


function afterPrint() {

    _.invoke(printPapers, 'remove');
    printPapers = [];

    $('.print-papers').remove();
    $('#paper').show();
    $('#printPortrait').show();
    $('#printLandscape').show();
}

function beforePrint(landscape) {
    var model = graph.toJSON();
    var cells = graph.getCells();
    var bbox = graph.getBBox(cells);
    var content = paper.getContentBBox();

    console.log(bbox, content);
    if (landscape) {
        var printSize = {
            width: 1692,
            height: 1050
        }
    } else {
        var printSize = {
            width: 1200,
            height: 1692
        }
    }
    var wide = Math.ceil(bbox.width / printSize.width);
    var height = Math.ceil(bbox.height / printSize.height);
    var segments = wide * height;


    var lx = wide * printSize.width / 2;
    var x = 0;
    var graphJson = graph.toJSON();

    var printGraph = new joint.dia.Graph();
    printGraph.fromJSON(graphJson);

    for (var j = 0; j <= height; j++) {
        for (var i = 0; i <= wide; i++) {
            var el = $('<div id="printCopy' + x + '" style="width: ' + printSize.width + 'px; height:' + printSize.height + 'px" class="print-papers"></div>').appendTo('body');

            printPapers[x] = new joint.dia.Paper({
                el: el,
                width: printSize.width,
                height: printSize.height,
                gridSize: 1,
                model: printGraph
            });

            var elementsBBox = printGraph.getBBox(printGraph.getCells());
            var originX = - elementsBBox.x - i * printSize.width;
            var originY = - elementsBBox.y - j * printSize.height;

            printPapers[x].setOrigin(originX, originY);

            var area = printPapers[x].getArea();
            var elements = printGraph.findModelsInArea(area);
            var moveX = 0;
            var moveY = 0;
            if (elements.length) {

                var movedX = {};
                var movedY = {};

                _.each(elements, function (e, index, elements) {
                    // X-coordinate translation
                    var bbox = e.getBBox();
                    if (bbox.x + bbox.width >= area.x + printSize.width) {

                        var positionX = area.x + printSize.width + 5;
                        e.position(positionX, bbox.y);
                        moveX = positionX - bbox.x;
                        var otherXElements = _.difference(
                            printGraph.getElements(),
                            elements
                        );
                        _.each(otherXElements, function (element) {

                            var elementMoveX;
                            if (!movedX[element.id]) {
                                elementMoveX = moveX;
                            } else {
                                elementMoveX = moveX - movedX[element.id];
                            }

                            var elBbox = element.getBBox();
                            if (elementMoveX > 0 && elBbox.x > bbox.x) {
                                movedX[element.id] = moveX;
                                element.translate(elementMoveX, 0);
                            }
                        });
                    }

                    // Y-coordinate translation
                    if (bbox.y + bbox.height >= area.y + printSize.height) {

                        var positionY = area.y + printSize.height + 5;
                        e.position(bbox.x, positionY);
                        moveY = positionY - bbox.y;
                        var otherYElements = _.difference(
                            printGraph.getElements(),
                            elements
                        );
                        _.each(otherYElements, function (element) {
                            var elementMoveY;
                            if (!movedY[element.id]) {
                                elementMoveY = moveY;
                            } else {
                                elementMoveY = moveY - movedY[element.id];
                            }
                            var elBbox = element.getBBox();
                            if (elementMoveY > 0 && elBbox.y > bbox.y) {
                                movedY[element.id] = moveY;
                                element.translate(0, elementMoveY);
                            }
                        });
                    }
                });
            } else {
                el.remove();
            }

            x++;
        }

        _.each(printPapers, function(printPaper) {
            V(printPaper.svg).attr({ width: '100%', height: '100%' });
            _.each(printGraph.getCells(), printPaper.renderView, printPaper);
        });

        $('#paper').hide();
        $('#printPortrait').hide();
        $('#printLandscape').hide();
    }
};

var subtrees = {};
var uptrees = {};
