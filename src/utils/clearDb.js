export default function clearDb (db) {
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
