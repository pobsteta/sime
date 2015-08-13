var FullScreen = require('absolute/FullScreen');
var download = require('./src/utils/download')
var App = require('./src/ConnectionManager');

var levelup = require('levelup')
var leveljs = require('level-js')
var sublevel = require('sublevel')
var levelPromise = require('level-promise')

function clearDb (db) {
  return new Promise((resolve, reject) => {
    db.createKeyStream()
      .on('data', key =>
        db.del(key, (err) => {
          if (err) reject(err)
        })
      )
      .on('end', resolve) // TODO : comment faire pour ne pas appeler 'resolve' trop tôt ?
      .on('error', reject)
  })
}


var rawDb = window.db = levelup('sime', {
  db: leveljs,
  valueEncoding: 'json',
})

clearDb(rawDb).then(() => {
  var db = sublevel(rawDb)
  levelPromise(db)

  var app = new App()
  new FullScreen(app)

  download(app._rpcRequest, db, 132).then(() => {
    rawDb.createReadStream()
    .on('data', function (data) {
      console.log(data.key, '=', data.value)
    })
    .on('error', function (err) {
      console.log('Oh my!', err)
    })
    .on('close', function () {
      console.log('Stream closed')
    })
    .on('end', function () {
      console.log('Stream end')
    })
  })
  
})
