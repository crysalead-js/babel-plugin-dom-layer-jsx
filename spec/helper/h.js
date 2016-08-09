var flatten = require('arr-flatten');
var domLayer = require('dom-layer');
var camelize = require('camel-case');
var Tag = domLayer.Tag;
var Text = domLayer.Text;

function h(tagName, attrs, children) {
  var attrs = attrs || {};
  var tagName = tagName || "div";
  if (attrs.spreads) {
    var spreads = attrs.spreads;
    attrs.attrs = attrs.attrs || {};
    for (var name in spreads) {
      if (name === 'xmlns') {
        attrs.attrs['xmlns'] = spreads[name];
      } else if (name.substr(0, 6) === 'xmlns:') {
        name = name.substr(6);
        if (!attrs.attrsNS) {
          attrs.attrsNS = {};
        }
        attrs.attrsNS[camelize(name)] = spreads[name];
      } else if (name.substr(0, 3) === 'on-') {
        if (!attrs.events) {
          attrs.events = {};
        }
        name = 'on' + name.substr(3);
        attrs.events[name] = spreads[name];
      } else if (name.substr(0, 5) === 'data-') {
        if (!attrs.data) {
          attrs.data = {};
        }
        name = name.substr(5);
        attrs.data[camelize(name)] = spreads[name];
      } else {
        attrs.attrs[camelize(name)] = spreads[name];
      }
    }
  }
  if (children) {
    children = flatten(children);
    for(var i = 0, len = children.length; i < len; i++) {
      if (children[i] != null && !children[i].type) {
        children[i] = new Text(children[i]);
      }
    }
  }
  return new Tag(tagName, attrs, children);
}

module.exports = h;