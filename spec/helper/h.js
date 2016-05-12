var flatten = require('arr-flatten');
var domLayer = require('dom-layer');
var Tag = domLayer.Tag;
var Text = domLayer.Text;

function h(tagName, attrs, children) {
  var attrs = attrs || {};
  var tagName = tagName || "div";
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