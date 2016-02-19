/*! Rappid v1.7.0 - HTML 5 Dagramming Framework

Copyright (c) 2015 client IO

 2015-12-22


This Source Code Form is subject to the terms of the Rappid License
, v. 2.0. If a copy of the Rappid License was not distributed with this
file, You can obtain one at http://jointjs.com/license/rappid_v2.txt
 or from the Rappid archive as was distributed by client IO. See the LICENSE file.*/


//      JointJS library.
//      (c) 2011-2013 client IO

joint.shapes.orgChart = {};

joint.shapes.orgChart.Node = joint.dia.Element.extend({

    markup: '<g class="rotatable"><g class="scalable"><rect class="card"/></g><text class="name"/><path class="expand"/></g>',

    defaults: joint.util.deepSupplement({

        type: 'orgChart.Node',
        size: { width: 260, height: 90 },
        attrs: {

            rect: { width: 260, height: 90,  'stroke': '#000000', 'stroke-width': 1},//filter: { name: 'dropShadow', args: { x: 5, dx: 5, dy: 5, blur: 3 } } },

            '.card': {
                fill: '#FFFFFF', stroke: '#000000', 'stroke-width': 1,
                'pointer-events': 'visiblePainted', rx: 10, ry: 10
            },

            '.name': {
                'font-weight': '800',
                'font-family': 'Courier New', 'font-size': 14,
                'text-anchor': 'middle',
                ref: '.card', 'ref-x': .5, 'ref-y': 10,
            },
            '.expand': {
                ref: '.card',
                'ref-dx': -25,
                'ref-y': 10,
                'fill': '#ffffff',
                'stroke': '#000000',
                'stroke-width': 1,
                'd': 'M 10 0 10 20 M 0 10 20 10'
            }
        }
    }, joint.dia.Element.prototype.defaults),


});

joint.shapes.orgChart.Table = joint.dia.Element.extend({

    markup: '<g class="rotatable"><g class="scalable"><rect class="card"/><image/></g><text class="rank"/><text class="name"/></g>',

    defaults: joint.util.deepSupplement({

        type: 'orgChart.Table',
        size: { width: 180, height: 70 },
        attrs: {

            '.': {'pointer-events': 'none'},

            rect: { width: 170, height: 60 },

            '.card': {
                fill: '#FFFFFF', stroke: '#000000', 'stroke-width': 2,
                rx: 10, ry: 10
            },

            image: {
                width: 48, height: 48,
                ref: '.card', 'ref-x': 10, 'ref-y': 5
            },

            '.rank': {
                'text-decoration': 'underline',
                ref: '.card', 'ref-x': 0.9, 'ref-y': 0.2,
                'font-family': 'Courier New', 'font-size': 14,
                'text-anchor': 'end'
            },

            '.name': {
                'font-weight': '800',
                ref: '.card', 'ref-x': 0.9, 'ref-y': 0.6,
                'font-family': 'Courier New', 'font-size': 14,
                'text-anchor': 'end'
            }
        }
    }, joint.dia.Element.prototype.defaults)
});

joint.shapes.orgChart.Connection = joint.dia.Link.extend({
    markup: [
        '<path class="connection" stroke="black" d="M 0 0 0 0"/>',
        '<g class="labels"/>'
    ].join(''),

    defaults: {
        type: 'orgChart.Connection',
        source: { selector: '.card' }, target: { selector: '.card' },
        attrs: {
            '.connection': { stroke: '#585858', 'stroke-width': 3 },
            '.': {'pointer-events': 'none'}
        },
        z: 1
    }
});
