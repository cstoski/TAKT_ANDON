'use strict'

const path = require('path'),
    folder = path.join(__dirname, 'logs'),
    sura = require('./sura'),
    EVENT = new sura('perkins-plc-events', folder),
    events = 50000,
    testevent = {
        hello: 'World!',
        are: {
            you: 'really',
            there: 'yes!',
        },
        5: 'FIVE',
        randoms: {},
    }

setTimeout(async ()=>{
    for (var a=0; a<events; a++) {
        for (var i=0; i<10; i++) testevent.randoms['param'+i] = Math.random()
        //console.log(await EVENT.write(testevent))
        await EVENT.write(testevent)
    }
    const start = Date.now(),
        results = await EVENT.query({ start: 'today', end: 'now', inclusive: false, limit:5000 }),
        elapsed = Date.now() - start
    console.log('Events:', results.length, 'Elapsed', (elapsed/1000).toFixed(2), 's', '|', (results.length / elapsed * 1000).toFixed(1), '/sec')
}, 0)
