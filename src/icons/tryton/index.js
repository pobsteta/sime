// hard-coded system icons
var fs = require('fs')

export default {
  'tryton-open': fs.readFileSync(__dirname + '/open.svg'),
  'tryton-preferences-system': fs.readFileSync(__dirname + '/preferences-system.svg'),
  'tryton-preferences': fs.readFileSync(__dirname + '/preferences.svg'),
  'tryton-executable': fs.readFileSync(__dirname + '/executable.svg'),
}
