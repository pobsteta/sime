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
  var firstRequest = req.request
  var requestPromise = (firstRequestType === 'rpc' ?
    rpcRequest(cloneRpcRequest(firstRequest)) :
    wfsRequest(deserializeGeoRequest(firstRequest))
  )
  return requestPromise
    .then((resp) => {
      if (firstRequestType === 'rpc') {
        var methodParts = firstRequest.method.split('.')
        var method = methodParts.pop()
        var modelId = methodParts.slice(1).join('.')
        if (method === 'create' && modelId !== 'ir.attachment') {
          var localId = firstRequest.params[0][0].id
          var serverId = resp[0]
          updateFollowingRequestsWithServerId(requestsStore, modelId, localId, serverId)
          // TODO: updateLocalDbWithServerId()
        }
      }
    })
    .then(() => requestsStore.removeKey(firstRequestId))
    .catch((err) => {
      requestsStore.change(firstRequestId+'/lastTry', {
        time: new Date().toISOString(),
        response: err,
      })
      throw(new Error('Upload failed for request '+ firstRequestId))
    })
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

function updateFollowingRequestsWithServerId(requestsStore, modelId, localId, serverId) {
  var followingRequestIds = requestsStore.keys().slice(1)
  followingRequestIds.forEach((reqId) => {
    var req = requestsStore.value()[reqId+'/request']
    if (isRequestAboutLocalId(req, modelId, localId)) {
      updateRequestWithServerId(requestsStore, reqId, req, serverId)
    }
  })
}

function isRequestAboutLocalId(req, modelId, itemId) {
  if (req.type === 'rpc') {
    var methodParts = req.request.method.split('.')
    var method = methodParts.pop()
    var reqModelId = methodParts.slice(1).join('.')
    if (reqModelId === 'ir.attachment') {
      var attachment = req.request.params[0][0]
      var [attachmentModelId, attachmentItemId] = attachment.resource.split(',')
      return attachmentModelId === modelId && attachmentItemId === itemId
    } else {
      // pour les items classiques
      if (method === 'write' || method === 'delete') {
        return reqModelId === modelId && req.request.params[0][0] === itemId
      }
      // les create ne sont jamais concernés
      return false
    }
  }
  if (req.type === 'wfs') {
    return req.request.params.type === modelId && req.request.params.itemId === itemId
  }
}

function updateRequestWithServerId(requestsStore, reqId, req, serverId) {
  if (req.type === 'rpc') {
    var methodParts = req.request.method.split('.')
    var model = methodParts.slice(1, methodParts.length-1).join('.')
    if (model === 'ir.attachment') {
      var attachment = req.request.params[0][0]
      var modelId = attachment.resource.split(',')[0]
      req.request.params[0][0]['resource'] = [modelId, serverId].join(',')
    } else {
      req.request.params[0][0] = serverId
    }
  }
  if (req.type === 'wfs') {
    req.request.params.itemId = serverId
  }
  requestsStore.change(reqId+'/request', req)
}
