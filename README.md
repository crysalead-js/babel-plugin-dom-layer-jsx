# babel-plugin-dom-layer-jsx

[![Build Status](https://travis-ci.org/crysalead-js/babel-plugin-dom-layer-jsx.svg?branch=master)](https://travis-ci.org/crysalead-js/babel-plugin-dom-layer-jsx)

This plugin transforms JSX code in your projects to a tree of dom-layer virtual nodes. It also allows control statements (i.e. <if>, <for> and <choose>) out of the box.

*Note! This plugin has been built for use in Babel 6.x environments.*

## Install

### Node.js

```
npm install dom-layer --save
```

And configure your `.babelrc` file like the following:

```
{
  "presets": [ "es2015", "stage-0" ],
  "plugins": ["syntax-jsx", "dom-layer-jsx"]
}
```

## Syntax of Control Statements

### if

```javascript
<if condition={ true }>
  <span>IfBlock</span>
</if>
```

### for

```javascript
<for each="item" index="key" of={ items }>
  <span key={ item.id }>{ item.title } with key { key }</span>
</for>
```

### choose

```javascript
<choose>
  <when condition={ test1 }>
    <span>IfBlock</span>
  </when>
  <when condition={ test2 }>
    <span>ElseIfBlock</span>
  </when>
  <otherwise>
    <span>ElseBlock</span>
  </otherwise>
</choose>
```

## Acknowledgements

- [jsx-control-statements](https://github.com/AlexGilleran/jsx-control-statements)
