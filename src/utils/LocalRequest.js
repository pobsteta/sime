import assign from 'lodash/object/assign'
import get from 'lodash/object/get'
import find from 'lodash/collection/find'
import pick from 'lodash/object/pick'


function searchItems(db, prefix, params, readValue) {
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
      limit: params[2],
    })
      .on('data', function(value) {
          if (get(value, queryProp) === queryOperand) {
            result.push(readValue ? value : get(value, 'id'))
          }
      })
      .on('error', reject)
      .on('end', function () {
        resolve(result)
      })
  })
}

function readItems(db, prefix, params) {
  return Promise.all(params[0].map(id => db.get(prefix+id)))
}

function writeItems(db, prefix, params) {
  // pour l'instant ça n'écrit qu'un seul item
  var itemId = params[0][0]
  return db.get(prefix+itemId).then(itemValue =>
    db.put(prefix+itemId, assign(itemValue, params[1]))
  )
}

function deleteItems(db, prefix, params) {
  // pour l'instant ça ne supprime qu'un seul item
  var itemId = params[0][0]
  return db.del(prefix+itemId)
}

function createItems(db, prefix, params) {
  // pour l'instant ça ne crée qu'un seul item
  var itemValue = params[0][0]
  var itemId = itemValue.id = new Date().toISOString()
  return db.put(prefix+itemId, itemValue)
    .then(() => [itemId])
}


function menuRequest(db, method, params) {
  var prefix = 'menuItemValues/'
  switch (method) {
    case 'search':
      return searchItems(db, prefix, params)
      break;
    case 'search_read':
      return searchItems(db, prefix, params, true)
      break;
    case 'read':
      return readItems(db, prefix, params)
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
    case 'default_get':
      return db.get(prefix+'defaultValue').then(defaultValue => pick(defaultValue, params[0]))
    case 'search':
      return searchItems(db, prefix+'items/', params)
      break;
    case 'search_read':
      return searchItems(db, prefix+'items/', params, true)
      break;
    case 'read':
      return readItems(db, prefix+'items/', params)
      break;
    case 'write':
      return writeItems(db, prefix+'items/', params)
      break;
    case 'delete':
      return deleteItems(db, prefix+'items/', params)
      break;
    case 'create':
      return createItems(db, prefix+'items/', params)
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
    // ajout d'une photo à un élément
    case 'create':
      var attachment = params[0][0]
      var [modelId, itemId] = attachment.resource.split(',')
      return db.put('models/'+modelId+'/itemAttachments/'+itemId+'/'+attachment.name, attachment)
    default:
      console.warn("attachmentRequest not implemented", method, params)
      return Promise.reject("Not implemented")
  }
}


function actionRequest(db, method, params) {
  switch (method) {
    case 'get_keyword':
      var menuItemId = params[1][1]
      return readItems(db, 'menuItemActions/', [[menuItemId]])
      break;
    default:
      console.warn("localRequest not implemented", method, params)
      return Promise.reject("Not implemented")
  }
}

function iconRequest(db, method, params) {
  switch (method) {
    case 'search_read':
      var iconName = params[0][0][2]
      return db.get('icons/'+iconName).then((icon) => [{icon: icon}])
      break;
    default:
      console.warn("iconRequest not implemented", method, params)
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
    case 'ui.icon':
      return iconRequest(db, method, params)
    default:
      console.warn("localRequest not implemented", path, method, params)
      return Promise.reject("Not implemented")
  }
}


function saveRequest(db, method, request) {
  if (method === 'write' || method === 'delete' || method === 'create') {
    return db.put('_requests/'+new Date().toISOString()+'/request', {
      type: 'rpc',
      request: request,
    })
  } else {
    return Promise.resolve(true)
  }
}

export default function (db) {
  return function localRequest (args) {
    var path = args.method.split('.').slice(1)
    var method = path[path.length-1]
    var params = args.params

    var requestResult
    switch (path[0]) {
      case 'ir':
        requestResult = irRequest(db, path.slice(1), params)
        break;
      default:
        requestResult = modelRequest(db, path, params)
    }
    return Promise.all([
      requestResult,
      saveRequest(db, method, args),
    ]).then(resp => resp[0])
  }
}
