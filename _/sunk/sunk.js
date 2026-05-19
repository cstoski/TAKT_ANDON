// Copyright Chris Batt <chris@ti3e.com>
// SUNK library
// Synchronize stuff really well.
'use strict'

var expiry = 60 * 60 * 1000,
    batch = 50

module.exports = Sunk

function Sunk (exp, bat) {
    this.channels = {},
    this.expiry = exp || expiry
    this.batch = bat || batch
    this.startTimestamp = Date.now()
}

Object.assign(Sunk.prototype, {
    timestamp: 0,
    sequence: 0,
    createChannel: function (name) {
        if (Array.isArray(this.channels[name])) return
        this.channels[name] = [[],[],[]]
        this.removeExpired(name)
    },
    deleteChannel: function (name) {
        if (Array.isArray(this.channels[name])) delete this.channels[name]
    },
    queue: function (channel, messages) {
        if (!Array.isArray(messages)) messages = [messages]
        const chan = this.channels[channel],
            ts = Date.now()
        if (ts !== this.timestamp) { this.timestamp = ts; this.sequence = 0 }
        for (var i in messages) {
            //console.log('QUEUE:', JSON.stringify(messages[i]))
            if (messages[i] instanceof Object) messages[i].timestamp = this.timestamp
            chan[0].push(this.timestamp)
            chan[1].push(this.sequence++)
            chan[2].push(JSON.stringify(messages[i]))
        }
        return { lastTimestamp: this.timestamp, lastSequence: this.sequence }
    },
    read: function (name, time, seq, max) {
        //if (!time) time = Date.now() - 1000
		if (max < 1) max = 0
        max = 1e6 // temp
		const chan = this.channels[name]
        for (var i=0, j=chan[0].length; time && i<j; i++) {
            if (time < chan[0][i] || (time === chan[0][i] && seq < chan[1][i])) { i++; break }
        }
        const last = max ? Math.min(i + max - 1, chan[0].length - 1) : chan[0].length - 1
        return {
            expiredTimestamp: time && time < chan[0][0],
            lastTimestamp: chan[0][last],
            lastSequence: chan[1][last],
            remaining: chan[0].length - 1 - last,
            queue: chan[2].slice(i - 1, last + 1),
        }
    },
    removeExpired: function (name) {
        const chan = this.channels[name],
            ts = Date.now()
        if (chan[0].length >= this.batch && chan[0][this.batch - 1] < (ts - this.expiry)) {
            for (var b=this.batch-1; b<chan[0].length-1; b++)
                if (chan[0][b] > (ts - this.expiry)) break
            if (b) {
                chan[0] = chan[0].slice(b)
                chan[1] = chan[1].slice(b)
                chan[2] = chan[2].slice(b)
            }
        }
        setTimeout(this.removeExpired.bind(this, name), Math.floor(this.expiry / 2))
    },
})