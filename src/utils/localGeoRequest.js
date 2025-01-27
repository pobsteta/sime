import ol from '../openlayers'
import assign from 'lodash/object/assign'

var geoJson = new ol.format.GeoJSON()


export default function(db) {
  return function(args) {
    var keyPrefix = 'models/' + args.params.type + '/items/'
    if (args.method === 'getFeature') {
      return new Promise((resolve, reject) => {
        var result = []
        db.createValueStream({
            gte: keyPrefix,
            lte: keyPrefix+'\uffff',
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
      var geom = args.params.geom && geoJson.writeGeometryObject(args.params.geom.clone().transform('EPSG:3857', 'EPSG:2154'))
      return db.get(itemKey).then(itemValue => Promise.all([
        db.put(itemKey, assign(itemValue, { geom: geom })),
        db.put('_requests/'+new Date().toISOString()+'/request', {
          type: 'wfs',
          request: serializeGeoRequest(args),
        }),
      ]))
    }
  }
}

function serializeGeoRequest(geoRequest) {
  return {
    method: geoRequest.method,
    params: {
      type: geoRequest.params.type,
      itemId: geoRequest.params.itemId,
      geom: geoRequest.params.geom && geoJson.writeGeometryObject(geoRequest.params.geom),
    },
  }
}
