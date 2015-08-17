import get from 'lodash/object/get'
import find from 'lodash/collection/find'

const searchLimit = 1000

function unprefix(key, prefix) {
  return key.slice(prefix.length)
}

function search(db, prefix, params, readOption) {
  var query = params[0]
  if (Array.isArray(query[0])) {
    query = query[0]
  }
  var queryProp = query[0]
  var queryOperand = query[2]
  return new Promise((resolve, reject) => {
    var result = []
    db.createValueStream({
      gte: prefix,
      lte: prefix+'\uffff',
      limit: searchLimit,
    })
      .on('data', function(value) {
          if (get(value, queryProp) === queryOperand) {
            result.push(readOption ? value : get(value, 'id'))
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
      console.warn("localRequest not implemented", method, params)
      return Promise.reject("Not implemented")
  }
}

function modelRequest(db, path, params) {
  var method = path.pop()
  var modelId = path.join('.')
  var prefix = 'models/'+modelId+'/'
  switch (method) {
    case 'fields_view_get':
      var viewId = params[0] || params[1]
      return db.get(prefix+'views/'+viewId)
      break;
    case 'search':
      return search(db, prefix+'items/', params)
      break;
    case 'search_read':
      return search(db, prefix+'items/', params, true)
      break;
    case 'read':
      return read(db, prefix+'items/', params)
      break;
    default:
      console.warn("localRequest not implemented", path, params)
      return Promise.reject("Not implemented: "+method)
  }
}

function irModelRequest(db, method, params) {
  switch (method) {
    case 'search':
      // ne fait pas un vrai search mais supporte uniquement le cas où on cherche le dbId à partir de l'id
      var modelId = params[0][0][2]
      var path = 'models/'+modelId+'/modelDef'
      return db.get(path).then(modelDef => [modelDef.id])
      break;
    default:
      console.warn("irModelRequest not implemented", method, params)
      return Promise.reject("Not implemented")
  }
}

function irModelFieldRequest(db, method, params) {
  switch (method) {
    case 'search_read':
      var modelId = params[0][0][2]
      var fieldName = 'geom'
      return db.get('models/'+modelId+'/modelDef').then(modelDef =>
        [find(modelDef.fields, {name: fieldName})]
      )
      break;
    default:
      console.warn("irModelRequest not implemented", method, params)
      return Promise.reject("Not implemented")
  }
}

function attachmentRequest(db, method, params) {
  switch (method) {
    case 'search_read':
      // ne supporte que la récupération du qgsFile
      var modelDbId = params[0][0][2].split(',')[1]
      return db.get('models/dbIds/'+modelDbId).then(modelId =>
        db.get('models/'+modelId+'/qgsFile')
      ).then(qgsFile => [{
          name: 'qgsFileFakeName.qgs',
          data: {
            base64: qgsFile,
          },
      }])
      break;
    default:
      console.warn("attachmentRequest not implemented", method, params)
      return Promise.reject("Not implemented")
  }
}


function actionRequest(db, method, params) {
  switch (method) {
    case 'get_keyword':
      var menuItemId = params[1][1]
      return read(db, 'menuItemActions/', [[menuItemId]])
      break;
    default:
      console.warn("localRequest not implemented", method, params)
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
    case 'model':
      return irModelRequest(db, method, params)
    case 'model.field':
      return irModelFieldRequest(db, method, params)
    case 'attachment':
      return attachmentRequest(db, method, params)
    default:
      console.warn("localRequest not implemented", path, method, params)
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
