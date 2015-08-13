import download from './download'
import ConnectionManager from '../ConnectionManager'

new ConnectionManager(function (args) {
  download(args.request, {}, 79)
})
