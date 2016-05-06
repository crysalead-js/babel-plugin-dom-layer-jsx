var astUtil = require('../util/ast');
var errorUtil = require('../util/error');

var ELEMENTS = {
  FOR: 'for'
};

var ATTRIBUTES = {
  EACH: 'each',
  OF: 'of',
  INDEX: 'index'
};

function addMapParam(types, params, attribute) {
  if (attribute && attribute.value) {
    params.push(types.Identifier(attribute.value.value));
  }
}

function checkForString(attributes, name, errorInfos) {
  if (attributes[name] && !astUtil.isStringLiteral(attributes[name])) {
    errorUtil.throwNotStringType(name, errorInfos);
  }
}

function checkForExpression(attributes, name, errorInfos) {
  if (attributes[name] && !astUtil.isExpressionContainer(attributes[name])) {
    errorUtil.throwNotExpressionType(name, errorInfos);
  }
}

function toMemberExpression(expr, types) {
  return expr.split('.').map(function (name) {
    return types.identifier(name);
  }).reduce(function (object, property) {
    return types.memberExpression(object, property);
  });
}

module.exports = function(babel) {
  var types = babel.types;

  return function(node, state) {
    var mapParams = [];
    var errorInfos = { node: node, file: state.file, element: ELEMENTS.FOR };
    var attributes = astUtil.getAttributeMap(node);
    var children = astUtil.getChildren(types, node);
    var returnExpression = astUtil.getSanitizedExpressionForContent(types, children);

    // required attribute
    if (!attributes[ATTRIBUTES.OF]) {
      errorUtil.throwNoAttribute(ATTRIBUTES.OF, errorInfos);
    }
    // check for correct data types, as far as possible
    checkForExpression(attributes, ATTRIBUTES.OF, errorInfos);
    checkForString(attributes, ATTRIBUTES.EACH, errorInfos);
    checkForString(attributes, ATTRIBUTES.INDEX, errorInfos);

    // simply return without any child nodes
    if (!children.length) {
      return returnExpression;
    }

    addMapParam(types, mapParams, attributes[ATTRIBUTES.EACH]);
    addMapParam(types, mapParams, attributes[ATTRIBUTES.INDEX]);

    var each = types.callExpression(
      toMemberExpression('h.map', types),
      [
        attributes[ATTRIBUTES.OF].value.expression,
        types.functionExpression(
          null,
          mapParams,
          types.blockStatement([
            types.returnStatement(returnExpression)
          ])
        ),
        types.identifier('this')
      ]
    )
    return types.callExpression(toMemberExpression('h.flatten', types), [each]);
  }
};
