import get from 'lodash/object/get'

const searchLimit = 1000

function unprefix(key, prefix) {
  return key.slice(prefix.length)
}

function search(db, prefix, params) {
  var query = params[0]
  if (Array.isArray(query[0])) {
    query = query[0]
  }
  var queryProp = query[0]
  var queryOperand = query[2]
  return new Promise((resolve, reject) => {
    var result = []
    db.createReadStream({
      gte: prefix,
      lte: prefix+'\uffff',
      limit: searchLimit,
    })
      .on('data', function(pair) {
          if (get(pair.value, queryProp) === queryOperand) {
            result.push(parseInt(unprefix(pair.key, prefix), 10))
          }
      })
      .on('error', reject)
      .on('end', function () {
        resolve(result)
      })
  })
}

function read(db, prefix, params) {
  return Promise.all(params[0].map(id => db.get(prefix+id)))
}

function menuRequest(db, method, params) {
  var prefix = 'menuItemValues/'
  switch (method) {
    case 'search':
      return search(db, prefix, params)
      break;
    case 'read':
      return read(db, prefix, params)
      break;
    default:
      return Promise.reject("Not implemented")
  }
}

function modelRequest(db, path, params) {
  var method = path.pop()
  var modelId = path.join('.')
  var prefix = 'models/'+modelId+'/'
  switch (method) {
    case 'fields_view_get':
      var viewId = params[0]
      return db.get(prefix+'views/'+viewId)
      break;
    case 'search':
      return search(db, prefix+'items/', params)
      break;
    case 'read':
      return read(db, prefix+'items/', params)
      break;
    default:
      return Promise.reject("Not implemented: "+method)
  }
}


function actionRequest(db, method, params) {
  switch (method) {
    case 'get_keyword':
      var menuItemId = params[1][1]
      return read(db, 'menuItemActions/', [[menuItemId]])
      break;
    default:
      return Promise.reject("Not implemented")
  }
}

function irRequest(db, path, params) {
  var method = path.pop()
  switch (path.join('.')) {
    case 'ui.menu':
      return menuRequest(db, method, params)
      break;
    case 'action.keyword':
      return actionRequest(db, method, params)
      break;
    default:
      return Promise.reject("Not implemented")
  }
}


export default function (db) {
  return function localRequest (args) {
    var path = args.method.split('.').slice(1)
    var params = args.params

    switch (path[0]) {
      case 'ir':
        return irRequest(db, path.slice(1), params)
        break;
      default:
        return modelRequest(db, path, params)
    }
  }
}
