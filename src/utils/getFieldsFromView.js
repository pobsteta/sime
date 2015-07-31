module.exports = function (arch) {
  var fields = []
  var fieldElements = arch.querySelectorAll('field')
  for (var i = 0; i < fieldElements.length; i++) {
    fields.push(fieldElements[i].getAttribute('name'))
  }
  return fields
}
