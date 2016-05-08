var domLayer = require('dom-layer');
var Tag = domLayer.Tag;
var Text = domLayer.Text;

function h(tagName, attrs, children) {
  var attrs = attrs || {};
  var tagName = tagName || "div";
  if (children) {
    children = h.flatten(children);
    for(var i = 0, len = children.length; i < len; i++) {
      if (children[i] != null && !children[i].type) {
        children[i] = new Text(children[i]);
      }
    }
  }
  return new Tag(tagName, attrs, children);
}

h.flatten = function(arr) {
  return arr.reduce(function (flat, toFlatten) {
    return flat.concat(Array.isArray(toFlatten) ? h.flatten(toFlatten) : toFlatten);
  }, []);
}

// h.flatten = function (input) {
//   var output = [];
//   var idx = 0;
//   var node;
//   var lastTextNode = null;

//   function autoBoxString(value) {
//     if (typeof value !== 'object') {
//       if (lastTextNode) {
//         lastTextNode.data = lastTextNode.data + String(value);
//         return;
//       }
//       value = new Text(String(value));
//       lastTextNode = value;
//     } else if (value) {
//       lastTextNode = null;
//     }
//     return value;
//   }

//   for (var i = 0, length = input.length; i < length; i++) {
//     var value = input[i];
//     if (Array.isArray(value)) {
//       var j = 0;
//       var len = value.length;
//       while (j < len) {
//         node = autoBoxString(value[j++]);
//         if (node) {
//           output[idx++] = node;
//         }
//       }
//     } else {
//       node = autoBoxString(value);
//       if (node) {
//         output[idx++] = node;
//       }
//     }
//   }
//   return output;
// };

module.exports = h;