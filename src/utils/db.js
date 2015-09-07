export function sublevel(db, prefix) {
  return {db: db, prefix: prefix+'/'}
}

export function put(db, key, value) {
  return db.put ? db.put(key, value) : put(db.db, db.prefix+key, value)
}

export function get(db, key) {
  return db.get ? db.get(key) : get(db.db, db.prefix+key)
}

export function del(db, key) {
  return db.del ? db.del(key) : del(db.db, db.prefix+key)
}

export function batch(db, ops) {
  return db.batch ? db.batch(ops) : batch(db.db, ops.map(op => {
    op.key = db.prefix+op.key
    return op
  }))
}

export function clear(db, prefix) {
  return db.createKeyStream ? clearDb(db, prefix) : clear(db.db, db.prefix)
}

function clearDb (db, prefix) {
  prefix = prefix || ''
  return new Promise((resolve, reject) => {
    db.createKeyStream({
      gte: prefix,
      lte: prefix+'\uffff',
    })
      .on('data', key =>
        db.del(key, (err) => {
          if (err) reject(err)
        })
      )
      .on('end', resolve) // TODO : comment faire pour ne pas appeler 'resolve' trop tôt ? utiliser un batch ?
      .on('error', reject)
  })
}

export function readRange (db, prefix) {
  return db.createReadStream ? readDbRange(db, prefix) : readRange(db.db, db.prefix)
}

function unprefix(key, prefix) {
  return key.slice(prefix.length)
}

function readDbRange (db, prefix) {
  return new Promise((resolve, reject) => {
    var result = []
    db.createReadStream({
      gte: prefix,
      lte: prefix+'\uffff',
    })
      .on('data', function(entry) {
        result.push({
          key: unprefix(entry.key, prefix),
          value: entry.value,
        })
      })
      .on('error', reject)
      .on('end', function () {
        resolve(result)
      })
  })
}
