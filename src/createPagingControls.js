var MappedValue = require('ksf/observable/MappedValue')
var CompositeValue = require('ksf/observable/CompositeValue')
var ValueFromPromise = require('ksf/observable/ValueFromPromise')
var Reactive = require('absolute/Reactive')
var Promised = require('absolute/Promised')
var IconButton = require('./IconButton');
var Label = require('absolute/Label');

import {
	next as iconNext,
	previous as iconPrevious
} from './icons/index'

export default function Pager(args) {
  var fromItem = args.fromItem
  var itemsCount = args.request({method: 'model.'+args.modelId+'.search_count', params: [args.query]})
  var fromItemAndItemsCount = new CompositeValue({
    fromItem: fromItem,
    itemsCount: new ValueFromPromise(itemsCount),
  })
  var pageSize = args.pageSize
  return [
    new Reactive({
      value: new MappedValue(fromItem, not),
      content: new IconButton().icon(iconPrevious).title("Page précédente").disabled(args.fromItem === 0).onAction(() => {
          changeValue(fromItem, add(-pageSize))
        }).height(args.defaultButtonSize),
      prop: 'disabled',
    }),
    new Reactive({
      content: new Label().hAlign('center'),
      value: new MappedValue(fromItem, seq(add(1), toString)),
    }).height(args.defaultButtonSize/3),
    new Label().value("à").hAlign('center').height(args.defaultButtonSize/3),
    new Reactive({
      content: new Label().hAlign('center'),
      value: new MappedValue(fromItemAndItemsCount, seq(call2(min,
        seq(get('fromItem'), add(pageSize)),
        get('itemsCount')
      ), ifNotNull(toString))),
    }).height(args.defaultButtonSize/3),
    new Label().value("sur").hAlign('center').height(args.defaultButtonSize/3),
    new Promised({
      content: new Label().hAlign('center').height(args.defaultButtonSize/3),
      value: itemsCount.then(toString),
    }),
    new Reactive({
      value: new MappedValue(fromItemAndItemsCount, call2(gte,
        seq(get('fromItem'), add(pageSize)),
        get('itemsCount')
      )),
      content: new IconButton().icon(iconNext).title("Page suivante").onAction(() => {
        changeValue(fromItem, add(pageSize))
      }).height(args.defaultButtonSize),
      prop: 'disabled',
    }),
  ]
}

function toString(argument) {
	return argument.toString()
}
function not (argument) {
	return !argument
}
function gte(a, b) {
	return a >= b
}
function min(a, b) {
	return a < b ? a : b
}


function add(qty) {
	return (val) => val + qty
}
function get(prop) {
	return (obj) => obj[prop]
}
function seq() {
	var fns = Array.prototype.slice.call(arguments)
	return (startVal) => fns.reduce((val, fn) => fn(val), startVal)
}
function call2(fn, fn1, fn2) {
	return (val) => fn(fn1(val), fn2(val))
}
function ifNotNull(fn) {
	return (val) => val !== null ? fn(val) : null
}

function changeValue(observable, fn) {
	observable.value(fn(observable.value()))
}
