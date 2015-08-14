import getQgsFile from './getQgsFile'
import getMenuChildren from './getMenuChildren'

const searchLimit = 100

function first (array) {
  return array.length ? array[0] : null
}

function get (prop) {
  return function (obj) {
    return obj && obj[prop]
  }
}


// helpers sublevel
function sublevel(db, prefix) {
  return {db: db, prefix: prefix+'/'}
}
function put(db, key, value) {
  return db.put ? db.put(key, value) : put(db.db, db.prefix+key, value)
}
function del(db, key) {
  return db.del ? db.del(key) : del(db.db, db.prefix+key)
}
function batch(db, ops) {
  return db.batch ? db.batch(ops) : batch(db.db, ops.map(op => {
    op.key = db.prefix+op.key
    return op
  }))
}

// remplace le contenu de la db par les items
function storeItems (db, items) {
    return batch(db, items.map(item => {
      return {type: 'put', key: item.id, value: item}
    }))
}

function getActionFromMenuItem (request, menuItemId) {
  return request({
		"method": "model.ir.action.keyword.get_keyword",
		"params": [
			"tree_open",
			["ir.ui.menu", menuItemId],
		],
	}).then(first).then(action =>
    action && action.type === "ir.action.act_window" ? action : null
  )
}

function loadGeoItems(request, db, modelId) {
  console.log('fake loading of geo items for model '+modelId)
  return Promise.resolve(true)
}

function loadNonGeoItems (request, db, modelId) {
  return request({method: 'model.'+modelId+'.search_read', params: [
    [], // all items
    0,
    searchLimit, // limit
    null,
    [], // all fields
  ]}).then(items => storeItems(db, items))
}

function getViewDef(request, modelId, viewId) {
  return request({method: 'model.'+modelId+'.fields_view_get', params: [
    viewId,
    null,
  ]})
}


function loadViews(request, db, modelId) {
  return request({method: 'model.ir.ui.view.search', params: [
    [["model", "=", modelId]],
		0,
		searchLimit,
		null,
		[],
  ]}).then(viewIds =>
    Promise.all(viewIds.map(viewId =>
      getViewDef(request, modelId, viewId)
    )).then(viewDefs => viewDefs.map(viewDef => {
      viewDef.id = viewDef['view_id']
      return viewDef
    })).then(viewDefs => storeItems(db, viewDefs))
  )
}

function loadModelDefaultValue(request, db, modelId, props) {
  request({method: 'model.'+modelId+'.default_get', params: [
			props,
		]}).then(defaultValue => put(db, 'defaultValue', defaultValue))
}

function getModelDef(request, modelId) {
  return request({method: 'model.ir.model.search_read', params: [
    [["model", "=", modelId]],
		0,
		1,
		null,
		[],
  ]}).then(first).then(modelDef => {
    return getModelFields(request, modelDef.id).then(fields => {
      modelDef.fields = fields
      return modelDef
    })
  })
}

function getModelFields(request, modelDbId) {
  return request({method: 'model.ir.model.field.search_read', params: [
    [["model", "=", modelDbId]],
		0,
		searchLimit,
		null,
		[],
  ]})
}

function loadModel (request, modelsDb, modelId) {
  var db = sublevel(modelsDb, modelId)
  return Promise.all([
    loadViews(request, sublevel(db, 'views'), modelId),
    getModelDef(request, modelId).then(modelDef => Promise.all([
      put(db, 'modelDef', modelDef),
      loadModelDefaultValue(request, db, modelId, modelDef.fields.map(get('name'))),
    ])),
    getQgsFile(request, modelId).then(qgsFile => {
      if (qgsFile) {
        return Promise.all([
          put(db, 'qgsFile', qgsFile),
          loadGeoItems(request, sublevel(db, 'items'), modelId),
        ])
      } else {
        return Promise.all([
          del(db, 'qgsFile'), // be sure to remove existing file if any
          loadNonGeoItems(request, sublevel(db, 'items'), modelId),
        ])
      }
    }),
  ])
}


function loadMenuItemAction(request, db, menuItemId) {
  return getActionFromMenuItem(request, menuItemId).then(action => {
    if (action) {
      var modelId = action['res_model']
      return Promise.all([
        put(db, 'menuItemActions/'+menuItemId, action),
        loadModel(request, sublevel(db, 'models'), modelId),
      ])
    } else {
      return Promise.resolve(true)
    }
  })
}

function getMenuItemValue (request, menuItemId) {
  return request({"method": "model.ir.ui.menu.read", "params": [
    [menuItemId],
    ["childs", "name", "parent", "favorite", "active", "icon", "parent.rec_name", "rec_name"],
  ]}).then(res => res[0])
}

function loadMenuItemValue(request, db, menuItemId) {
  return getMenuItemValue(request, menuItemId).then(menuItemValue =>
    put(db, menuItemId, menuItemValue)
  )
}

function loadMenuItem(request, db, menuItemId) {
  return Promise.all([
    loadMenuItemValue(request, sublevel(db, 'menuItemValues'), menuItemId),
    loadMenuItemAction(request, db, menuItemId),
  ])
}


function loadMenuTree(request, db, menuItemId) {
  return Promise.all([
    loadMenuItem(request, db, menuItemId),
    getMenuChildren(request, menuItemId).then(menuItems => {
      return Promise.all(menuItems.map(menuItem => loadMenuTree(request, db, menuItem)))
    }),
  ])
}

export default loadMenuTree
