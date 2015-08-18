import clone from 'lodash/lang/clone'

export default function upload (requestsStore, request) {
  if (requestsStore.keys().length > 0) {
    return processFirstRequest(requestsStore, request).then(function () {
      return upload(requestsStore, request)
    })
  } else {
    return true
  }
}

function processFirstRequest(requestsStore, request) {
  var firstRequestId = requestsStore.keys()[0]
  var firstRequest = clone(requestsStore.value()[firstRequestId+'/request']) // rest a l'air de modifier directement l'objet request
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
