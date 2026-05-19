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
    function queueTimeout (item) {
        this.queue.splice(this.queue.indexOf(item), 1)
        resolve([Error('DATABASE Queue took too long to start query.')])
    }
    var resolve, reject
    const promise = new Promise((res, rej)=>{ resolve = res; reject = rej })
    //for (var i in params) if (params[i] === undefined) return Promise.resolve([Error(`SQL parameter ${i} was undefined.`)])
    for (var i in params) if (params[i] === undefined) params[i] = null //better
    const theItem = {
        queueTime: process.hrtime(),
        resolve,
        reject,
        query,
        params,
    }
    theItem.timeout = setTimeout(queueTimeout.bind(this, theItem), 10000)
    this.queue.push(theItem)
    setImmediate(queueUp.bind(this))
    return promise
}

async function queueUp () {
    const that = this
    
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

    while (this.connections < targetConnections) {
        const newconn = mysql2.createConnection(this.options.server)
        newconn.on('error', error.bind(this, newconn))
        this.pool.push(newconn)
        this.connections++
    }
    if (!this.pool.length) return

    for (var q in this.queue) {

        var conn = this.pool.shift()
        if (!conn) return setImmediate(queueUp.bind(this))
        //conn.timeout = setTimeout(timeoutHandler.bind(this, conn, resolve2), 5000)
        try {
            //resilience testing
            //if (Math.random()<0.2) a()
            conn.execute('SELECT 0', [], postTest.bind(conn))
        } catch (e) {
            //if (!conn.timeout) return
            console.log('Exception pretest: '+e.message)
            //clearTimeout(conn.timeout)
            //delete conn.timeout
            //resolve2()
            const err = Error('Database Exception thrown')
            error.call(this, conn, err)
        }
        //if (!await testPromise) continue
    }
    
    function postTest (err, results, fields) {
        const conn2 = this
        //if (!conn2.timeout) return
        //clearTimeout(conn2.timeout)
        //delete conn2.timeout
        if (err /*|| conn2.closed*/) {
            console.log('pretest connection failed, discarded')
            error.call(that, conn2, err)
        }
        else {
            const nextItem = that.queue.shift()
            if (!nextItem) return
            const { queueTime, resolve, reject, query, params, timeout } = nextItem
            clearTimeout(timeout)
            const qhrtime = process.hrtime(queueTime),
                start = process.hrtime()
            conn2.timeout = setTimeout(timeoutHandler.bind(that, conn2, resolve), that.options.executeTimeout)
            try {
                //resilience testing
                //if (Math.random()<0.5) this_is_an_exception()
                conn2.execute(query, params, (err, results, fields)=>{
                    if (!conn2.timeout) return
                    const hrtime = process.hrtime(start)
                    clearTimeout(conn2.timeout)
                    delete conn2.timeout
                    const augment = err || results || []
                    augment.queueDuration = qhrtime[0] + (qhrtime[1] / 1e9)
                    augment.queryDuration = hrtime[0] + (hrtime[1] / 1e9)
                    resolve([err, results, fields])
                    //resilience testing
                    //if (Math.random()<0.2) conn2.destroy()
                    if (err) error.call(that, conn2, err)
                    else that.pool.push(conn2)
                })
            } catch(e) {
                if (!conn2.timeout) return
                console.log('Exception query: '+e.message)
                clearTimeout(conn2.timeout)
                delete conn2.timeout
                that.queue.unshift(nextItem)
                const err = Error('Database Exception thrown')
                resolve([err])
                error.call(that, conn2, err)
                setTimeout(queueUp.bind(that), 5000)
            }
        }
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
        res()
        setImmediate(queueUp.bind(this))
    }
}

function destroy () {
    for (var i in this.pool) this.pool[i].end && this.pool[i].end()
    this.connections = 0
}