// SHARKPOOL - DB Connection pool
// A database connection pool manager supporting multiple query-based database types, error handling, retries
// and efficient resource management.
'use strict'

const mysql2 = require('mysql2'),
    defaults = {
        maxConnections: 1,
        executeTimeout: 2000,
    }

module.exports = { createPool: createPool }

function createPool (opt) { return new Conn(opt) }

function Conn (opt) {
    this.connections = 0
    this.pool = []
    this.queue = []
    this.options = Object.assign({}, defaults, opt)
    queueUp.call(this)
}
Object.assign(Conn.prototype, { execute: execute, destroy: destroy })

function execute (query, params) {
    var resolve, reject
    const promise = new Promise((res, rej)=>{ resolve = res; reject = rej })
    //for (var i in params) if (params[i] === undefined) return Promise.resolve([Error(`SQL parameter ${i} was undefined.`)])
    for (var i in params) if (params[i] === undefined) params[i] = null //better
    this.queue.push({
        queueTime: process.hrtime(),
        resolve,
        reject,
        query,
        params,
    })
    setImmediate(queueUp.bind(this))
    return promise
}

async function queueUp () {

    for (var p=0, j=this.pool.length; p<j; p++) {
        const check = this.pool.shift()
        if (check && !check.closed && !check._fatalError) this.pool.push(check)
        else {
            check.destroy()
            if (this.connections > 0) this.connections--
        }
    }

    const targetConnections = this.options.warmConnections === true
            ? this.options.maxConnections
            : isNaN(this.options.warmConnections) ? 1 : this.options.warmConnections
    
    var conn
    while (!testPromise || !await testPromise) {

        while (this.connections < targetConnections) {
            const newconn = mysql2.createConnection(this.options.server)
            newconn.on('error', error.bind(this, newconn))
            this.pool.push(newconn)
            this.connections++
        }

        if (!this.queue.length) return
        if (!this.pool.length) return

        var conn = this.pool.shift(),
            resolve2,
            testPromise = new Promise((res, rej)=>{ resolve2 = res })
        conn.timeout = setTimeout(timeoutHandler.bind(this, conn, resolve2), 5000)
        try {
            //resilience testing
            //if (Math.random()<0.2) a()
            conn.execute('SELECT 0', [], (err, results, fields)=>{
                if (!conn.timeout) return
                clearTimeout(conn.timeout)
                delete conn.timeout
                const cancel = err || conn.closed
                resolve2(!cancel && !!results.length)
                if (cancel) {
                    console.log('pretest connection failed, discarded')
                    error.call(this, conn, err)
                }
            })
        } catch (e) {
            if (!conn.timeout) return
            console.log('Exception pretest: '+e.message)
            clearTimeout(conn.timeout)
            delete conn.timeout
            resolve2()
            const err = Error('Database Exception thrown')
            error.call(this, conn, err)
        }
        await testPromise
    }

    if (!this.queue.length) return this.pool.push(conn) // console.log('restored A', this.pool.push(conn))
    const nextItem = this.queue.shift()
    const { queueTime, resolve, reject, query, params } = nextItem,
        qhrtime = process.hrtime(queueTime),
        start = process.hrtime()
    conn.timeout = setTimeout(timeoutHandler.bind(this, conn, resolve), this.options.executeTimeout)
    try {
        //resilience testing
        //if (Math.random()<0.1) a()
        conn.execute(query, params, (err, results, fields)=>{
            if (!conn.timeout) return
            const hrtime = process.hrtime(start)
            clearTimeout(conn.timeout)
            delete conn.timeout
            const augment = err || results || []
            augment.queueDuration = qhrtime[0] + (qhrtime[1] / 1e9)
            augment.queryDuration = hrtime[0] + (hrtime[1] / 1e9)
            resolve([err, results, fields])
            //resilience testing
            //if (Math.random()<0.2) conn.destroy()
            if (err) error.call(this, conn, err)
            else {
                this.pool.push(conn)
                setImmediate(queueUp.bind(this))
            }
        })
    } catch(e) {
        if (!conn.timeout) return
        console.log('Exception query: '+e.message)
        clearTimeout(conn.timeout)
        delete conn.timeout
        const err = Error('Database Exception thrown')
        error.call(this, conn, err)
        //resolve([err])
        this.queue.unshift(nextItem)
        setTimeout(queueUp.bind(this), 3000)
    }
}

function timeoutHandler (conn, res) {
    delete conn.timeout
    error.call(this, conn, Error('ERROR: Database Timeout'), res)
}

function error (conn, err, res) {
    conn.closed = true
    this.pool.push(conn)
    if (res instanceof Function) {
        console.log(`DB ERROR:::::::: [${this.connections}, ${this.pool.length} left] ${err instanceof Object ? err.message : err}`)
        res([err])
        setImmediate(queueUp.bind(this))
    }
}

function destroy () {
    for (var i in this.pool) this.pool[i].end && this.pool[i].end()
    this.connections = 0
}