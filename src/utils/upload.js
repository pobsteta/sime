export default function upload (requestsStore, request) {
  if (requestsStore.keys().length > 0) {
    return processFirstRequest(requestsStore, request).then(function () {
      return upload(requestsStore, request)
    })
  } else {
    return true
  }
}

function cloneRequest(request) {
  return {
    method: request.method,
    params: request.params.slice(),
  }
}

function processFirstRequest(requestsStore, request) {
  var firstRequestId = requestsStore.keys()[0]
  var firstRequest = cloneRequest(requestsStore.value()[firstRequestId+'/request'])
  return request(firstRequest).then(function () {
    return requestsStore.removeKey(firstRequestId)
  }, function (err) {
    requestsStore.change(firstRequestId+'/lastTry', {
      time: new Date().toISOString(),
      response: err,
    })
    throw(new Error('Upload failed for request '+ firstRequestId))
  })
}
