// Log
'use strict'

process.on('uncaughtException', e=>log(e))
process.on('unhandledRejection', e=>log(e))

var wlog,
    exceptions = [],
    errorThreshhold = 0,
    errorPeriod = 60

const nodeWindows = require('node-windows')
  
module.exports = init

function init(name, threshhold, period) {
    if (!isNaN(threshhold) && threshhold > 0) errorThreshhold = threshhold
    if (!isNaN(period)) errorPeriod = period
    wlog = new nodeWindows.EventLogger(name)
    return log
}

function log(e, level){
    const now = Date.now()
    if (e instanceof Object) { level = 3; e = `${now}::${e.message}::${e.stack}` }
    if (wlog && wlog.error instanceof Function) {
        switch (level) {
            case 1: wlog.info(e); break
            case 2: wlog.warn(e); break
            case 3: wlog.error(exceptions.length + ' ' + e.replace(/\n/g,'\r\t'))
                //console.log(exceptions.length, e)
                exceptions.push(now)
                while (exceptions.length) {
                    const within = exceptions[0] + (errorPeriod * 1000) - now
                    if (within > 0) break
                    exceptions.shift()
                }
                if (exceptions.length > errorThreshhold) process.exit()
                break
            default: console.log(exceptions.length, e)
        }
    }
}
