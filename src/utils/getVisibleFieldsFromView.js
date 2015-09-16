module.exports = function (arch) {
  var fields = []
  var fieldElements = arch.querySelectorAll('field')
  for (var i = 0; i < fieldElements.length; i++) {
    if (fieldElements[i].getAttribute('tree_invisible') !== '1') {
      fields.push(fieldElements[i].getAttribute('name'))
    }
  }
  return fields

}
