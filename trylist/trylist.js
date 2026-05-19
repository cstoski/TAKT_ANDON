// Trylist 0.0.1
// TODO:
// 2 minimum snapshots

'use strict'

module.exports = Trylist

const path = require('path'),
    fs = require('fs'),
    snapshotDir = 'snapshots',
    logDir = 'logs',
    eventPrefix = 'trylist-',
    extension = '.json',
    extension2 = '.log',
    saveLimit = 15 * 1000,
    purgeInterval = 60 * 10 * 1000

function Trylist (name, obj, snapshotCount, snapshotPeriod) {
    Trylist.save = save
    const dirname = typeof obj === 'string' ? obj : path.join(__dirname, logDir)
    snapshotCount || (snapshotCount = 10)
    snapshotPeriod || (snapshotPeriod = 60 * 2 * 1000)
    //Trylist.query = query
    Trylist.stringify = stringify

    var list,
        logging,
        resolve,
        currentMs,
        //subMs = 0,
        saveTimeout,
        purgeTimeout
        
    const proxyMethods = { get: getter, set: setter, deleteProperty: setter },
        promise = new Promise((res, rej)=>{ resolve = res })

    fs.appendFile(path.join(dirname, eventPrefix+name+extension2), '', error=>{
        if (error) return resolve(error)
        if (obj instanceof Object) {
            logging = true
            resolve(list = wrap(obj))
        }
        else load()
    })

    return promise

    //-------------------------------------------------------------------------------

    function getter (o, p) {
        if (p.__proto__.constructor === Symbol) return p
        if (p === 'toJSON') return
        if (p === 'then') return
        if (p === 'catch') return
        if (p === 'join') { const obj = unwrap(o); return obj.join.bind(obj) }
        if (p === '$') return o
        if (p === '$$') return unwrap(o)
        if (p === '^') return o[p]
        if (p === '<') return o[p]
        if (p === '_') return (p in o) ? o[p] : undefined
        if (p in o) return o[p]
        return wrap(undefined, o, p)
    }

    function setter (o, p, v) {
        if (v === undefined) delete o[p]
        else {
            if ('_' in o) {
                delete o._
            }
            wrap(v, o, p)
        }
        if (logging && (!(v instanceof Object) || Object.keys(v).length)) {
            logChange(whichBranch(o, [Array.isArray(o) ? +p : ''+p]), v)
            if (!saveTimeout) {
                save(name, list)
                saveTimeout = setTimeout(()=>{ saveTimeout = undefined }, saveLimit)
            }
        }
        return true
    }

    function wrap (v, o, p) {
        const specified = typeof o === 'object' && p !== undefined,
            isArr = p !== undefined && typeof p === 'string' && p.startsWith('#'),
            isArray = Array.isArray(v) || isArr
        if (isArr) p = p.substring(1)
        const obj = (specified && p in o) ? o[p] : specified
            ? o[p] = new Proxy(isArray ? [] : {}, proxyMethods)
            : new Proxy(isArray ? [] : {}, proxyMethods)
        if (!('^' in obj) && specified) Object.defineProperties(obj, {
            '^': { enumerable: false, configurable: false, writable: false, value: o },
            '<': { enumerable: false, configurable: false, writable: false, value: p },
        })
        if (v instanceof Object) {
            const k = Object.keys(v)
            for (var i=0, j=k.length; i<j; i++) {
                const prop = isArray ? i : k[i]
                Object.defineProperty(obj, prop, {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: wrap(v[prop], obj, prop)
                })
            }
        }
        else if (v !== undefined) {
            Object.defineProperty(obj, '_', {
                enumerable: false,
                configurable: true,
                writable: true,
                value: v
            })
        }
        return obj
    }

    function unwrap (o) {
        if (!(o instanceof Object)) return o
        const ret = Array.isArray(o) ? [] :{}
        for (var p in o) ret[p] = '_' in o[p] ? o[p]._ : o[p].$$
        return ret
    }

    function whichBranch (v, vpath) {
        if (!Array.isArray(vpath)) vpath = []
        if (v['<'] !== undefined) {
            vpath.unshift(v['<'])
            if ('^' in v) whichBranch(v['^'], vpath)
        }
        return vpath
    }
    
    function logChange (branch, change) {
        if (!(Array.isArray(branch))) {
            throw new Error('Could not log change event, empty object.')
            // Notify the error system, and return not throw?
            return
        }
        const date = new Date
        fs.appendFile(path.join(dirname, eventPrefix+name+extension2),
            `${date.getTime()}::${date.toISOString()}::${branch.join('|')}::${JSON.stringify(change)}\r\n`,
            'utf8',
            error=>{ if (error) {
                // Notify the event system of the inability to persist events
                throw new Error('Could not append the list event log.')
            } }
        )
    }

    async function load (snapshots, index, error) {
        if (!+index) index = 1
        else console.log(index, error)
        if (!Array.isArray(snapshots)) snapshots = await recentSnapshots()
        if (snapshots.length < index) {
            list = wrap({})
            processChanges(await readChanges())
            logging = true
            return resolve(list)
        }
        const last = snapshots[snapshots.length - index],
            timestamp = +last.split('-')[0]
        currentMs = timestamp || Date.now()
        fs.readFile(path.join(dirname, snapshotDir, last), 'utf8', async (error, data)=>{
            if (error || !data || data.length < 16) return load(snapshots, index + 1, 'Could not read JSON snapshot file.')
            try { var parsed = JSON.parse(data) } catch(e) { return load(snapshots, index + 1, 'Could not parse JSON snapshot data structure.') }
            if (parsed instanceof Object) list = wrap(parsed)
            else return load(snapshots, index + 1, 'Could not find object in JSON snapshot.')
            processChanges(await readChanges(timestamp))
            logging = true
            resolve(list)
            purgeTimeout = setInterval(purgeSnapshots, purgeInterval)
        })
    }

    function readChanges (since) {
        if (!+since) since = 0
        var res
        const promise = new Promise(res2=>res=res2)
        fs.readFile(path.join(dirname, eventPrefix+name+extension2), 'utf8', (error, data)=>{
            if (error) {
                // Notify the event system of the inability to load events
                throw new Error('Could not read the list event log.')
                return
            }
            const events = data.split('\r\n'),
                recent = []
            for (var i=0, j=events.length; i<j; i++) {
                if (!events[i]) continue
                const parts = events[i].split('::', 4)
                if (+parts[0] < +since) continue
                recent.push(parts)
            }
            res(recent)
        })
        return promise
    }

    function processChanges (changes) {
        if (!Array.isArray(changes) || !changes.length) return
        while (changes.length) {
            const eventParts = changes.shift()
            if (!eventParts || !eventParts[2]) continue
            const branch = eventParts[2].split('|')
            try { var change = eventParts[3] !== 'undefined' ? JSON.parse(eventParts[3]) : undefined } catch(e) {
                throw new Error('Could not parse change event.')
                // notify the error log system... should continue not throw?
                continue
            }
            var pointer = list
            while (branch.length > 1) pointer = pointer[branch.shift()]
            pointer[branch.shift()] = change
        }
        save(name, list)
        return true
    }

    function recentSnapshots () {
        var res
        const path2 = path.join(dirname, snapshotDir),
            promise = new Promise(res2=>res=res2)
        fs.readdir(path2, (error, files)=>{
            if (error) {
                res([])
                throw new Error('Could not read from snapshot directory: ' + path2)
                return
            }
            const snapshots=[]
            for (var i=0, j=files.length; i<j; i++) {
                const part = extension ? files[i].split(extension)[0] : files[i]
                if (part.endsWith('-'+name)) snapshots.push(files[i])
            }
            snapshots.sort()
            res(snapshots)
        })
        return promise
    }

    function purgeSnapshots () {
        const path2 = path.join(dirname, snapshotDir)
        fs.readdir(path2, async (error, snapshots)=>{
            if (error) {
                res([])
                throw new Error('Could not read from snapshot directory: ' + path2)
                return
            }
            snapshots.sort()
            var found = 0
            for (var i=snapshots.length-1; i>=0; i--) {
                await new Promise((res, rej)=>{
                    fs.readFile(path.join(path2, snapshots[i]), 'utf8', async (error, data)=>{
                        const part = extension ? snapshots[i].split(extension)[0] : snapshots[i]
                        if (part.endsWith('-'+name)) {
                            var good
                            if (!error && data && data.length >= 16) {
                                try { var parsed = JSON.parse(data) } catch(e) {}
                                if (parsed instanceof Object) { good = true; found++ }
                            }
                            const timestamp = +part.split('-', 1)
                            if (timestamp < currentMs - snapshotPeriod && found > snapshotCount) fs.unlink(path.join(path2, snapshots[i]), ()=>{})
                        }
                        res()
                    })
                })
            }
        })
    }

    function save (name2, listobj) {
        var resolve
        const promise = new Promise((res, rej)=>{ resolve = res }),
            now = Date.now()
        //if (now !== currentMs) { currentMs = now; subMs = 0 } else subMs++
        if (now > currentMs) currentMs = now; else currentMs++
        //const subMsStr = ''+subMs,
        //    subMsPad = '0'.repeat(3 - subMsStr.length) + subMsStr
        fs.writeFile(path.join(dirname, snapshotDir, currentMs + '-' + /*subMsPad + '-' +*/ name2 + extension), stringify(listobj, 2)+'\n', error=>{
            // Notify the error logging routine
            if (error) return resolve(error)
            fs.truncateSync(path.join(dirname, eventPrefix+name+extension2))
            resolve()
        })
        return promise
    }
    
/*    function query (Tobj, handler, subp) {
        const f = handler instanceof Function,
            ret = new Proxy(Array.isArray(Tobj) ? [] : {}, proxyMethods),
            k = Object.keys(Tobj)
        for (var i=0, j=k.length; i<j; i++) {
            const p = Array.isArray(Tobj) ? i : k[i]
            if (f) {
                const retp = handler(Tobj, p)
                if (retp !== undefined) ret[p] = retp
            } else if (subp) {
                const which = subp ? Tobj[p][subp]._ : Tobj[p]._
                if (typeof which === 'string') {
                    const res = which.match(handler)
                    if (Array.isArray(res) && res[0] !== undefined) ret[p] = which
                }
            }
        }
        return ret
    }
*/

    function stringify (list, spacing) {
        const ret = JSON.stringify(list, replacer, spacing)
        return ret
    }    

    function replacer (key, value) {
        if (!key.length) return value
        if (!(value instanceof Object)) return value
        return '_' in value ? value._ : this[key].$
    }

}