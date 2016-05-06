var domLayer = require('dom-layer');
var Tag = domLayer.Tag;
var Text = domLayer.Text;

function h(tagName, attrs, children) {
  var attrs = attrs || {};
  var tagName = (tagName || "div").toLowerCase();
  return new Tag(tagName, attrs, children ? h.flatten(children) : children);
}

h.map = function(obj, fn, ctx) {
  if (typeof fn !== 'function') {
    throw new TypeError('iterator must be a function');
  }
  if (!obj) {
    return [];
  }
  var result = [];
  var l = obj.length;
  if (l === +l) {
    for (var i = 0; i < l; i++) {
      result.push(fn.call(ctx, obj[i], i, obj));
    }
  } else {
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        result.push(fn.call(ctx, obj[k], k, obj));
      }
    }
  }
  return result;
};

h.flatten = function (input) {
  var output = [];
  var idx = 0;
  var node;
  var lastTextNode = null;

  function autoBoxString(value) {
    if (typeof value !== 'object') {
      if (lastTextNode) {
        lastTextNode.data = lastTextNode.data + String(value);
        return;
      }
      value = new Text(String(value));
      lastTextNode = value;
    } else if (value) {
      lastTextNode = null;
    }
    return value;
  }

  for (var i = 0, length = input.length; i < length; i++) {
    var value = input[i];
    if (Array.isArray(value)) {
      var j = 0;
      var len = value.length;
      while (j < len) {
        node = autoBoxString(value[j++]);
        if (node) {
          output[idx++] = node;
        }
      }
    } else {
      node = autoBoxString(value);
      if (node) {
        output[idx++] = node;
      }
    }
  }
  return output;
};

module.exports = h;