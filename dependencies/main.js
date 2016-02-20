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
        })
    }
};

var layoutGraph = function (graph) {
    /*var graphLayout = new joint.layout.TreeLayout({
        graph: graph,
        gap: 50,
        siblingGap: 50,
        direction: 'B'
    });

    var nodes = _.filter(graph.getCells(), function(cell) { return !(cell instanceof joint.shapes.orgChart.Table) })

    graphLayout.layout(nodes);
    graph.resetCells(graph.getCells());*/
    var tmpGraph = new joint.dia.Graph();
    var nodes = _.filter(graph.getCells(), function(cell) { return !(cell instanceof joint.shapes.orgChart.Table) })
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
    var tables = _.filter(graph.getCells(), function(cell) { return (cell instanceof joint.shapes.orgChart.Table) });
    var columnWidth = 0;
    _.each(tables, function (table) {
        columnWidth = table.getBBox().width > columnWidth ? table.getBBox().width : columnWidth;
    });
    tmpGraph.resetCells(tables);
    joint.layout.GridLayout.layout(tmpGraph, {
        columns: 200,
        columnWidth: columnWidth + 10,
        dx: 0,
        dy: graph.getBBox(graph.getCells()).height
    });
};

var printPapers = [];
var printGraphs = [];


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
    printGraphs = [];

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

    for (var j = 0; j <= height; j++) {
        for (var i = 0; i <= wide; i++) {
            var el = $('<div id="printCopy' + x + '" style="width: ' + printSize.width + 'px; height:' + printSize.height + 'px" class="print-papers"></div>').appendTo('body');
            printGraphs[x] = new joint.dia.Graph();

            printPapers[x] = new joint.dia.Paper({
                el: el,
                width: printSize.width,
                height: printSize.height,
                gridSize: 1,
                model: printGraphs[x]
            });

            // Initiate panning when the user grabs the blank area of the paper.

            printGraphs[x].fromJSON(graphJson);

            var elementsBBox = printGraphs[x].getBBox(printGraphs[x].getCells());
            var originX = - elementsBBox.x - i * printSize.width;
            var originY = - elementsBBox.y - j * printSize.height;

            printPapers[x].setOrigin(originX, originY);

            var area = printPapers[x].getArea();
            var elements = printGraphs[x].findModelsInArea(area);
            console.log(area);
            var moveX = 0;
            var moveY = 0;
            if (elements.length) {
                _.each(elements, function (e) {
                    var bbox = e.getBBox();
                    if (bbox.x + bbox.width >= area.x + printSize.width) {
                        e.set('position', {
                            x: area.x + printSize.width + 5,
                            y: bbox.y
                        });
                        moveX = Math.abs(bbox.x - (area.x + printSize.width));
                        _.each(printGraphs[x].getElements(), function (element) {
                            var elBbox = element.getBBox();
                            if (elBbox.x > bbox.x && e.id != element.id) {
                                element.set('position', {x: elBbox.x + moveX, y: elBbox.y});
                            }
                        });
                    }
                    if (bbox.y + bbox.height > area.y + printSize.height) {
                        e.set('position', {
                            x: bbox.x,
                            y: area.y + printSize.height + 5
                        });
                        if (e.get('type') !== 'orgChart.Table') {
                            moveY = Math.abs(bbox.y - (area.y + printSize.height));
                            _.each(printGraphs[x].getElements(), function (element) {
                                var elBbox = element.getBBox();
                                if (elBbox.y > bbox.y && e.id != element.id) {
                                    element.set('position', {x: elBbox.x, y: elBbox.y + moveY});
                                }
                            });
                        }
                    }
                });
            } else {
                el.remove();
            }

            graphJson = printGraphs[x].toJSON();
            x++;
        }
        $('#paper').hide();
        $('#printPortrait').hide();
        $('#printLandscape').hide();
        _.each($('.print-papers svg'), function (el) {
            el.setAttribute('width', '100%')
            el.setAttribute('height', '100%')
        });

    }
};

var subtrees = {};
var uptrees = {};
