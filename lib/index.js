var camelize = require('camel-case');
var transformFor = require("./forStatement");
var transformIf = require("./ifStatement");
var transformChoose = require("./chooseStatement");
var transformWith = require("./withStatement");
var jsx = require("@babel/plugin-syntax-jsx").default;

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
    var spreads = [];
    var props = [];

    while (attrs.length) {
      var prop = attrs.shift();
      if (t.isJSXSpreadAttribute(prop)) {
        spreads.push(prop.argument);
      } else {
        props.push(convertAttribute(prop));
      }
    }
    return _buildAttributes(props, spreads, state);
  }

  function _buildAttributes(props, spreads, state) {
    var result = [];
    var propsPairs = [];
    var attrsPairs = [];
    var attrsNSPairs = [];
    var eventsPairs = [];
    var dataPairs = [];
    var paramsPairs = [];

    var attributes = t.objectExpression(props);

    attributes.properties.forEach(function(attr) {
      var name = attr.key.name || attr.key.value;
      if (name === 'xmlns') {
        attrsPairs.push(t.objectProperty(t.identifier('xmlns'), attr.value));
      } else if (name.substr(0, 6) === 'xmlns:') {
        name = name.substr(6);
        attrsNSPairs.push(t.objectProperty(t.stringLiteral(camelize(name)), attr.value));
      } else if (name.substr(0, 6) === 'event:') {
        name = name.substr(6);
        eventsPairs.push(t.objectProperty(t.stringLiteral(name), attr.value));
      } else if (name.substr(0, 5) === 'data:') {
        name = name.substr(5);
        dataPairs.push(t.objectProperty(t.stringLiteral(camelize(name)), attr.value));
      } else if (name.substr(0, 5) === 'prop:') {
        name = name.substr(5);
        propsPairs.push(t.objectProperty(t.stringLiteral(camelize(name)), attr.value));
      } else if (name.substr(0, 6) === 'param:') {
        name = name.substr(6);
        paramsPairs.push(t.objectProperty(t.stringLiteral(camelize(name)), attr.value));
      } else {
        attrsPairs.push(t.objectProperty(t.stringLiteral(camelize(name)), attr.value));
      }
    });

    if (propsPairs.length) {
      result.push(t.objectProperty(t.identifier('props'), t.objectExpression(propsPairs)));
    }
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
    if (paramsPairs.length) {
      result.push(t.objectProperty(t.identifier('params'), t.objectExpression(paramsPairs)));
    }
    if (spreads.length) {
      // ES6 spread syntax
      // var expr = t.objectExpression(spreads.map(function(name) { return t.spreadProperty(name); }));
      // ES6 compatible syntax
      var expr = t.callExpression(state.addHelper('extends'), spreads);
      result.push(t.objectProperty(t.identifier('spreads'), expr));
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

  function isolateExpression(expr, scope, self) {
    var fct = t.functionExpression(
      null,
      [
        t.identifier(scope),
        t.identifier(self)
      ],
      t.blockStatement(
        [
          t.returnStatement(
            expr
          )
        ]
      )
    );
    return t.callExpression(
      t.memberExpression(
        fct,
        t.identifier('call')
      ),
      [
        t.identifier('this'),
        t.identifier('this'),
        t.identifier('this')
      ]
    );
  }

  function childrenExpression(expr, children, self) {
    var arrayExpression = t.arrayExpression();
    arrayExpression.elements = children;

    if (expr.arguments[0].type === 'StringLiteral') {
      return arrayExpression;
    }

    var fct = t.functionExpression(
      null,
      [
        t.identifier(self)
      ],
      t.blockStatement(
        [
          t.returnStatement(
            arrayExpression
          )
        ]
      )
    );
    return fct;
  }


  /*
  var visitor = {
    JSXElement: {
      exit: function(path, state) {
        var expr = buildElementCall(path.get('openingElement'), state);

        var children = t.arrayExpression();
        children.elements = path.node.children;
        expr.arguments = expr.arguments.concat(children, t.identifier('s'));

        if (!t.isJSXElement(path.parent)) {

          // if (
          //   path.parentPath &&
          //   path.parentPath.parentPath &&
          //   path.parentPath.parentPath.parent &&
          //   t.isBlockStatement(path.parentPath.parentPath.parent)
          // ) {
          //   var blockStatement = path.parentPath.parentPath.parent;
          //   blockStatement.body.unshift(t.variableDeclaration("var", [
          //     t.variableDeclarator(
          //       t.identifier('s'),
          //       t.binaryExpression("||", t.identifier("this"), t.identifier('s'))
          //     )
          //   ]));
          // }

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
              t.logicalExpression("||", t.identifier("this"), t.identifier('s')),
              t.logicalExpression("||", t.identifier("this"), t.identifier('s'))
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
  */

  /* Visitors */

  var nodeHandlers = {
    For: transformFor(babel),
    If: transformIf(babel),
    Choose: transformChoose(babel),
    With: transformWith(babel)
  };

  var replaceControlStatements = {
    JSXElement: function(path) {
      var nodeName = path.node.openingElement.name.name;
      var handler = nodeHandlers[nodeName];

      if (handler) {
        path.replaceWith(handler(path.node, path.hub.file));
      }
    }
  };

  var replaceThisBySelf = {
    JSXExpressionContainer: {
      enter: function(path, state) {
        if (
          t.isJSXElement(path.node.expression) ||
          t.isJSXEmptyExpression(path.node.expression)
        ) {
          return;
        }
        var scope = state.opts.scope || '$this';
        path.traverse({
          ThisExpression (path) {
            path.replaceWith(t.identifier(scope));
          }
        });
      }
    }
  };

  var replaceJSXtoHyperscript = {
    JSXElement: {
      enter: function(path, state) {
        if (t.isJSXElement(path.parent)) {
          return;
        }

        path.traverse({
          JSXElement: {
            enter: function(path, state) {
              var expr = buildElementCall(path.get('openingElement'), state);
              var self = state.opts.self || 'self';
              expr.arguments = expr.arguments.concat(childrenExpression(expr, path.node.children, self), t.identifier(self));
              path.replaceWith(expr);
            }
          }
        }, state);

        var expr = buildElementCall(path.get('openingElement'), state);
        var scope = state.opts.scope || '$this';
        var self = state.opts.self || 'self';
        expr.arguments = expr.arguments.concat(childrenExpression(expr, path.node.children, self), t.identifier(self));

        path.replaceWith(isolateExpression(expr, scope, self));
      }
    }
  };

  return {
    inherits: jsx,
    visitor: {
      Program: {
        enter: function(path, state) {
          path.traverse(replaceThisBySelf, state);
          path.traverse(replaceControlStatements, state);
          path.traverse(replaceJSXtoHyperscript, state);
        }
      }
    }
  };
};
