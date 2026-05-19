// Perkins Logic Controller
// (C)2019 Chris Batt / Takt Time / Takt Control / TAKT World Inc.
'use strict'

const nodes7 = require('nodes7'),  // This is the package name, if the repository is cloned you may need to require 'nodeS7' with uppercase S
    opts = {silent:true,debug:0}

module.exports = {
    //
    Register: function (stations, interval, callback, callbackConnect) {
        this.retryInterval = +interval||10000
        this.callback = callback
        this.callbackConnect = callbackConnect
        this.connections = {}

        this.add = function (s, station, initOnly) {
            for (var b in Object.keys(station.button.$)) {
                const ip = Array.isArray(station.button[b].host.$) ? station.button[b].host.join('.') : '',
                    which = ip + ':' + (station.button[b].port._||0),
                    initConn = !this.connections[which],
                    item = `S${s}B${b}`
                if (initConn) this.connections[which] = { conn: new nodes7(opts), map: {} }
                this.connections[which].map[item] = station.button[b].address._ + ',BYTE' + station.button[b].offset._
                if (initOnly) continue
                if (initConn) {
                    clearTimeout(this.connections[which].conn.retry)
                    retryConnect.call(this, ip, stations[s].button[b].port._, true)
                }
                else this.connections[which].conn.addItems([item])
            }
        }

        this.remove = function (stationID) {
            for (var c in this.connections) {
                const connection = this.connections[c]
                for (var m in connection.map) {
                    const match = m.match(/\S([0-9]+)B([0-9]+)/)
                    if (match[1] !== stationID) continue
                    connection.conn.removeItemsNow([m])
                    delete connection.map[m]
                }
                if (!Object.keys(connection.map).length) {
                    clearTimeout(connection.conn.retry)
                    connection.conn.dropConnection(()=>{})
                    delete this.connections[c]
                }
            }
        }

        this.read = async function () {
            if (!(this.connections instanceof Object) || !Object.keys(this.connections).length) return
            for (var c in this.connections) {
                const connection = this.connections[c]
                if (!(this.callback instanceof Function)) throw Error('Connection callback was not assigned')
                if (connection.conn.connected) connection.conn.readAllItems(this.callback.bind(connection))
            }
        }

        this.close = function () {
            for (var c in this.connections) this.connections[c].conn.dropConnection()
        }

        for (var s in stations) this.add(s, stations[s], true)
        for (var c in this.connections) {
            const host_parts = c.split(':')
            retryConnect.call(this, host_parts[0], host_parts[1], true)
        }
    },

    test: function (options) {
        var resolve
        const promise = new Promise(res=>{ resolve = res }),
            conn = new nodes7(opts),
            map = { test: `${options.address},${options.type||'BYTE'}${options.offset}` }
        conn.initiateConnection({ host: options.host, port: +options.port, rack: 0, slot: 1}, error=>{
            if (error) {
                conn.dropConnection()
                return resolve(error)
            }
            conn.setTranslationCB(translate.bind(null, map))
            conn.addItems(Object.keys(map))
            conn.readAllItems((error2, result)=>{
                conn.dropConnection()
                return resolve(error2 || result)
            })
        })
        return promise
    },

    test_takt: function (options) {
        var resolve
        const promise = new Promise(res=>{ resolve = res }),
            conn = new nodes7(opts)
        conn.initiateConnection({ host: options.host, port: +options.port, rack: 0, slot: 1}, error=>{
            if (error) return (error instanceof Object && 'host' in error && 'port' in error) ? resolve(Error('Timeout error connecting to PLC')) : resolve(error)
            conn.setTranslationCB(translate.bind(null, options.map))
            conn.addItems(Object.keys(options.map))
            conn.readAllItems((error2, results)=>{
                conn.dropConnection()
                return resolve(error2 || results)
            })
        })
        return promise
    },

    Takt: function (options, map) {
        this.host = Array.isArray(options.host) ? options.host.join('.') : options.host
        const conn = new nodes7(opts)

        this.connect = function (resolve) {
            if (!resolve || !this.promise) this.promise = new Promise((res)=>{ resolve = res })
            //console.log('Trying takt time connect:', this.host + ':' + options.port)
            conn.initiateConnection({ host: this.host, port: +options.port, rack: 0, slot: 1}, error=>{
                if (error) {
                    //console.log(error)
                    conn.connected = false
                    setTimeout(this.connect.bind(this, resolve), this.retryInterval)
                }
                else {
                    conn.connected = true
                    conn.connectTimeout = conn.dropConnectionCallback = this.connect.bind(this)
                    conn.setTranslationCB(translate.bind(null, map))
                    //conn.addItems(Object.keys(map))
                    resolve(true)
                }
           })
           return this.promise
        }

        this.addTakt = function () {
            conn.addItems(Object.keys(map))
        }
        
        this.getTaktTime = function () {
            var resolve
            const promise = new Promise(res=>{ resolve = res })
            if (!conn.connected) { resolve({message:'CONNECTION NOT YET ESTABLISHED'}); return promise }
            const timeout = setTimeout(resolve.bind(undefined, {message:'PLC Timed Out'}), 1500)
                conn.readAllItems((error, result)=>{
                clearTimeout(timeout)
                resolve(result || {message:error})
            })
            return promise
        }

        this.setTakt = function (registry) {
            var resolve
            const promise = new Promise(res=>{ resolve = res }),
                timeout = setTimeout(resolve.bind(undefined, Error('PLC Timed Out')), 3000),
                tags = [],
                values = [],
                writeItems = ()=>{
                    if (!tags.length || !values.length) return
                    if (conn.writeItems(tags, values, (error)=>{
                        clearTimeout(timeout)
                        resolve(error)
                    }) !== 0) setTimeout(writeItems, 500)
                }
            for (var i in registry) { if (typeof map[i] !== 'string') continue; tags.push(i); values.push(registry[i]); /*console.log(i, registry[i])*/ }
            writeItems()
            return promise
        }

        this.close = function () {
            conn.dropConnection(()=>{})
        }
    }
}

function retryConnect (host, port, init) {
    const c = host + ':' + port,
        connection = this.connections[c]
    //
    console.log('Connecting to PLC:', c)
    !init && this.callbackConnect && this.callbackConnect(host, port)
    connection.conn.initiateConnection({ host, port, rack: 0, slot: 1}, error=>{
        if (error) {
            console.log(error)
            connection.conn.connected = false
            if (this.callback instanceof Function) if (this.callback(error) !== false) connection.conn.retry = setTimeout(retryConnect.bind(this, host, port), this.retryInterval)
        }
        else {
            //
            console.log('PLC CONNECTED')
            connection.conn.connected = true
            connection.conn.connectTimeout = connection.conn.dropConnectionCallback = retryConnect.bind(this, host, port)
            connection.conn.setTranslationCB(translate.bind(this, connection.map))
            connection.conn.addItems(Object.keys(connection.map))
        }
    })
}

function translate (map, tag) {
    return map[tag]
}