import getQgsFile from './getQgsFile'
import getMenuChildren from './getMenuChildren'

function first (array) {
  return array.length ? array[0] : null
}
function get (prop) {
  return function (obj) {
    return obj && obj[prop]
  }
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


// remplace le contenu de la db par les items
function storeItems (db, items) {
  //return clearDb(db).then(() => {
    return db.batch(items.map(item => {
      return {type: 'put', key: item.id, value: item}
    }))
  //})
}

function loadGeoItems(request, db, modelId) {
  console.log('fake loading of geo items for model '+modelId)
  return Promise.resolve(true)
}

function loadNonGeoItems (request, db, modelId) {
  return request({method: 'model.'+modelId+'.search_read', params: [
    [], // all items
    0,
    1000, // limit
    null,
    [], // all fields
  ]}).then(items => storeItems(db, items))
}


function loadViews(request, db, modelId) {
  return request({method: 'model.ir.ui.view.search_read', params: [
    [["model", "=", modelId]],
		0,
		100,
		null,
		[],
  ]}).then(views => storeItems(db, views))
}

function loadModelDefaultValue(request, db, modelId, props) {
  request({method: 'model.'+modelId+'.default_get', params: [
			props,
		]}).then(defaultValue => db.put('defaultValue', defaultValue))
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
		100,
		null,
		[],
  ]})
}

function loadModel (request, modelsDb, modelId) {
  var db = modelsDb.sublevel(modelId)
  return Promise.all([
    loadViews(request, db.sublevel('views'), modelId),
    getModelDef(request, modelId).then(modelDef => Promise.all([
      db.put('modelDef', modelDef),
      loadModelDefaultValue(request, db, modelId, modelDef.fields.map(get('name'))),
    ])),
    getQgsFile(request, modelId).then(qgsFile => {
      if (qgsFile) {
        return Promise.all([
          db.put('qgsFile', qgsFile),
          loadGeoItems(request, db.sublevel('items'), modelId),
        ])
      } else {
        return Promise.all([
          db.del('qgsFile'), // be sure to remove existing file if any
          loadNonGeoItems(request, db.sublevel('items'), modelId),
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
        db.sublevel('menuItemActions').put(menuItemId, action),
        loadModel(request, db.sublevel('models'), modelId),
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
    db.put(menuItemId, menuItemValue)
  )
}

function loadMenuItem(request, db, menuItemId) {
  return Promise.all([
    loadMenuItemValue(request, db.sublevel('menuItemValues'), menuItemId),
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
