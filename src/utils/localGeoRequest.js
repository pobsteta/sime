import ol from 'openlayers'
import assign from 'lodash/object/assign'

var geoJson = new ol.format.GeoJSON()

var searchLimit = 1000;

export default function(db) {
  return function(args) {
    var keyPrefix = 'models/' + args.params.type + '/items/'
    if (args.method === 'getFeature') {
      return new Promise((resolve, reject) => {
        var result = []
        db.createValueStream({
            gte: keyPrefix,
            lte: keyPrefix+'\uffff',
            limit: searchLimit,
          })
          .on('data', function(value) {
            if (!value.geom) return

            var geom = geoJson.readGeometry(value.geom).transform('EPSG:2154', 'EPSG:3857');
            if (ol.extent.intersects(geom.getExtent(), args.params.bbox) &&
              (!args.params.filter || value[args.params.filter[0]] === args.params.filter[2])) {

              var feature = new ol.Feature(geom)
              feature.setId(args.params.type + '.' + value.id)
              feature.setProperties(value)
              result.push(feature)
            }
          })
          .on('error', reject)
          .on('end', function () {
            resolve(result)
          })
      })
    }
    if (args.method === 'transaction') {
      var itemKey = keyPrefix + args.params.itemId
      var geom = geoJson.writeGeometryObject(args.params.geom.clone().transform('EPSG:3857', 'EPSG:2154'))
      return new Promise((resolve, reject) => {
        db.get(itemKey).then(itemValue =>
          db.put(itemKey, assign(itemValue, { geom: geom }))
            .then(() => resolve())
        )
        // TODO: enqueue local request
        // db.put('_requests/'+new Date().toISOString()+'/request', args)
      })
    }
  }
}
