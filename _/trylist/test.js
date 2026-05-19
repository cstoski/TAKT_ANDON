// Test for Trylist
'use strict'

const trylist = require('../trylist'),
    path = require('path'),
    fs = require('fs'),
    count = 1

function randomBranch(level){
    const j=Math.random()*5
    if (j < 1 || level < 1) return Math.random()
    const obj = {}
    for (var i=0; i<j; i++) obj['p'+i] = randomBranch(level - 1)
    return obj
}

;(async ()=>{
    const DATA = await new trylist('mytree')
    console.log(DATA)
    var increment = 0
    test()
    
    function test(){
        DATA.patricia.menjao['s'+increment++] = randomBranch(5)
        setTimeout(test, 1000)
    }
})()

/*
const tree = {
    "plant": {
        "s123": {
            "name": "Curitiba",
            "description": "The Plant at Curitiba",
            "line": {
                '1': {
                    "id": 1,
                    "name": "linha1",
                    "andon": {
                        "01": {
                            "name": "Pre-production",
                            "stations": [
                                "s1"
                            ]
                        }
                    },
                    "station": {
                        "s1": {
                            "name": "Station 1",
                            "status": "offline"
                        },
                        "s2": {
                            "name": "Station 2",
                            "status": "online"
                        },
                        "s3": {
                            "name": "Station 1",
                            "status": "offsite"
                        }
                    }
                }
            }
        }
    }
}

;(async ()=>{
    var DATA = await new trylist('mytree', tree)
    if (DATA instanceof Error) { console.log(DATA); return }

    const partial = DATA.plant.chrisPlant.description
    
    const arr = []
    for (var i=0; i<10; i++) arr[i] = Math.random()
    partial.hey.you.are.random = arr

    partial.hey.you.are.cool = "This is a new Chris plant."
    
    for (var i=0, j=0, currentMs = 0, subMs = 0, start=Date.now(); i<count; i++) {
        const now = Date.now()
        if (now !== currentMs) { currentMs = now; subMs = 0 } else subMs++
        const subMsStr = ''+subMs,
            subMsPad = '0'.repeat(3 - subMsStr.length) + subMsStr
        fs.writeFile(path.join(__dirname, 'snapshots', currentMs + '-' + subMsPad + '.json'), trylist.stringify(DATA, 2)+'\n', (error)=>{
            if (error) return console.log(error)
            if (++j === count) {
                const seconds = (Date.now() - start) / 1000
                console.log(`Wrote ${count} files in ${seconds.toFixed(4)} seconds at ${(count / seconds).toFixed(2)} snapshots/second.`)
                //trylist.stringify(DATA, 2)
                //console.log(`Stringified ${count} trees in ${seconds.toFixed(4)} seconds at ${(count / seconds).toFixed(2)} trees/second.`)
            }
        })
    }
    
    console.log()
})()
*/