var camelize = require('camel-case');
var errorUtil = require('./util/error');
var transformFor = require('./statement/for');
var transformIf = require('./statement/if');
var transformChoose = require('./statement/choose');

module.exports = function (babel) {
  var t = babel.types;

  var statementHandlers = {
    'for': transformFor(babel),
    'if': transformIf(babel),
    'choose': transformChoose(babel)
  };

  var isStatement = {
    'for': true,
    'if': true,
    'choose': true,
    'when': true,
    'otherwise': true
  };

  function buildElementCall(path, state) {
    path.parent.children = t.react.buildChildren(path.parent);

    var args = [];
    var tagName = convertJSXIdentifier(path.node.name, path.node);

    args.push(t.stringLiteral(tagName));

    var attributes = path.node.attributes;
    var attrs = attributes.length ? buildAttributes(attributes, state) : t.objectExpression([]);
    args.push(attrs);

    return t.callExpression(toMemberExpression('h'), args);
  }

  function convertJSXIdentifier(node) {
    if (t.isJSXIdentifier(node)) {
      return node.name;
    } else if (t.isJSXMemberExpression(node)) {
      if (t.isJSXMemberExpression(node.object)) {
        return convertJSXIdentifier(node.object) + '.' + node.property.name;
      } else {
        return node.object.name + '.' + node.property.name;
      }
    }
    return node;
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

    return formatAttributes(attrs);
  }

  function formatAttributes(attributes) {
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
        var nodeName = path.node.openingElement.name.name;
        var handler = statementHandlers[nodeName];

        if (handler) {
          if (!t.isJSXElement(path.parent)) {
            errorUtil.throwMissingRootNode({ node: path.node, file: state.file, element: nodeName });
          }
          path.replaceWith(t.inherits(handler(path.node, state), path.node));
          return;
        }
        if (isStatement[nodeName]) {
          return;
        }
        var expr = buildElementCall(path.get('openingElement'), state);

        if (path.node.children.length) {
          var children = t.arrayExpression();
          children.elements = path.node.children;
          expr.arguments = expr.arguments.concat(children);
        }

        if (expr.arguments.length >= 3) {
          expr._prettyCall = true;
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
    inherits: require('babel-plugin-syntax-jsx'),
    visitor: visitor
  };
};
