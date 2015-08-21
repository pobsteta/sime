import ol from '../openlayers'
var geoJson = new ol.format.GeoJSON()

export default function upload (requestsStore, rpcRequest, wfsRequest) {
  if (requestsStore.keys().length > 0) {
    return processFirstRequest(requestsStore, rpcRequest, wfsRequest).then(function () {
      return upload(requestsStore, rpcRequest, wfsRequest)
    })
  } else {
    return Promise.resolve(true)
  }
}

function cloneRpcRequest(request) {
  return {
    method: request.method,
    params: request.params.slice(),
  }
}

function processFirstRequest(requestsStore, rpcRequest, wfsRequest) {
  var firstRequestId = requestsStore.keys()[0]
  var req = requestsStore.value()[firstRequestId+'/request']
  var firstRequestType = req.type
  var firstRequest = firstRequestType === 'rpc' ? cloneRpcRequest(req.request) : deserializeGeoRequest(req.request)
  return (firstRequestType === 'rpc' ? rpcRequest : wfsRequest)(firstRequest).then(
    function () {
      return requestsStore.removeKey(firstRequestId)
    },
    function (err) {
      requestsStore.change(firstRequestId+'/lastTry', {
        time: new Date().toISOString(),
        response: err,
      })
      throw(new Error('Upload failed for request '+ firstRequestId))
    }
  )
}

function deserializeGeoRequest(geoRequest) {
  return {
    method: geoRequest.method,
    params: {
      type: geoRequest.params.type,
      itemId: geoRequest.params.itemId,
      geom: geoJson.readGeometry(geoRequest.params.geom),
    },
  }
}
