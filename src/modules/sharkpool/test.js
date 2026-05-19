'use strict'

const sharkpool = require('./sharkpool')
const connection = sharkpool.createPool({
    maxConnections: 10,
    warmConnections: true,
    server: {
        host: '192.168.2.33',
        user: 'remote',
        database: 'perkins',
        password: 'qazwsxedc',
    }
})

const start = process.hrtime(),
    queries = []

for (var i=0; i<5; i++) {
    const q = connection.execute('SELECT * from events')
    queries.push(q)
    q.then(response=>{
        if (response[0]) return console.log(response[0])
        console.log(response[1].queryDuration)
    })
}

Promise.all(queries).then(responses=>{
    const hrtime = process.hrtime(start),
        duration = hrtime[0] + (hrtime[1] / 1e9)
    console.log(duration, 'total')
})
