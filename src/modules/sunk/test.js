const sunk = new (require('.'))(5000, 7)
sunk.createChannel('test')

var i=0
looper()

function looper () {
    sunk.queue('test', { msg: i, text: "Hello World!" })
    if (i++ < 15) setTimeout(looper, 1000)
    else {
        while (1) {
            var read = sunk.read('test', read ? read.lastTimestamp : 0, read ? read.lastSequence : 0)
            debugger
        }        
    }
}
