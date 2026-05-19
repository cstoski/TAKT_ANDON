//TAKTTIME - Perkins Andon Windows Service Installer
'use strict'

const path = require('path'),
    nodeWindows = require('node-windows'),
    svc = new nodeWindows.Service({
        name: 'Perkins TaktTime 2',
        description: 'Andon system for Perkins Curitiba, Brasil facility.',
        script: path.join(__dirname, 'index.js'),
        nodeOptions: ['--harmony', '--max_old_space_size=4096'],
    })

svc.on('install', ()=>{ showStatus(); svc.start() });
svc.on('uninstall', ()=>{ showStatus() });

const command = process.argv[2]

switch (command) {
    case 'install': svc.install(); break
    case 'uninstall': svc.uninstall(); break
    default: console.log('Unknown command:', command)
}

function showStatus(){
    console.log('Perkins TaktTime service status:', svc.exists)
}
