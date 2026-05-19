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
    saveLimit = 15000,
    purgeInterval = .5 * 60 * 1000, // 2 minutes
    snapshotPeriod = 60 * 1000, // 24 * 60 * 60 * 1000 // 1 day
    ensureSnapshots = 4

function Trylist (name, obj) {

    if (this === global) throw new Error('Trylist must be called with new.')
    const dirname = typeof obj === 'string' ? obj : path.join(__dirname, logDir)
    
    Trylist.query = query
    Trylist.stringify = stringify

    var list,
        logging,
        resolve,
        currentMs,
        subMs = 0,
        saveTimeout,
        purgeTimeout
        
    const proxyMethods = { get: getter, set: setter },
        promise = new Promise((res, rej)=>{ resolve = res })

    if (obj instanceof Object) {
        fs.appendFile(path.join(dirname, eventPrefix+name+extension2), '', error=>{
            if (error) return resolve(error)
            logging = true
            resolve(list = wrap(obj))
        })
    } else {
        fs.appendFile(path.join(dirname, eventPrefix+name+extension2), '', error=>{
            if (error) return resolve(error)
            load()
        })
    }

    return promise

    //-------------------------------------------------------------------------------

    function getter (o, p) {
        if (p.__proto__.constructor === Symbol) return p
        if (p === 'toJSON') return
        if (p === 'then') return
        if (p === 'catch') return
        if (p === '$') return o
        if (p === '^') return o[p]
        if (p === '<') return o[p]
        if (p === '_') return (p in o) ? o[p] : undefined
        if (p in o) return o[p]
        return wrap(undefined, o, p)
    }

    function setter (o, p, v) {
        wrap(v, o, p)
        if (logging) {
            logChange(whichBranch(o, [Array.isArray(o) ? +p : ''+p]), v)
            if (!saveTimeout) {
                save(name, list)
                saveTimeout = setTimeout(()=>saveTimeout=undefined, saveLimit)
            }
        }
        return true
    }

    function wrap (v, o, p) {
        const specified = typeof o === 'object' && p !== undefined,
            isBang = p !== undefined && typeof p === 'string' && p.startsWith('#'),
            isArray = Array.isArray(v) || isBang
        if (isBang) p = p.substring(1)
        const obj = specified && p in o ? o[p] : specified
            ? o[p] = new Proxy(isArray ? [] : {}, proxyMethods)
            : new Proxy(isArray ? [] : {}, proxyMethods)
        if ((!'^' in obj) && specified) Object.defineProperties(obj, {
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
        } else if (v !== undefined) {
            Object.defineProperty(obj, '_', {
                enumerable: false,
                configurable: false,
                writable: true,
                value: v
            })
        }
        return obj
    }

    function whichBranch (v, vpath) {
        if (!Array.isArray(vpath)) vpath = []
        if (v['<'] !== undefined) {
            vpath.unshift(v['<'])
            if (v['^']) whichBranch(v['^'], vpath)
        }
        return vpath
    }
    
    function logChange (branch, change) {
        if (!(Array.isArray(branch))) {
            throw new Error('Could not log change event, empty object.')
            // Notify the error system, and return not throw?
            return
        }
        fs.appendFile(path.join(dirname, eventPrefix+name+extension2),
            `${Date.now()}::${(new Date).toISOString()}::${branch.join('|')}::${JSON.stringify(change)}\r\n`,
            'utf8',
            error=>{ if (error) {
                // Notify the event system of the inability to persist events
                throw new Error('Could not append the list event log.')
            } }
        )
    }

    async function load (snapshots, index, error) {
        if (!index) index = 1
        else console.log(index, error)
        if (!Array.isArray(snapshots)) snapshots = await recentSnapshots()
        if (!snapshots.length) {
            list = wrap({})
            processChanges(await readChanges())
            logging = true
            return resolve(list)
        }
        if (snapshots.length < index) return resolve(wrap({})) //return resolve(new Error(error))
        const last = snapshots[snapshots.length - index],
            timestamp = +last.split('-')[0]
        fs.readFile(path.join(dirname, snapshotDir, last), 'utf8', async (error, data)=>{
            if (error || !data || data.length < 16) return load(snapshots, index + 1, 'Could not read JSON snapshot.')
            try { var parsed = JSON.parse(data) } catch(e) { return load(snapshots, index + 1, 'Could not parse JSON snapshot.') }
            if (parsed instanceof Object) list = wrap(parsed)
            else return load(snapshots, index + 1, 'Could not find object in JSON snapshot.')
            purgeTimeout = setInterval(recentSnapshots, purgeInterval)
            processChanges(await readChanges(timestamp))
            logging = true
            resolve(list)
        })
    }

    function readChanges (since) {
        if (!+since) since = 0
        var res
        const promise = new Promise(res2=>res=res2)
        fs.readFile(
            path.join(dirname, eventPrefix+name+extension2), 'utf8', (error, data)=>{
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
            }
        )
        return promise
    }

    function processChanges (changes) {
        if (!Array.isArray(changes) || !changes.length) return
        while (changes.length) {
            const eventParts = changes.shift()
            if (!eventParts) continue
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
            const snapshots=[],
                unlink = []
            for (var i=0, j=files.length; i<j; i++) {
                const part = extension ? files[i].split(extension)[0] : files[i]
                if (part.endsWith('-'+name)) {
                    const timestamp = +part.split('-', 1)
                    if (timestamp < currentMs - snapshotPeriod) unlink.push(files[i])
                    else snapshots.push(files[i])
                }
            }
            unlink.sort()
            snapshots.sort()
            for (var k = snapshots.length; k < ensureSnapshots && unlink.length; k++) snapshots.unshift(unlink.pop())
            for (var a in unlink) fs.unlink(path.join(path2, unlink[a]), ()=>{})
            res(snapshots)
        })
        return promise
    }

    function save (name2, listobj) {
        const now = Date.now()
        if (now !== currentMs) { currentMs = now; subMs = 0 } else subMs++
        const subMsStr = ''+subMs,
            subMsPad = '0'.repeat(3 - subMsStr.length) + subMsStr
        fs.writeFile(path.join(dirname, snapshotDir, currentMs + '-' + subMsPad + '-' + name2 + extension), stringify(listobj, 2)+'\n', error=>{
            // Notify the error logging routine
            if (error) return
        })
    }
    
    function query (Tobj, handler, subp) {
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