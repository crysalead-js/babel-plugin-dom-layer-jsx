var camelize = require('camel-case');

module.exports = function (babel) {
  var t = babel.types;

  function buildElementCall(path, state) {
    path.parent.children = t.react.buildChildren(path.parent);

    var args = [];
    var tagName = parseTagName(path.node.name);

    if (t.isJSXIdentifier(path.node.name) && !/^[A-Z]/.test(tagName)) {
      args.push(t.stringLiteral(tagName));
    } else {
      args.push(toMemberExpression(tagName));
    }

    var attributes = path.node.attributes;
    var attrs = attributes.length ? buildAttributes(attributes, state) : t.objectExpression([]);
    args.push(attrs);

    var h = state.opts.pragma || 'h';

    return t.callExpression(toMemberExpression(h), args);
  }

  function parseTagName(node) {
    if (t.isJSXMemberExpression(node)) {
      if (t.isJSXMemberExpression(node.object)) {
        return parseTagName(node.object) + '.' + node.property.name;
      } else {
        return node.object.name + '.' + node.property.name;
      }
    }
    return node.name;
  }

  function toMemberExpression(expr) {
    return expr.split('.').map(function (name) {
      return t.identifier(name);
    }).reduce(function (object, property) {
      return t.memberExpression(object, property);
    });
  }

  /**
   * The logic for this is quite terse. It's because we need to
   * support spread elements. We loop over all attributes,
   * breaking on spreads, we then push a new object containg
   * all prior attributes to an array for later processing.
   */
  function buildAttributes(attrs, state) {
    var _props = [];
    var objs = [];

    function pushProps() {
      if (!_props.length) return;

      objs.push(t.objectExpression(_props));
      _props = [];
    }

    while (attrs.length) {
      var prop = attrs.shift();
      if (t.isJSXSpreadAttribute(prop)) {
        pushProps();
        objs.push(prop.argument);
      } else {
        _props.push(convertAttribute(prop));
      }
    }

    pushProps();

    if (objs.length === 1) {
      attrs = objs[0];
    } else {
      if (!t.isObjectExpression(objs[0])) {
        objs.unshift(t.objectExpression([]));
      }
      attrs = t.callExpression(
        state.addHelper('extends'),
        objs
      );
    }

    return _buildAttributes(attrs);
  }

  function _buildAttributes(attributes) {
    var result = [];
    var attrsPairs = [];
    var attrsNSPairs = [];
    var eventsPairs = [];
    var dataPairs = [];

    attributes.properties.forEach(function(attr) {
      var name = attr.key.name || attr.key.value;
      if (name === 'xmlns') {
        attrsPairs.push(t.objectProperty(t.identifier('xmlns'), attr.value));
      } else if (name.substr(0, 6) === 'xmlns:') {
        name = name.substr(6);
        attrsNSPairs.push(t.objectProperty(t.stringLiteral(camelize(name)), attr.value));
      } else if (name.substr(0, 3) === 'on-') {
        name = 'on' + name.substr(3);
        eventsPairs.push(t.objectProperty(t.stringLiteral(name), attr.value));
      } else if (name.substr(0, 5) === 'data-') {
        name = name.substr(5);
        dataPairs.push(t.objectProperty(t.stringLiteral(camelize(name)), attr.value));
      } else {
        attrsPairs.push(t.objectProperty(t.stringLiteral(camelize(name)), attr.value));
      }
    });

    if (attrsPairs.length) {
      result.push(t.objectProperty(t.identifier('attrs'), t.objectExpression(attrsPairs)));
    }
    if (attrsNSPairs.length) {
      result.push(t.objectProperty(t.identifier('attrsNS'), t.objectExpression(attrsNSPairs)));
    }
    if (eventsPairs.length) {
      result.push(t.objectProperty(t.identifier('events'), t.objectExpression(eventsPairs)));
    }
    if (dataPairs.length) {
      result.push(t.objectProperty(t.identifier('data'), t.objectExpression(dataPairs)));
    }
    return t.objectExpression(result);
  }

  function convertAttribute(node) {
    var value = convertAttributeValue(node.value || t.booleanLiteral(true));

    if (t.isStringLiteral(value) && !t.isJSXExpressionContainer(node.value)) {
      value.value = value.value.replace(/\n\s+/g, ' ');
    }
    if (t.isJSXNamespacedName(node.name)) {
      node.name = t.stringLiteral(node.name.namespace.name + ':' + node.name.name.name);
    } else if (t.isValidIdentifier(node.name.name)) {
      node.name.type = 'Identifier';
    } else {
      node.name = t.stringLiteral(node.name.name);
    }
    return t.inherits(t.objectProperty(node.name, value), node);
  }

  function convertAttributeValue(node) {
    if (t.isJSXExpressionContainer(node)) {
      return node.expression;
    } else {
      return node;
    }
  }

  var visitor = {
    JSXElement: {
      exit: function(path, state) {
        var expr = buildElementCall(path.get('openingElement'), state);

        var children = t.arrayExpression();
        children.elements = path.node.children;
        expr.arguments = expr.arguments.concat(children, t.identifier('s'));

        if (!t.isJSXElement(path.parent)) {
          var fct = t.functionExpression(
            null,
            [
              t.identifier('s')
            ],
            t.blockStatement(
              [
                t.returnStatement(
                  expr
                )
              ]
            )
          );
          expr = t.callExpression(
            t.memberExpression(
              fct,
              t.identifier('call')
            ),
            [
              t.identifier('this'),
              t.identifier('this')
            ]
          );
        }

        path.replaceWith(t.inherits(expr, path.node));
      }
    }
    // ,
    // JSXExpressionContainer: {
    //   exit: function(path) {
    //     if (
    //       t.isJSXElement(path.node.expression) ||
    //       t.isJSXEmptyExpression(path.node.expression)
    //     ) {
    //       return;
    //     }
    //     var fct = t.functionExpression(
    //       null,
    //       [],
    //       t.blockStatement(
    //         [
    //           t.tryStatement(
    //             t.blockStatement(
    //               [
    //                 t.returnStatement(
    //                   path.node.expression
    //                 )
    //               ]),
    //             null,
    //             t.blockStatement([])
    //           )
    //         ]
    //       )
    //     );

    //     var jsxExpr = t.jSXExpressionContainer(
    //       t.callExpression(
    //         t.memberExpression(
    //           fct,
    //           t.identifier('call')
    //         ),
    //         [
    //           t.identifier('this')
    //         ]
    //       )
    //     );
    //     path.node.expression = jsxExpr.expression;
    //   }
    // }
  };

  return {
    inherits: require('jsx-control-statements'),
    visitor: visitor
  };
};
