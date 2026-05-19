// TAKT TIME v1
'use strict'
var isBrowser
if (typeof window !== 'undefined') isBrowser = true
else { global.window = global.document = {}; /* global.navigator = { appName: 'Mozilla' } */ }

;(function(){

var messageCount = 0

if (isBrowser) {
    const pools = {},
        scheme = location.protocol === 'https:' ? 'wss://' : 'ws://'

    var maxConnections = 5,
        lastMessageTimestamp = Date.now()

    window.Transport = {
        settings: function (connections, expires) {
            if (!isNaN(connections)) maxConnections = connections
            //if (!isNaN(expires)) hashExpiry = expires
        },
        set: function set (options) {
            if (!options.url) return
            if (pools[options.url]) this.remove(options.url)
            pools[options.url] = new Host(options)
        },
        remove: function remove (url) {
            const obj = pools[url]
            if (!obj || !Array.isArray(obj.sockets)) return
            for (var i = 0, j = obj.sockets.length; i < j; i++) {
                const it = obj.sockets[i]
                if (it) {
                    it.reconnect = false;
                    it.close()
                }
            }
            delete pools[url]
        },
        removeSecure: function () {
            for (var url in pools) if (pools[url].endpoint === '/secure' || pools[url].endpoint.startsWith('/secure/')) Transport.remove(url)
        },
        timebeat: async function timebeat (url, data) {
            if (!(pools[url] instanceof Host)) return
            const ws = await pools[url].queue(true)
            ws.sendSimple(''+data)
            ws.obj.release(ws)
        },
        send: async function send (url, data) {
            if (!(pools[url] instanceof Host)) return
            const ws = await pools[url].queue(true)
            ws.sendMessage(data)
            ws.obj.release(ws)
        },
        since: function since (url, then, now) {
            if (!(pools[url] instanceof Host)) return 0
            const ret = ((now instanceof Date) ? now.getTime() : !isNaN(now) ? now : Date.now()) - pools[url].timeShift - ((then instanceof Date) ? then.getTime() : !isNaN(then) ? then : 0)
            return ret
        },
    }
        
    function Host (options) {
        this.connect = function connect (slot, resolve, isReconnecting) {
            const ws = new WebSocket(scheme + this.url)
            if (!ws) return onerror.call({ obj: this })
            ws.obj = this
            ws.binaryType = 'arraybuffer'
            ws.rsaKey_private_local = ws.obj.rsaKey_private_local
            ws.rsaKey_public_local = ws.obj.rsaKey_public_local
            ws.reconnect = true
            const urlparts = ws.obj.url.split('?')
            this.endpoint = '/' + urlparts[0].split('/', 2)[1]
            this.querystring = urlparts[1]
            this.isReconnecting = isReconnecting
            this.count++
            if (!this.timestamp) this.timestamp = Date.now()
            console.log('CONNECTIONS:', this.count)
            if (!isNaN(slot)) this.sockets[slot] = ws
            else this.sockets.push(ws)

            ws.onopen = async function onopen () {
                if (this.readyState !== 1) return console.log('READYSTATE', Date.now())
                this.send(this.rsaKey_public_local)
            }

            ws.onmessage = function onmessage (event) {
                var data = event.data
                if (!data) return

                //const start = Date.now()

                if (!this.channelID_string) {
                    if (!initiateChannel(undefined, this, data)) console.log('Failed SecurePromise')
                    return
                }
                if (!this.aesKey_remote) {
                    if (!initiateSecret(undefined, this, data)) return console.log('Failed SecretPromise')
                    this.sendSimple(uuid ? JSON.stringify({ authenticate: 1, uuid, secret }) : ''+Date.now())
                    if (!uuid) this.obj.callback()
                    return
                }

                const plaintext = this.aesKey_local.decrypt(data)
                //
                //const now = Date.now()
                //console.log('+'.repeat(Math.max(0, Math.floor((now - lastMessageTimestamp) - 800) / 3))+plaintext.length)
                //lastMessageTimestamp = now
                //console.log('RECEIVED:', Date.now(), plaintext.length === 13 ? plaintext : plaintext.length)
                //
                if (plaintext instanceof Object) {
                    const blob = new Blob([plaintext], {type: "octet/stream"}),
                        url = window.URL.createObjectURL(blob),
                        a = document.createElement('a')
                    a.style = 'display: none'
                    a.href = url
                    a.download = window.transport_DOWNLOAD
                    document.body.appendChild(a)
                    a.click()
                    window.URL.revokeObjectURL(url)
                }
                else {
                    const plaintext0 = plaintext[0],
                    plaintext_ = plaintext[plaintext.length - 1]
                    if ((plaintext0 === '[' && plaintext_ === ']') || (plaintext0 === '{' && plaintext_ === '}')) {
                        try { var message = JSON.parse(plaintext) } catch(e) { return console.log('COULD NOT PARSE:', plaintext) }
                        if (!(message instanceof Object)) return console.log('BAD MESSAGE:', message)
                        if (!Array.isArray(message)) message = [message]
                        if (!message.length) return console.log('EMPTY MESSAGE:', message)
                        
                        for (var i=0, j=message.length; i<j; i++ ) {
                            if (typeof message[i] === 'string') {
                                try { message[i] = JSON.parse(message[i]) }
                                catch(e) { message[i] = undefined; continue }
                            }

                            /*
                            if (i < j - 1) {
                                if (message[i].timestamp) {
                                    if (this.obj.timestamp < message[i].timestamp) this.obj.timestamp = message[i].timestamp
                                    else if (message[i].timestamp < this.obj.timestamp) {
                                        //console.log('OLDER:', this.obj.timestamp, message[i].timestamp)
                                        if (message[i].timestamp < this.obj.timestamp) { message[i] = undefined; continue }
                                    }
                                }
                                //else console.log('NO TIMESTAMP')
                            }
                            */

                            if ('authenticated' in message[i]) {
                                if (message[i].authenticated === 2) {
                                    this.authenticated = message[i].authenticated
                                    this.sendSimple(''+Date.now())
                                    this.obj.callback(message[i].user)
                                }
                                else this.obj.callback(null)
                                message[i] = undefined
                                continue
                            }
                            /*
                            if (message[i].dashboard2 && message[i].dashboard2.times && message[i].dashboard2.times.datetime) {
								const now = Date.now(),
									diff = Math.floor(((now - lastMessageTimestamp) - 650) / 3),
									hour = (''+(message[i].dashboard2).times.datetime.hour).padStart(2,'0'),
									minute = (''+(message[i].dashboard2).times.datetime.minute).padStart(2,'0'),
									second = (''+(message[i].dashboard2).times.datetime.second).padStart(2,'0')
								//console.log(`${'+'.repeat(Math.max(0, diff))} ${now - lastMessageTimestamp} - ${hour}:${minute}:${second}`)
								lastMessageTimestamp = now
                            }
                            */
                        }
                        const last = message[message.length-1]
                        if (last instanceof Object && last.lastTimestamp !== undefined) {
                            this.obj.lastTimestamp = last.lastTimestamp
                            this.obj.lastSequence = last.lastSequence
                            message.length--
                        }
                        if ((last instanceof Object) ? !this.obj.handler(message, last.expiredTimestamp) && last.remaining : !this.obj.handler(message, 0)) this.sendMessage()
                    } else if (!isNaN(+plaintext0)) {
                        if (plaintext0 !== '0') this.sendMessage()
                        this.obj.timeShift = Date.now() - +plaintext
                    }
                }
            }

            ws.onerror = function onerror (error) {
                this.error = error
                if (this.obj.errorCallback instanceof Function) this.obj.errorCallback(TEXT.phrase_establishing_connection, 'orange')
            }
            
            ws.onclose = function onclose (info) {
                console.log(this.obj.url, 'WebSocket disconnected:')
                this.obj.count--
                console.log('WS REMAINING:', this.obj.count)
                if (!this.obj.count && this.reconnect) {
                    const that = this
                    setTimeout(()=>that.obj.connect(this.obj.sockets.indexOf(that), resolve, true), 1500)
                }
            }
            
            ws.sendSimple = function sendSimple (data) {
                //console.log(++messageCount, '--------------', Date.now())
                if (!this.aesKey_remote || this.readyState !== 1) return console.log('FAILED CONNECTION', Date.now())
                this.send(this.aesKey_remote.encrypt(data))
                //
            }

            ws.sendMessage = function sendMessage (messages) {
                if (!this.aesKey_remote || this.readyState !== 1) return
                this.heartbeat()
                messages = Array.isArray(messages) ? messages.slice(0): (typeof messages === 'undefined') ? [] : [messages]
                messages.unshift({ lastTimestamp: this.obj.lastTimestamp, lastSequence: this.obj.lastSequence, max: 50 })
                messages = JSON.stringify(messages)
                this.sendSimple(messages)
            }

            ws.heartbeat = function (beat) {
                clearTimeout(this.timeout)
                this.timeout = setTimeout(this.heartbeat.bind(this, true), 25000)
                if (this.readyState === 1 && beat) this.send('')
            }
            ws.heartbeat()

            return ws
        }

        this.queue = function queue (get) {
            var ws
            for (var i = 0, j = Math.max(this.sockets.length, Math.min(maxConnections, this.resolve.length)); i < j && (get ? !ws || ws.busy : !ws); i++) {
                if (!ws || this.resolve.length) ws = (!this.sockets[i] || this.sockets[i].readyState !== 1) ? this.connect(i) : this.sockets[i]
            }
            if (get) {
                const promise = (ws && !ws.busy) ? Promise.resolve(ws) : new Promise(resolve => this.resolve.push(resolve))
                if (ws) ws.busy = true
                return promise
            }
            else if (this.resolve.length) {
                if (ws) this.resolve.shift()(ws)
                //setImmediate(this.queue.bind(this))
            }
        }

        this.release = function release (ws) {
            delete ws.busy
            this.queue()
        }

        const uuid = options.uuid
        const secret = options.secret
        var messagesReceived = 0

        this.count= 0
        this.lastTimestamp= 0
        this.lastSequence= 0
        this.url = options.url
        this.handler = options.handler
        this.callback = options.callback
        this.errorCallback = options.error
        this.timeShift = 0
        this.sockets = []
        this.resolve = []
        this.rsaKey_private_local = new Signa.RSAKey(1024)
        this.rsaKey_public_local = this.rsaKey_private_local.getPublicKey()
        this.connect(undefined, options.resolve)
    }
}
else {
    module.exports = Transport

    const fs = require('fs'),
        path = require('path'),
        websocket = require('ws'),
        protocol = require('http'),
        sunk = new (require('../sunk'))(10 * 1000, 1000),
        AD = new (require('activedirectory2'))
		({ url: 'ldap://B8WPBLDCP01', baseDN: 'ou=Administrators,ou=Users,ou=Administation,dc=brazil,dc=cat,dc=com'			
		}),
        blacklist = {},
        connections = {},
        mimeTypes = {'': 'application/octet-stream', '.svg': 'image/svg+xml', '.c': 'text/plain', '.appcache':'text/cache-manifest', '.json': 'application/manifest+json', '.obj': 'application/octet-stream', '.ra': 'audio/x-pn-realaudio', '.wsdl': 'application/xml', '.dll': 'application/octet-stream', '.ras': 'image/x-cmu-raster', '.ram': 'application/x-pn-realaudio', '.bcpio': 'application/x-bcpio', '.sh': 'application/x-sh', '.m1v': 'video/mpeg', '.xwd': 'image/x-xwindowdump', '.doc': 'application/msword', '.bmp': 'image/x-ms-bmp', '.shar': 'application/x-shar', '.js': 'application/x-javascript', '.src': 'application/x-wais-source', '.dvi': 'application/x-dvi', '.aif': 'audio/x-aiff', '.ksh': 'text/plain', '.dot': 'application/msword', '.mht': 'message/rfc822', '.p12': 'application/x-pkcs12', '.css': 'text/css', '.csh': 'application/x-csh', '.pwz': 'application/vnd.ms-powerpoint', '.pdf': 'application/pdf', '.cdf': 'application/x-netcdf', '.pl': 'text/plain', '.ai': 'application/postscript', '.jpe': 'image/jpeg', '.jpg': 'image/jpeg', '.py': 'text/x-python', '.xml': 'text/xml', '.jpeg': 'image/jpeg', '.ps': 'application/postscript', '.gtar': 'application/x-gtar', '.xpm': 'image/x-xpixmap', '.hdf': 'application/x-hdf', '.nws': 'message/rfc822', '.tsv': 'text/tab-separated-values', '.xpdl': 'application/xml', '.p7c': 'application/pkcs7-mime', '.eps': 'application/postscript', '.ief': 'image/ief', '.so': 'application/octet-stream', '.xlb': 'application/vnd.ms-excel', '.pbm': 'image/x-portable-bitmap', '.texinfo': 'application/x-texinfo', '.xls': 'application/vnd.ms-excel', '.tex': 'application/x-tex', '.rtx': 'text/richtext', '.html': 'text/html', '.aiff': 'audio/x-aiff', '.aifc': 'audio/x-aiff', '.exe': 'application/octet-stream', '.sgm': 'text/x-sgml', '.tif': 'image/tiff', '.mpeg': 'video/mpeg', '.ustar': 'application/x-ustar', '.gif': 'image/gif', '.ppt': 'application/vnd.ms-powerpoint', '.pps': 'application/vnd.ms-powerpoint', '.sgml': 'text/x-sgml', '.ppm': 'image/x-portable-pixmap', '.latex': 'application/x-latex', '.bat': 'text/plain', '.mov': 'video/quicktime', '.ppa': 'application/vnd.ms-powerpoint', '.tr': 'application/x-troff', '.rdf': 'application/xml', '.xsl': 'application/xml', '.eml': 'message/rfc822', '.nc': 'application/x-netcdf', '.sv4cpio': 'application/x-sv4cpio', '.bin': 'application/octet-stream', '.h': 'text/plain', '.tcl': 'application/x-tcl', '.wiz': 'application/msword', '.o': 'application/octet-stream', '.a': 'application/octet-stream', '.c': 'text/plain', '.wav': 'audio/x-wav', '.vcf': 'text/x-vcard', '.xbm': 'image/x-xbitmap', '.txt': 'text/plain', '.au': 'audio/basic', '.t': 'application/x-troff', '.tiff': 'image/tiff', '.texi': 'application/x-texinfo', '.oda': 'application/oda', '.ms': 'application/x-troff-ms', '.rgb': 'image/x-rgb', '.me': 'application/x-troff-me', '.sv4crc': 'application/x-sv4crc', '.qt': 'video/quicktime', '.mpa': 'video/mpeg', '.mpg': 'video/mpeg', '.mpe': 'video/mpeg', '.avi': 'video/x-msvideo', '.pgm': 'image/x-portable-graymap', '.pot': 'application/vnd.ms-powerpoint', '.mif': 'application/x-mif', '.roff': 'application/x-troff', '.htm': 'text/html', '.man': 'application/x-troff-man', '.etx': 'text/x-setext', '.zip': 'application/zip', '.movie': 'video/x-sgi-movie', '.pyc': 'application/x-python-code', '.png': 'image/png', '.pfx': 'application/x-pkcs12', '.mhtml': 'message/rfc822', '.tar': 'application/x-tar', '.pnm': 'image/x-portable-anymap', '.pyo': 'application/x-python-code', '.snd': 'audio/basic', '.cpio': 'application/x-cpio', '.swf': 'application/x-shockwave-flash', '.mp3': 'audio/mpeg', '.mp2': 'audio/mpeg', '.mp4': 'video/mp4', '.woff': 'application/font-woff'}
        
    var settings,
        users,
        messagesReceived = 0

    function Transport (settingsObj, usersObj) {
        settings = settingsObj
        users = usersObj
    }
    Object.assign(Transport, {
        loadServer,
        broadcastMessage,
        getUsers,
        getRole,
        getFirstname,
        getLastname,
        getEmail,
        passwordsMatch,
    })

    function getUsers () {
        if (!(users instanceof Object)) return {}
        const uu = users.$$
        for (var user in uu) uu[user] = [true, uu[user].firstname, uu[user].lastname]
        return uu
    }

    function getRole (user) {
        if (typeof user !== 'string') return
        if (users[user] instanceof Object) return users[user].role
    }

    function getFirstname (user) {
        if (typeof user !== 'string') return
        if (users[user] instanceof Object) return users[user].firstname
    }

    function getLastname (user) {
        if (typeof user !== 'string') return
        if (users[user] instanceof Object) return users[user].lastname
    }

    function getEmail (user) {
        if (typeof user !== 'string') return
        if (users[user] instanceof Object) return users[user].email
    }

    function passwordsMatch (user, password) {
        if (typeof user !== 'string' || !password) return Promise.resolve()
        const user_lower = user.toLowerCase()
        if (users[user_lower] instanceof Object && !users[user_lower].activeDirectory) return Promise.resolve(users[user_lower].password === password)
        var resolve
        var found = false
        const promise = new Promise((res,rej)=>{ resolve = res })
        if (settings.simulateActiveDirectory) {
            for (var match in users) {
                if (user_lower === match.toLowerCase()) {
                    if (!(users[user_lower] instanceof Object) || !users[user_lower].uuid) delete users[user_lower]
                    else {
                        found = true
                        break
                    }
                }
            }
            if (!found) {
                users[user_lower] = { uuid: user_lower, activeDirectory: true, role: 7 }
                Transport.updateUsers(users[user_lower])
            }
            users[user_lower].password = password
	    resolve(true)
        }
        else {
            const timeout = setTimeout(resolve, settings.ActiveDirectoryTimeout || 8000)
            try {
                AD.authenticate(user + '@brazil.cat.com', password, (error, auth)=>{
                    clearTimeout(timeout)
                    if (error || !auth) return resolve()
                    for (var match in users) {
                        if (user_lower === match.toLowerCase()) {
                            if (!(users[user_lower] instanceof Object) || !users[user_lower].uuid) delete users[user_lower]
                            else {
                                found = true
                                break
                            }
                        }
                    }
                    if (!found) {
                        users[user_lower] = { uuid: user_lower, activeDirectory: true, role: 7 }
                        Transport.updateUsers(users[user_lower])
                    }
                    users[user_lower].password = password
	    	    resolve(true)
                })
            } catch (e) { resolve() }
        }
        return promise
    }

    async function loadServer () {
        const ret = Promise.resolve()
        if (Transport.server) { Transport.server.close(()=>{ Transport.server = undefined; loadServer() }); return ret }
        Transport.server = protocol.createServer(null, onRequest)
        Transport.server.on('upgrade', onServerUpgrade)
        Transport.server.listen(settings.port || 8080)
        const rsaKey = new Signa.RSAKey(1024)
        const WS = new websocket.Server({ server: Transport.server })
        WS.on('connection', onWSConnection.bind(undefined, rsaKey, rsaKey.getPublicKey()))
        return ret
    }

    async function onRequest (request, response) {
        if (blacklist[request.socket.remoteAddress]) return
        urlParse(request)
        const [endpoint, query] = request.url.split('?', 2),
            isEndpoint = settings.endpoints.indexOf(endpoint) > -1,
            filename = isEndpoint ? settings.indexFile : endpoint.substring(1) || settings.indexFile,
            file_location = filename.startsWith('reports/')
                ? path.join(__dirname, settings.reports, filename.split('reports/')[1].replace('.xlsm', '-'+query+'.xlsm'))
                : path.join(__dirname, filename)
        fs.readFile(file_location, (error, data)=>{
            if (error) {
                response.writeHead(404, { 'Cache-Control': 'no-cache, max-age=0' })
                response.end()
            } else {
                response.writeHead(200, {
                    'Content-type': isEndpoint ? 'text/html' : file_location.endsWith('.xlsm') ? 'application/vnd.ms-excel.sheet.macroEnabled.12' : request.mimeType,
                    'Cache-Control': 'no-cache, max-age=0',
                    'Pragma': 'no-cache',
                })
                response.end(data)
            }
        })
    }

    function onServerUpgrade (request, socket, headers) {
        if (blacklist[socket.remoteAddress]) return socket.destroy()
        urlParse(request)
    }

    function onWSError (request, event) {
        console.log('WS ERROR:', event.toString())
    }
    function onWSClose (request, event) {
        if (!connections[this.channelID_string]) return
        delete connections[this.channelID_string][this.connectionID]
    }

    async function onWSConnection (rsaKey, rsaPublicKey, ws, request) {
        ws.sendSimple = sendSimple
        ws.sendMessage = sendMessage
        ws.broadcastMessage = broadcastMessage
        ws.rsaKey_private_local = rsaKey
        ws.rsaKey_public_local = rsaPublicKey
        ws._socket.setNoDelay(true)
        ws.messagesSent = 0
        ws.on('error', onWSError.bind(ws, request))
        ws.on('close', onWSClose.bind(ws, request))
        ws.on('message', onWSMessage.bind(ws, request))
        ws.on('pong', onWSPong.bind(ws, request))
        if (ws.readyState !== 1) return
        ws.send(ws.rsaKey_public_local)
    }

    async function onWSMessage (request, data) {
        if (!data) return
        if (!this.channelID_string) {
            if (!initiateChannel(request, this, data)) console.log('Failed SecurePromise')
            return
        }
        if (!this.aesKey_remote) {
            if (!initiateSecret(request, this, data)) return console.log('Failed SecretPromise')
            this.connectionID = (''+Math.random()).substring(2)
            if (!connections[this.channelID_string]) connections[this.channelID_string] = {}
            connections[this.channelID_string][this.connectionID] = this
            sunk.createChannel(this.channelID_string)
            return this.sendSimple(''+Date.now())
        }

        //
        //const now = Date.now()
        //console.log('+'.repeat(Math.max(0, (Math.floor(((now - lastMessageTimestamp) - 800) / 3)))))
        //lastMessageTimestamp = now
        //

        const plaintext = this.aesKey_local.decrypt(data)
        //console.log(new Date().toString(), ++messagesReceived, 'DECRYPTED:', plaintext)

        if (!isNaN(+plaintext[0])) return //this.sendSimple('0'+Date.now())
        
        if (this.readyState !== 1) return
                
        try { var message = JSON.parse(plaintext) } catch(e) { return }
        if (!Array.isArray(message)) message = [message]

        var queued = [],
            read = {},
            debug_flag
        for (var m in message) {
            var messagem = message[m]
            if (!messagem) continue
            if (!(messagem instanceof Object)) try { messagem = JSON.parse(messagem) } catch(e) { continue }
            if (m === '0' && 'lastTimestamp' in messagem) { message[0] = messagem; continue }

            if (messagem.authenticate) {
              const uuid_lower = messagem.uuid.toLowerCase()
                if (await passwordsMatch(uuid_lower, messagem.secret)) {
                    this.uuid = uuid_lower
                    console.log('LOGIN BY:', this.uuid)
                    this.sendSimple(JSON.stringify({
                        authenticated: 2,
                        user: {
                            uuid: this.uuid,
                            role: this.role = getRole(this.uuid),
                            firstname: getFirstname(this.uuid),
                            lastname: getLastname(this.uuid),
                            email: getEmail(this.uuid),
                        }
                    }))
                }
                else this.sendSimple(JSON.stringify({ authenticated: 0, user: { uuid: messagem.uuid } }))
                continue
            }
            
            else if (messagem.debug) {
                const date = new Date()
                debug_flag = true
                fs.appendFile(
                    `${__dirname}/logs/debug-${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}.log`,
                    `${date.toString()} ${this.channelID_string.substring(0, 8)} ${JSON.stringify(message)}\n`,
                    ()=>{}
                )
                continue
            }
            
            if (messagem.form && Array.isArray(messagem.form.fields)) {
                for (var i in queued) {
                    for (var a in queued[i].update) {
                        if (messagem.form.fields.indexOf(queued[i].update[a][0]) > -1) delete messagem.form.fields[pos]
                    }
                }
            }
            if (Transport.onHandler instanceof Function) {
                const event = await Transport.onHandler.call(this, messagem, (+m === message.length - 1) ? false : true)
                if (event) sunk.queue(this.channelID_string, event)
            }
        }
        if (debug_flag) return
        if (!('lastTimestamp' in message[0])) return
        read = sunk.read(this.channelID_string, message[0].lastTimestamp, message[0].lastSequence, message[0].max)
        //
        //if (read.queue.length > 1) {
            //for (var x in read.queue) console.log(read.queue[x])
        //    read.queue = read.queue.slice(read.queue.length - 1)
        //}
        //
        read.queue.push({
            expiredTimestamp: read.expiredTimestamp,
            lastTimestamp: read.lastTimestamp || 0,
            lastSequence: read.lastSequence || 0,
            remaining: read.remaining || 0,
        })
        this.sendSimple(JSON.stringify(read.queue))
    }

    function banned (ws) {
        blacklist[ws._socket.remoteAddress] = true
        setTimeout(()=>{ delete blacklist[ws._socket.remoteAddress] }, settings.blacklistTimeout)
        if (ws.readyState === 1) ws.send(String.fromCharCode(Math.min(255, Math.ceil(settings.blacklistTimeout/1000))))
        console.log('NOT LOGGED IN, BANNED')
    }

    function onWSPong (request) {}

    function sendSimple (data) {
        if (!this.aesKey_remote || this.readyState !== 1) return
        this.send(this.aesKey_remote.encrypt(data))
        //console.log('M:', messageCount++)
        //console.log(++messageCount, '--------------', Date.now())
        if (++this.messagesSent >= 2000) this.close() //TODO: remove?
        return true
    }

    function sendMessage (messages, isBuffering) {
        if (!Array.isArray(messages)) messages = [messages]
        if (messages[0] !== undefined) sunk.queue(this.channelID_string, messages)
        if (isBuffering || this.readyState !== 1) return isBuffering
        //
        //const now = Date.now()
        //console.log('+'.repeat(Math.max(0, Math.floor((now - lastMessageTimestamp) - 800) / 3)))
        //lastMessageTimestamp = now
        return this.sendSimple(''+Date.now()+' '.repeat(512))
    }

    function broadcastMessage (messages, isBuffering, permissionChecker, includeSender) {
        for (var i in connections) {
            for (var j in connections[i]) {
                const conn = connections[i][j]
                if (!includeSender && this.channelID_string === conn.channelID_string) break
                if (!(!permissionChecker || permissionChecker(getRole(conn.uuid)))) break
                if (!conn.sendMessage(messages, isBuffering)) delete connections[i][j]
                else break
            }
        }
    }

    function urlParse(request) {
        request.url = decodeURI(request.url)
        const urlparts = request.url.split('?'),
            fileparts = urlparts[0].split('.')
        request.endpoint = urlparts[0]
        request.querystring = urlparts[1]
        request.mimeType = (mimeTypes[fileparts.length > 1 ? '.'+fileparts[fileparts.length-1] : urlparts[0].endsWith('/') ? '.html' : '']) || ''
    }

}

function initiateChannel (request, ws, data) {
    ws.channelID = new Signa.RSAKey
    ws.channelID.setPublicKey(data)
    ws.channelID_string = String.fromCharCode.apply(undefined, new Uint8Array(ws.channelID.publicKey))
    ws.aesKey_local = new Signa.AESKey(256)
    const cipher = ws.channelID.encrypt(ws.aesKey_local.key)
    if (ws.readyState !== 1) return
    ws.send(cipher)
    return ws.channelID_string
}

function initiateSecret (request, ws, data) {
    const decrypt_local = ws.rsaKey_private_local.decrypt(data, 1)
    ws.aesKey_remote = new Signa.AESKey(decrypt_local)
    return ws.aesKey_remote
}







// Copyright (c) 2005  Tom Wu
// All Rights Reserved.
// See "LICENSE" for details.

// Basic JavaScript BN library - subset useful for RSA encryption.

// Bits per digit
var dbits;

// JavaScript engine analysis
var canary = 0xdeadbeefcafe;
var j_lm = ((canary&0xffffff)==0xefcafe);

// (public) Constructor
function BigInteger(a,b,c) {
  if(a != null)
    if("number" == typeof a) this.fromNumber(a,b,c);
    else if(b == null && "string" != typeof a) this.fromString(a,256);
    else this.fromString(a,b);
}

// return new, unset BigInteger
function nbi() { return new BigInteger(null); }

// am: Compute w_j += (x*this_i), propagate carries,
// c is initial carry, returns final carry.
// c < 3*dvalue, x < 2*dvalue, this_i < dvalue
// We need to select the fastest one that works in this environment.

// am1: use a single mult and divide to get the high bits,
// max digit bits should be 26 because
// max internal value = 2*dvalue^2-2*dvalue (< 2^53)
function am1(i,x,w,j,c,n) {
  while(--n >= 0) {
    var v = x*this[i++]+w[j]+c;
    c = Math.floor(v/0x4000000);
    w[j++] = v&0x3ffffff;
  }
  return c;
}
// am2 avoids a big mult-and-extract completely.
// Max digit bits should be <= 30 because we do bitwise ops
// on values up to 2*hdvalue^2-hdvalue-1 (< 2^31)
function am2(i,x,w,j,c,n) {
  var xl = x&0x7fff, xh = x>>15;
  while(--n >= 0) {
    var l = this[i]&0x7fff;
    var h = this[i++]>>15;
    var m = xh*l+h*xl;
    l = xl*l+((m&0x7fff)<<15)+w[j]+(c&0x3fffffff);
    c = (l>>>30)+(m>>>15)+xh*h+(c>>>30);
    w[j++] = l&0x3fffffff;
  }
  return c;
}
// Alternately, set max digit bits to 28 since some
// browsers slow down when dealing with 32-bit numbers.
function am3(i,x,w,j,c,n) {
  var xl = x&0x3fff, xh = x>>14;
  while(--n >= 0) {
    var l = this[i]&0x3fff;
    var h = this[i++]>>14;
    var m = xh*l+h*xl;
    l = xl*l+((m&0x3fff)<<14)+w[j]+c;
    c = (l>>28)+(m>>14)+xh*h;
    w[j++] = l&0xfffffff;
  }
  return c;
}
if(j_lm && (navigator.appName == "Microsoft Internet Explorer")) {
  BigInteger.prototype.am = am2;
  dbits = 30;
}
else if(j_lm && (navigator.appName != "Netscape")) {
  BigInteger.prototype.am = am1;
  dbits = 26;
}
else { // Mozilla/Netscape seems to prefer am3
  BigInteger.prototype.am = am3;
  dbits = 28;
}

BigInteger.prototype.DB = dbits;
BigInteger.prototype.DM = ((1<<dbits)-1);
BigInteger.prototype.DV = (1<<dbits);

var BI_FP = 52;
BigInteger.prototype.FV = Math.pow(2,BI_FP);
BigInteger.prototype.F1 = BI_FP-dbits;
BigInteger.prototype.F2 = 2*dbits-BI_FP;

// Digit conversions
var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
var BI_RC = new Array();
var rr,vv;
rr = "0".charCodeAt(0);
for(vv = 0; vv <= 9; ++vv) BI_RC[rr++] = vv;
rr = "a".charCodeAt(0);
for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
rr = "A".charCodeAt(0);
for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;

function int2char(n) { return BI_RM.charAt(n); }
function intAt(s,i) {
  var c = BI_RC[s.charCodeAt(i)];
  return (c==null)?-1:c;
}

// (protected) copy this to r
function bnpCopyTo(r) {
  for(var i = this.t-1; i >= 0; --i) r[i] = this[i];
  r.t = this.t;
  r.s = this.s;
}

// (protected) set from integer value x, -DV <= x < DV
function bnpFromInt(x) {
  this.t = 1;
  this.s = (x<0)?-1:0;
  if(x > 0) this[0] = x;
  else if(x < -1) this[0] = x+this.DV;
  else this.t = 0;
}

// return bigint initialized to value
function nbv(i) { var r = nbi(); r.fromInt(i); return r; }

// (protected) set from string and radix
function bnpFromString(s,b) {
  var k;
  if(b == 16) k = 4;
  else if(b == 8) k = 3;
  else if(b == 256) k = 8; // byte array
  else if(b == 2) k = 1;
  else if(b == 32) k = 5;
  else if(b == 4) k = 2;
  else { this.fromRadix(s,b); return; }
  this.t = 0;
  this.s = 0;
  var i = s.length, mi = false, sh = 0;
  while(--i >= 0) {
    var x = (k==8)?s[i]&0xff:intAt(s,i);
    if(x < 0) {
      if(s.charAt(i) == "-") mi = true;
      continue;
    }
    mi = false;
    if(sh == 0)
      this[this.t++] = x;
    else if(sh+k > this.DB) {
      this[this.t-1] |= (x&((1<<(this.DB-sh))-1))<<sh;
      this[this.t++] = (x>>(this.DB-sh));
    }
    else
      this[this.t-1] |= x<<sh;
    sh += k;
    if(sh >= this.DB) sh -= this.DB;
  }
  if(k == 8 && (s[0]&0x80) != 0) {
    this.s = -1;
    if(sh > 0) this[this.t-1] |= ((1<<(this.DB-sh))-1)<<sh;
  }
  this.clamp();
  if(mi) BigInteger.ZERO.subTo(this,this);
}

// (protected) clamp off excess high words
function bnpClamp() {
  var c = this.s&this.DM;
  while(this.t > 0 && this[this.t-1] == c) --this.t;
}

// (public) return string representation in given radix
function bnToString(b) {
  if(this.s < 0) return "-"+this.negate().toString(b);
  var k;
  if(b == 16) k = 4;
  else if(b == 8) k = 3;
  else if(b == 2) k = 1;
  else if(b == 32) k = 5;
  else if(b == 4) k = 2;
  else return this.toRadix(b);
  var km = (1<<k)-1, d, m = false, r = "", i = this.t;
  var p = this.DB-(i*this.DB)%k;
  if(i-- > 0) {
    if(p < this.DB && (d = this[i]>>p) > 0) { m = true; r = int2char(d); }
    while(i >= 0) {
      if(p < k) {
        d = (this[i]&((1<<p)-1))<<(k-p);
        d |= this[--i]>>(p+=this.DB-k);
      }
      else {
        d = (this[i]>>(p-=k))&km;
        if(p <= 0) { p += this.DB; --i; }
      }
      if(d > 0) m = true;
      if(m) r += int2char(d);
    }
  }
  return m?r:"0";
}

// (public) -this
function bnNegate() { var r = nbi(); BigInteger.ZERO.subTo(this,r); return r; }

// (public) |this|
function bnAbs() { return (this.s<0)?this.negate():this; }

// (public) return + if this > a, - if this < a, 0 if equal
function bnCompareTo(a) {
  var r = this.s-a.s;
  if(r != 0) return r;
  var i = this.t;
  r = i-a.t;
  if(r != 0) return (this.s<0)?-r:r;
  while(--i >= 0) if((r=this[i]-a[i]) != 0) return r;
  return 0;
}

// returns bit length of the integer x
function nbits(x) {
  var r = 1, t;
  if((t=x>>>16) != 0) { x = t; r += 16; }
  if((t=x>>8) != 0) { x = t; r += 8; }
  if((t=x>>4) != 0) { x = t; r += 4; }
  if((t=x>>2) != 0) { x = t; r += 2; }
  if((t=x>>1) != 0) { x = t; r += 1; }
  return r;
}

// (public) return the number of bits in "this"
function bnBitLength() {
  if(this.t <= 0) return 0;
  return this.DB*(this.t-1)+nbits(this[this.t-1]^(this.s&this.DM));
}

// (protected) r = this << n*DB
function bnpDLShiftTo(n,r) {
  var i;
  for(i = this.t-1; i >= 0; --i) r[i+n] = this[i];
  for(i = n-1; i >= 0; --i) r[i] = 0;
  r.t = this.t+n;
  r.s = this.s;
}

// (protected) r = this >> n*DB
function bnpDRShiftTo(n,r) {
  for(var i = n; i < this.t; ++i) r[i-n] = this[i];
  r.t = Math.max(this.t-n,0);
  r.s = this.s;
}

// (protected) r = this << n
function bnpLShiftTo(n,r) {
  var bs = n%this.DB;
  var cbs = this.DB-bs;
  var bm = (1<<cbs)-1;
  var ds = Math.floor(n/this.DB), c = (this.s<<bs)&this.DM, i;
  for(i = this.t-1; i >= 0; --i) {
    r[i+ds+1] = (this[i]>>cbs)|c;
    c = (this[i]&bm)<<bs;
  }
  for(i = ds-1; i >= 0; --i) r[i] = 0;
  r[ds] = c;
  r.t = this.t+ds+1;
  r.s = this.s;
  r.clamp();
}

// (protected) r = this >> n
function bnpRShiftTo(n,r) {
  r.s = this.s;
  var ds = Math.floor(n/this.DB);
  if(ds >= this.t) { r.t = 0; return; }
  var bs = n%this.DB;
  var cbs = this.DB-bs;
  var bm = (1<<bs)-1;
  r[0] = this[ds]>>bs;
  for(var i = ds+1; i < this.t; ++i) {
    r[i-ds-1] |= (this[i]&bm)<<cbs;
    r[i-ds] = this[i]>>bs;
  }
  if(bs > 0) r[this.t-ds-1] |= (this.s&bm)<<cbs;
  r.t = this.t-ds;
  r.clamp();
}

// (protected) r = this - a
function bnpSubTo(a,r) {
  var i = 0, c = 0, m = Math.min(a.t,this.t);
  while(i < m) {
    c += this[i]-a[i];
    r[i++] = c&this.DM;
    c >>= this.DB;
  }
  if(a.t < this.t) {
    c -= a.s;
    while(i < this.t) {
      c += this[i];
      r[i++] = c&this.DM;
      c >>= this.DB;
    }
    c += this.s;
  }
  else {
    c += this.s;
    while(i < a.t) {
      c -= a[i];
      r[i++] = c&this.DM;
      c >>= this.DB;
    }
    c -= a.s;
  }
  r.s = (c<0)?-1:0;
  if(c < -1) r[i++] = this.DV+c;
  else if(c > 0) r[i++] = c;
  r.t = i;
  r.clamp();
}

// (protected) r = this * a, r != this,a (HAC 14.12)
// "this" should be the larger one if appropriate.
function bnpMultiplyTo(a,r) {
  var x = this.abs(), y = a.abs();
  var i = x.t;
  r.t = i+y.t;
  while(--i >= 0) r[i] = 0;
  for(i = 0; i < y.t; ++i) r[i+x.t] = x.am(0,y[i],r,i,0,x.t);
  r.s = 0;
  r.clamp();
  if(this.s != a.s) BigInteger.ZERO.subTo(r,r);
}

// (protected) r = this^2, r != this (HAC 14.16)
function bnpSquareTo(r) {
  var x = this.abs();
  var i = r.t = 2*x.t;
  while(--i >= 0) r[i] = 0;
  for(i = 0; i < x.t-1; ++i) {
    var c = x.am(i,x[i],r,2*i,0,1);
    if((r[i+x.t]+=x.am(i+1,2*x[i],r,2*i+1,c,x.t-i-1)) >= x.DV) {
      r[i+x.t] -= x.DV;
      r[i+x.t+1] = 1;
    }
  }
  if(r.t > 0) r[r.t-1] += x.am(i,x[i],r,2*i,0,1);
  r.s = 0;
  r.clamp();
}

// (protected) divide this by m, quotient and remainder to q, r (HAC 14.20)
// r != q, this != m.  q or r may be null.
function bnpDivRemTo(m,q,r) {
  var pm = m.abs();
  if(pm.t <= 0) return;
  var pt = this.abs();
  if(pt.t < pm.t) {
    if(q != null) q.fromInt(0);
    if(r != null) this.copyTo(r);
    return;
  }
  if(r == null) r = nbi();
  var y = nbi(), ts = this.s, ms = m.s;
  var nsh = this.DB-nbits(pm[pm.t-1]);	// normalize modulus
  if(nsh > 0) { pm.lShiftTo(nsh,y); pt.lShiftTo(nsh,r); }
  else { pm.copyTo(y); pt.copyTo(r); }
  var ys = y.t;
  var y0 = y[ys-1];
  if(y0 == 0) return;
  var yt = y0*(1<<this.F1)+((ys>1)?y[ys-2]>>this.F2:0);
  var d1 = this.FV/yt, d2 = (1<<this.F1)/yt, e = 1<<this.F2;
  var i = r.t, j = i-ys, t = (q==null)?nbi():q;
  y.dlShiftTo(j,t);
  if(r.compareTo(t) >= 0) {
    r[r.t++] = 1;
    r.subTo(t,r);
  }
  BigInteger.ONE.dlShiftTo(ys,t);
  t.subTo(y,y);	// "negative" y so we can replace sub with am later
  while(y.t < ys) y[y.t++] = 0;
  while(--j >= 0) {
    // Estimate quotient digit
    var qd = (r[--i]==y0)?this.DM:Math.floor(r[i]*d1+(r[i-1]+e)*d2);
    if((r[i]+=y.am(0,qd,r,j,0,ys)) < qd) {	// Try it out
      y.dlShiftTo(j,t);
      r.subTo(t,r);
      while(r[i] < --qd) r.subTo(t,r);
    }
  }
  if(q != null) {
    r.drShiftTo(ys,q);
    if(ts != ms) BigInteger.ZERO.subTo(q,q);
  }
  r.t = ys;
  r.clamp();
  if(nsh > 0) r.rShiftTo(nsh,r);	// Denormalize remainder
  if(ts < 0) BigInteger.ZERO.subTo(r,r);
}

// (public) this mod a
function bnMod(a) {
  var r = nbi();
  this.abs().divRemTo(a,null,r);
  if(this.s < 0 && r.compareTo(BigInteger.ZERO) > 0) a.subTo(r,r);
  return r;
}

// Modular reduction using "classic" algorithm
function Classic(m) { this.m = m; }
function cConvert(x) {
  if(x.s < 0 || x.compareTo(this.m) >= 0) return x.mod(this.m);
  else return x;
}
function cRevert(x) { return x; }
function cReduce(x) { x.divRemTo(this.m,null,x); }
function cMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }
function cSqrTo(x,r) { x.squareTo(r); this.reduce(r); }

Classic.prototype.convert = cConvert;
Classic.prototype.revert = cRevert;
Classic.prototype.reduce = cReduce;
Classic.prototype.mulTo = cMulTo;
Classic.prototype.sqrTo = cSqrTo;

// (protected) return "-1/this % 2^DB"; useful for Mont. reduction
// justification:
//         xy == 1 (mod m)
//         xy =  1+km
//   xy(2-xy) = (1+km)(1-km)
// x[y(2-xy)] = 1-k^2m^2
// x[y(2-xy)] == 1 (mod m^2)
// if y is 1/x mod m, then y(2-xy) is 1/x mod m^2
// should reduce x and y(2-xy) by m^2 at each step to keep size bounded.
// JS multiply "overflows" differently from C/C++, so care is needed here.
function bnpInvDigit() {
  if(this.t < 1) return 0;
  var x = this[0];
  if((x&1) == 0) return 0;
  var y = x&3;		// y == 1/x mod 2^2
  y = (y*(2-(x&0xf)*y))&0xf;	// y == 1/x mod 2^4
  y = (y*(2-(x&0xff)*y))&0xff;	// y == 1/x mod 2^8
  y = (y*(2-(((x&0xffff)*y)&0xffff)))&0xffff;	// y == 1/x mod 2^16
  // last step - calculate inverse mod DV directly;
  // assumes 16 < DB <= 32 and assumes ability to handle 48-bit ints
  y = (y*(2-x*y%this.DV))%this.DV;		// y == 1/x mod 2^dbits
  // we really want the negative inverse, and -DV < y < DV
  return (y>0)?this.DV-y:-y;
}

// Montgomery reduction
function Montgomery(m) {
  this.m = m;
  this.mp = m.invDigit();
  this.mpl = this.mp&0x7fff;
  this.mph = this.mp>>15;
  this.um = (1<<(m.DB-15))-1;
  this.mt2 = 2*m.t;
}

// xR mod m
function montConvert(x) {
  var r = nbi();
  x.abs().dlShiftTo(this.m.t,r);
  r.divRemTo(this.m,null,r);
  if(x.s < 0 && r.compareTo(BigInteger.ZERO) > 0) this.m.subTo(r,r);
  return r;
}

// x/R mod m
function montRevert(x) {
  var r = nbi();
  x.copyTo(r);
  this.reduce(r);
  return r;
}

// x = x/R mod m (HAC 14.32)
function montReduce(x) {
  while(x.t <= this.mt2)	// pad x so am has enough room later
    x[x.t++] = 0;
  for(var i = 0; i < this.m.t; ++i) {
    // faster way of calculating u0 = x[i]*mp mod DV
    var j = x[i]&0x7fff;
    var u0 = (j*this.mpl+(((j*this.mph+(x[i]>>15)*this.mpl)&this.um)<<15))&x.DM;
    // use am to combine the multiply-shift-add into one call
    j = i+this.m.t;
    x[j] += this.m.am(0,u0,x,i,0,this.m.t);
    // propagate carry
    while(x[j] >= x.DV) { x[j] -= x.DV; x[++j]++; }
  }
  x.clamp();
  x.drShiftTo(this.m.t,x);
  if(x.compareTo(this.m) >= 0) x.subTo(this.m,x);
}

// r = "x^2/R mod m"; x != r
function montSqrTo(x,r) { x.squareTo(r); this.reduce(r); }

// r = "xy/R mod m"; x,y != r
function montMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }

Montgomery.prototype.convert = montConvert;
Montgomery.prototype.revert = montRevert;
Montgomery.prototype.reduce = montReduce;
Montgomery.prototype.mulTo = montMulTo;
Montgomery.prototype.sqrTo = montSqrTo;

// (protected) true iff this is even
function bnpIsEven() { return ((this.t>0)?(this[0]&1):this.s) == 0; }

// (protected) this^e, e < 2^32, doing sqr and mul with "r" (HAC 14.79)
function bnpExp(e,z) {
  if(e > 0xffffffff || e < 1) return BigInteger.ONE;
  var r = nbi(), r2 = nbi(), g = z.convert(this), i = nbits(e)-1;
  g.copyTo(r);
  while(--i >= 0) {
    z.sqrTo(r,r2);
    if((e&(1<<i)) > 0) z.mulTo(r2,g,r);
    else { var t = r; r = r2; r2 = t; }
  }
  return z.revert(r);
}

// (public) this^e % m, 0 <= e < 2^32
function bnModPowInt(e,m) {
    var z;
    if(e < 256 || m.isEven()) z = new Classic(m); else z = new Montgomery(m);
    return this.exp(e,z);
}
  
// protected
BigInteger.prototype.copyTo = bnpCopyTo;
BigInteger.prototype.fromInt = bnpFromInt;
BigInteger.prototype.fromString = bnpFromString;
BigInteger.prototype.clamp = bnpClamp;
BigInteger.prototype.dlShiftTo = bnpDLShiftTo;
BigInteger.prototype.drShiftTo = bnpDRShiftTo;
BigInteger.prototype.lShiftTo = bnpLShiftTo;
BigInteger.prototype.rShiftTo = bnpRShiftTo;
BigInteger.prototype.subTo = bnpSubTo;
BigInteger.prototype.multiplyTo = bnpMultiplyTo;
BigInteger.prototype.squareTo = bnpSquareTo;
BigInteger.prototype.divRemTo = bnpDivRemTo;
BigInteger.prototype.invDigit = bnpInvDigit;
BigInteger.prototype.isEven = bnpIsEven;
BigInteger.prototype.exp = bnpExp;

// public
BigInteger.prototype.toString = bnToString;
BigInteger.prototype.negate = bnNegate;
BigInteger.prototype.abs = bnAbs;
BigInteger.prototype.compareTo = bnCompareTo;
BigInteger.prototype.bitLength = bnBitLength;
BigInteger.prototype.mod = bnMod;
BigInteger.prototype.modPowInt = bnModPowInt;

// "constants"
BigInteger.ZERO = nbv(0);
BigInteger.ONE = nbv(1);







// Copyright (c) 2005-2009  Tom Wu
// All Rights Reserved.
// See "LICENSE" for details.

// Extended JavaScript BN functions, required for RSA private ops.

// Version 1.1: new BigInteger("0", 10) returns "proper" zero
// Version 1.2: square() API, isProbablePrime fix

// (public)
function bnClone() { var r = nbi(); this.copyTo(r); return r; }

// (public) return value as integer
function bnIntValue() {
  if(this.s < 0) {
    if(this.t == 1) return this[0]-this.DV;
    else if(this.t == 0) return -1;
  }
  else if(this.t == 1) return this[0];
  else if(this.t == 0) return 0;
  // assumes 16 < DB < 32
  return ((this[1]&((1<<(32-this.DB))-1))<<this.DB)|this[0];
}

// (public) return value as byte
function bnByteValue() { return (this.t==0)?this.s:(this[0]<<24)>>24; }

// (public) return value as short (assumes DB>=16)
function bnShortValue() { return (this.t==0)?this.s:(this[0]<<16)>>16; }

// (protected) return x s.t. r^x < DV
function bnpChunkSize(r) { return Math.floor(Math.LN2*this.DB/Math.log(r)); }

// (public) 0 if this == 0, 1 if this > 0
function bnSigNum() {
  if(this.s < 0) return -1;
  else if(this.t <= 0 || (this.t == 1 && this[0] <= 0)) return 0;
  else return 1;
}

// (protected) convert to radix string
function bnpToRadix(b) {
  if(b == null) b = 10;
  if(this.signum() == 0 || b < 2 || b > 36) return "0";
  var cs = this.chunkSize(b);
  var a = Math.pow(b,cs);
  var d = nbv(a), y = nbi(), z = nbi(), r = "";
  this.divRemTo(d,y,z);
  while(y.signum() > 0) {
    r = (a+z.intValue()).toString(b).substr(1) + r;
    y.divRemTo(d,y,z);
  }
  return z.intValue().toString(b) + r;
}

// (protected) convert from radix string
function bnpFromRadix(s,b) {
  this.fromInt(0);
  if(b == null) b = 10;
  var cs = this.chunkSize(b);
  var d = Math.pow(b,cs), mi = false, j = 0, w = 0;
  for(var i = 0; i < s.length; ++i) {
    var x = intAt(s,i);
    if(x < 0) {
      if(s.charAt(i) == "-" && this.signum() == 0) mi = true;
      continue;
    }
    w = b*w+x;
    if(++j >= cs) {
      this.dMultiply(d);
      this.dAddOffset(w,0);
      j = 0;
      w = 0;
    }
  }
  if(j > 0) {
    this.dMultiply(Math.pow(b,j));
    this.dAddOffset(w,0);
  }
  if(mi) BigInteger.ZERO.subTo(this,this);
}

// (protected) alternate constructor
function bnpFromNumber(a,b,c) {
  if("number" == typeof b) {
    // new BigInteger(int,int,RNG)
    if(a < 2) this.fromInt(1);
    else {
      this.fromNumber(a,c);
      if(!this.testBit(a-1))	// force MSB set
        this.bitwiseTo(BigInteger.ONE.shiftLeft(a-1),op_or,this);
      if(this.isEven()) this.dAddOffset(1,0); // force odd
      while(!this.isProbablePrime(b)) {
        this.dAddOffset(2,0);
        if(this.bitLength() > a) this.subTo(BigInteger.ONE.shiftLeft(a-1),this);
      }
    }
  }
  else {
    // new BigInteger(int,RNG)
    var x = new Array(), t = a&7;
    x.length = (a>>3)+1;
    b.nextBytes(x);
    if(t > 0) x[0] &= ((1<<t)-1); else x[0] = 0;
    this.fromString(x,256);
  }
}

// (public) convert to bigendian byte array
function bnToByteArray() {
  var i = this.t, r = new Array();
  r[0] = this.s;
  var p = this.DB-(i*this.DB)%8, d, k = 0;
  if(i-- > 0) {
    if(p < this.DB && (d = this[i]>>p) != (this.s&this.DM)>>p)
      r[k++] = d|(this.s<<(this.DB-p));
    while(i >= 0) {
      if(p < 8) {
        d = (this[i]&((1<<p)-1))<<(8-p);
        d |= this[--i]>>(p+=this.DB-8);
      }
      else {
        d = (this[i]>>(p-=8))&0xff;
        if(p <= 0) { p += this.DB; --i; }
      }
      if((d&0x80) != 0) d |= -256;
      if(k == 0 && (this.s&0x80) != (d&0x80)) ++k;
      if(k > 0 || d != this.s) r[k++] = d;
    }
  }
  return r;
}

function bnEquals(a) { return(this.compareTo(a)==0); }
function bnMin(a) { return(this.compareTo(a)<0)?this:a; }
function bnMax(a) { return(this.compareTo(a)>0)?this:a; }

// (protected) r = this op a (bitwise)
function bnpBitwiseTo(a,op,r) {
  var i, f, m = Math.min(a.t,this.t);
  for(i = 0; i < m; ++i) r[i] = op(this[i],a[i]);
  if(a.t < this.t) {
    f = a.s&this.DM;
    for(i = m; i < this.t; ++i) r[i] = op(this[i],f);
    r.t = this.t;
  }
  else {
    f = this.s&this.DM;
    for(i = m; i < a.t; ++i) r[i] = op(f,a[i]);
    r.t = a.t;
  }
  r.s = op(this.s,a.s);
  r.clamp();
}

// (public) this & a
function op_and(x,y) { return x&y; }
function bnAnd(a) { var r = nbi(); this.bitwiseTo(a,op_and,r); return r; }

// (public) this | a
function op_or(x,y) { return x|y; }
function bnOr(a) { var r = nbi(); this.bitwiseTo(a,op_or,r); return r; }

// (public) this ^ a
function op_xor(x,y) { return x^y; }
function bnXor(a) { var r = nbi(); this.bitwiseTo(a,op_xor,r); return r; }

// (public) this & ~a
function op_andnot(x,y) { return x&~y; }
function bnAndNot(a) { var r = nbi(); this.bitwiseTo(a,op_andnot,r); return r; }

// (public) ~this
function bnNot() {
  var r = nbi();
  for(var i = 0; i < this.t; ++i) r[i] = this.DM&~this[i];
  r.t = this.t;
  r.s = ~this.s;
  return r;
}

// (public) this << n
function bnShiftLeft(n) {
  var r = nbi();
  if(n < 0) this.rShiftTo(-n,r); else this.lShiftTo(n,r);
  return r;
}

// (public) this >> n
function bnShiftRight(n) {
  var r = nbi();
  if(n < 0) this.lShiftTo(-n,r); else this.rShiftTo(n,r);
  return r;
}

// return index of lowest 1-bit in x, x < 2^31
function lbit(x) {
  if(x == 0) return -1;
  var r = 0;
  if((x&0xffff) == 0) { x >>= 16; r += 16; }
  if((x&0xff) == 0) { x >>= 8; r += 8; }
  if((x&0xf) == 0) { x >>= 4; r += 4; }
  if((x&3) == 0) { x >>= 2; r += 2; }
  if((x&1) == 0) ++r;
  return r;
}

// (public) returns index of lowest 1-bit (or -1 if none)
function bnGetLowestSetBit() {
  for(var i = 0; i < this.t; ++i)
    if(this[i] != 0) return i*this.DB+lbit(this[i]);
  if(this.s < 0) return this.t*this.DB;
  return -1;
}

// return number of 1 bits in x
function cbit(x) {
  var r = 0;
  while(x != 0) { x &= x-1; ++r; }
  return r;
}

// (public) return number of set bits
function bnBitCount() {
  var r = 0, x = this.s&this.DM;
  for(var i = 0; i < this.t; ++i) r += cbit(this[i]^x);
  return r;
}

// (public) true iff nth bit is set
function bnTestBit(n) {
  var j = Math.floor(n/this.DB);
  if(j >= this.t) return(this.s!=0);
  return((this[j]&(1<<(n%this.DB)))!=0);
}

// (protected) this op (1<<n)
function bnpChangeBit(n,op) {
  var r = BigInteger.ONE.shiftLeft(n);
  this.bitwiseTo(r,op,r);
  return r;
}

// (public) this | (1<<n)
function bnSetBit(n) { return this.changeBit(n,op_or); }

// (public) this & ~(1<<n)
function bnClearBit(n) { return this.changeBit(n,op_andnot); }

// (public) this ^ (1<<n)
function bnFlipBit(n) { return this.changeBit(n,op_xor); }

// (protected) r = this + a
function bnpAddTo(a,r) {
  var i = 0, c = 0, m = Math.min(a.t,this.t);
  while(i < m) {
    c += this[i]+a[i];
    r[i++] = c&this.DM;
    c >>= this.DB;
  }
  if(a.t < this.t) {
    c += a.s;
    while(i < this.t) {
      c += this[i];
      r[i++] = c&this.DM;
      c >>= this.DB;
    }
    c += this.s;
  }
  else {
    c += this.s;
    while(i < a.t) {
      c += a[i];
      r[i++] = c&this.DM;
      c >>= this.DB;
    }
    c += a.s;
  }
  r.s = (c<0)?-1:0;
  if(c > 0) r[i++] = c;
  else if(c < -1) r[i++] = this.DV+c;
  r.t = i;
  r.clamp();
}

// (public) this + a
function bnAdd(a) { var r = nbi(); this.addTo(a,r); return r; }

// (public) this - a
function bnSubtract(a) { var r = nbi(); this.subTo(a,r); return r; }

// (public) this * a
function bnMultiply(a) { var r = nbi(); this.multiplyTo(a,r); return r; }

// (public) this^2
function bnSquare() { var r = nbi(); this.squareTo(r); return r; }

// (public) this / a
function bnDivide(a) { var r = nbi(); this.divRemTo(a,r,null); return r; }

// (public) this % a
function bnRemainder(a) { var r = nbi(); this.divRemTo(a,null,r); return r; }

// (public) [this/a,this%a]
function bnDivideAndRemainder(a) {
  var q = nbi(), r = nbi();
  this.divRemTo(a,q,r);
  return new Array(q,r);
}

// (protected) this *= n, this >= 0, 1 < n < DV
function bnpDMultiply(n) {
  this[this.t] = this.am(0,n-1,this,0,0,this.t);
  ++this.t;
  this.clamp();
}

// (protected) this += n << w words, this >= 0
function bnpDAddOffset(n,w) {
  if(n == 0) return;
  while(this.t <= w) this[this.t++] = 0;
  this[w] += n;
  while(this[w] >= this.DV) {
    this[w] -= this.DV;
    if(++w >= this.t) this[this.t++] = 0;
    ++this[w];
  }
}

// A "null" reducer
function NullExp() {}
function nNop(x) { return x; }
function nMulTo(x,y,r) { x.multiplyTo(y,r); }
function nSqrTo(x,r) { x.squareTo(r); }

NullExp.prototype.convert = nNop;
NullExp.prototype.revert = nNop;
NullExp.prototype.mulTo = nMulTo;
NullExp.prototype.sqrTo = nSqrTo;

// (public) this^e
function bnPow(e) { return this.exp(e,new NullExp()); }

// (protected) r = lower n words of "this * a", a.t <= n
// "this" should be the larger one if appropriate.
function bnpMultiplyLowerTo(a,n,r) {
  var i = Math.min(this.t+a.t,n);
  r.s = 0; // assumes a,this >= 0
  r.t = i;
  while(i > 0) r[--i] = 0;
  var j;
  for(j = r.t-this.t; i < j; ++i) r[i+this.t] = this.am(0,a[i],r,i,0,this.t);
  for(j = Math.min(a.t,n); i < j; ++i) this.am(0,a[i],r,i,0,n-i);
  r.clamp();
}

// (protected) r = "this * a" without lower n words, n > 0
// "this" should be the larger one if appropriate.
function bnpMultiplyUpperTo(a,n,r) {
  --n;
  var i = r.t = this.t+a.t-n;
  r.s = 0; // assumes a,this >= 0
  while(--i >= 0) r[i] = 0;
  for(i = Math.max(n-this.t,0); i < a.t; ++i)
    r[this.t+i-n] = this.am(n-i,a[i],r,0,0,this.t+i-n);
  r.clamp();
  r.drShiftTo(1,r);
}

// Barrett modular reduction
function Barrett(m) {
  // setup Barrett
  this.r2 = nbi();
  this.q3 = nbi();
  BigInteger.ONE.dlShiftTo(2*m.t,this.r2);
  this.mu = this.r2.divide(m);
  this.m = m;
}

function barrettConvert(x) {
  if(x.s < 0 || x.t > 2*this.m.t) return x.mod(this.m);
  else if(x.compareTo(this.m) < 0) return x;
  else { var r = nbi(); x.copyTo(r); this.reduce(r); return r; }
}

function barrettRevert(x) { return x; }

// x = x mod m (HAC 14.42)
function barrettReduce(x) {
  x.drShiftTo(this.m.t-1,this.r2);
  if(x.t > this.m.t+1) { x.t = this.m.t+1; x.clamp(); }
  this.mu.multiplyUpperTo(this.r2,this.m.t+1,this.q3);
  this.m.multiplyLowerTo(this.q3,this.m.t+1,this.r2);
  while(x.compareTo(this.r2) < 0) x.dAddOffset(1,this.m.t+1);
  x.subTo(this.r2,x);
  while(x.compareTo(this.m) >= 0) x.subTo(this.m,x);
}

// r = x^2 mod m; x != r
function barrettSqrTo(x,r) { x.squareTo(r); this.reduce(r); }

// r = x*y mod m; x,y != r
function barrettMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }

Barrett.prototype.convert = barrettConvert;
Barrett.prototype.revert = barrettRevert;
Barrett.prototype.reduce = barrettReduce;
Barrett.prototype.mulTo = barrettMulTo;
Barrett.prototype.sqrTo = barrettSqrTo;

// (public) this^e % m (HAC 14.85)
function bnModPow(e,m) {
  var i = e.bitLength(), k, r = nbv(1), z;
  if(i <= 0) return r;
  else if(i < 18) k = 1;
  else if(i < 48) k = 3;
  else if(i < 144) k = 4;
  else if(i < 768) k = 5;
  else k = 6;
  if(i < 8)
    z = new Classic(m);
  else if(m.isEven())
    z = new Barrett(m);
  else
    z = new Montgomery(m)

  // precomputation
  var g = new Array(), n = 3, k1 = k-1, km = (1<<k)-1;
  g[1] = z.convert(this);
  if(k > 1) {
    var g2 = nbi();
    z.sqrTo(g[1],g2);
    while(n <= km) {
      g[n] = nbi();
      z.mulTo(g2,g[n-2],g[n]);
      n += 2;
    }
  }

  var j = e.t-1, w, is1 = true, r2 = nbi(), t;
  i = nbits(e[j])-1;
  while(j >= 0) {
    if(i >= k1) w = (e[j]>>(i-k1))&km;
    else {
      w = (e[j]&((1<<(i+1))-1))<<(k1-i);
      if(j > 0) w |= e[j-1]>>(this.DB+i-k1);
    }

    n = k;
    while((w&1) == 0) { w >>= 1; --n; }
    if((i -= n) < 0) { i += this.DB; --j; }
    if(is1) {	// ret == 1, don't bother squaring or multiplying it
      g[w].copyTo(r);
      is1 = false;
    }
    else {
      while(n > 1) { z.sqrTo(r,r2); z.sqrTo(r2,r); n -= 2; }
      if(n > 0) z.sqrTo(r,r2); else { t = r; r = r2; r2 = t; }
      z.mulTo(r2,g[w],r);
    }

    while(j >= 0 && (e[j]&(1<<i)) == 0) {
      z.sqrTo(r,r2); t = r; r = r2; r2 = t;
      if(--i < 0) { i = this.DB-1; --j; }
    }
  }
  return z.revert(r);
}

// (public) gcd(this,a) (HAC 14.54)
function bnGCD(a) {
  var x = (this.s<0)?this.negate():this.clone();
  var y = (a.s<0)?a.negate():a.clone();
  if(x.compareTo(y) < 0) { var t = x; x = y; y = t; }
  var i = x.getLowestSetBit(), g = y.getLowestSetBit();
  if(g < 0) return x;
  if(i < g) g = i;
  if(g > 0) {
    x.rShiftTo(g,x);
    y.rShiftTo(g,y);
  }
  while(x.signum() > 0) {
    if((i = x.getLowestSetBit()) > 0) x.rShiftTo(i,x);
    if((i = y.getLowestSetBit()) > 0) y.rShiftTo(i,y);
    if(x.compareTo(y) >= 0) {
      x.subTo(y,x);
      x.rShiftTo(1,x);
    }
    else {
      y.subTo(x,y);
      y.rShiftTo(1,y);
    }
  }
  if(g > 0) y.lShiftTo(g,y);
  return y;
}

// (protected) this % n, n < 2^26
function bnpModInt(n) {
  if(n <= 0) return 0;
  var d = this.DV%n, r = (this.s<0)?n-1:0;
  if(this.t > 0)
    if(d == 0) r = this[0]%n;
    else for(var i = this.t-1; i >= 0; --i) r = (d*r+this[i])%n;
  return r;
}

// (public) 1/this % m (HAC 14.61)
function bnModInverse(m) {
  var ac = m.isEven();
  if((this.isEven() && ac) || m.signum() == 0) return BigInteger.ZERO;
  var u = m.clone(), v = this.clone();
  var a = nbv(1), b = nbv(0), c = nbv(0), d = nbv(1);
  while(u.signum() != 0) {
    while(u.isEven()) {
      u.rShiftTo(1,u);
      if(ac) {
        if(!a.isEven() || !b.isEven()) { a.addTo(this,a); b.subTo(m,b); }
        a.rShiftTo(1,a);
      }
      else if(!b.isEven()) b.subTo(m,b);
      b.rShiftTo(1,b);
    }
    while(v.isEven()) {
      v.rShiftTo(1,v);
      if(ac) {
        if(!c.isEven() || !d.isEven()) { c.addTo(this,c); d.subTo(m,d); }
        c.rShiftTo(1,c);
      }
      else if(!d.isEven()) d.subTo(m,d);
      d.rShiftTo(1,d);
    }
    if(u.compareTo(v) >= 0) {
      u.subTo(v,u);
      if(ac) a.subTo(c,a);
      b.subTo(d,b);
    }
    else {
      v.subTo(u,v);
      if(ac) c.subTo(a,c);
      d.subTo(b,d);
    }
  }
  if(v.compareTo(BigInteger.ONE) != 0) return BigInteger.ZERO;
  if(d.compareTo(m) >= 0) return d.subtract(m);
  if(d.signum() < 0) d.addTo(m,d); else return d;
  if(d.signum() < 0) return d.add(m); else return d;
}

var lowprimes = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113,127,131,137,139,149,151,157,163,167,173,179,181,191,193,197,199,211,223,227,229,233,239,241,251,257,263,269,271,277,281,283,293,307,311,313,317,331,337,347,349,353,359,367,373,379,383,389,397,401,409,419,421,431,433,439,443,449,457,461,463,467,479,487,491,499,503,509,521,523,541,547,557,563,569,571,577,587,593,599,601,607,613,617,619,631,641,643,647,653,659,661,673,677,683,691,701,709,719,727,733,739,743,751,757,761,769,773,787,797,809,811,821,823,827,829,839,853,857,859,863,877,881,883,887,907,911,919,929,937,941,947,953,967,971,977,983,991,997];
var lplim = (1<<26)/lowprimes[lowprimes.length-1];

// (public) test primality with certainty >= 1-.5^t
function bnIsProbablePrime(t) {
  var i, x = this.abs();
  if(x.t == 1 && x[0] <= lowprimes[lowprimes.length-1]) {
    for(i = 0; i < lowprimes.length; ++i)
      if(x[0] == lowprimes[i]) return true;
    return false;
  }
  if(x.isEven()) return false;
  i = 1;
  while(i < lowprimes.length) {
    var m = lowprimes[i], j = i+1;
    while(j < lowprimes.length && m < lplim) m *= lowprimes[j++];
    m = x.modInt(m);
    while(i < j) if(m%lowprimes[i++] == 0) return false;
  }
  return x.millerRabin(t);
}

// (protected) true if probably prime (HAC 4.24, Miller-Rabin)
function bnpMillerRabin(t) {
  var n1 = this.subtract(BigInteger.ONE);
  var k = n1.getLowestSetBit();
  if(k <= 0) return false;
  var r = n1.shiftRight(k);
  t = (t+1)>>1;
  if(t > lowprimes.length) t = lowprimes.length;
  var a = nbi();
  for(var i = 0; i < t; ++i) {
    //Pick bases at random, instead of starting at 2
    a.fromInt(lowprimes[Math.floor(Math.random()*lowprimes.length)]);
    var y = a.modPow(r,this);
    if(y.compareTo(BigInteger.ONE) != 0 && y.compareTo(n1) != 0) {
      var j = 1;
      while(j++ < k && y.compareTo(n1) != 0) {
        y = y.modPowInt(2,this);
        if(y.compareTo(BigInteger.ONE) == 0) return false;
      }
      if(y.compareTo(n1) != 0) return false;
    }
  }
  return true;
}

// protected
BigInteger.prototype.chunkSize = bnpChunkSize;
BigInteger.prototype.toRadix = bnpToRadix;
BigInteger.prototype.fromRadix = bnpFromRadix;
BigInteger.prototype.fromNumber = bnpFromNumber;
BigInteger.prototype.bitwiseTo = bnpBitwiseTo;
BigInteger.prototype.changeBit = bnpChangeBit;
BigInteger.prototype.addTo = bnpAddTo;
BigInteger.prototype.dMultiply = bnpDMultiply;
BigInteger.prototype.dAddOffset = bnpDAddOffset;
BigInteger.prototype.multiplyLowerTo = bnpMultiplyLowerTo;
BigInteger.prototype.multiplyUpperTo = bnpMultiplyUpperTo;
BigInteger.prototype.modInt = bnpModInt;
BigInteger.prototype.millerRabin = bnpMillerRabin;

// public
BigInteger.prototype.clone = bnClone;
BigInteger.prototype.intValue = bnIntValue;
BigInteger.prototype.byteValue = bnByteValue;
BigInteger.prototype.shortValue = bnShortValue;
BigInteger.prototype.signum = bnSigNum;
BigInteger.prototype.toByteArray = bnToByteArray;
BigInteger.prototype.equals = bnEquals;
BigInteger.prototype.min = bnMin;
BigInteger.prototype.max = bnMax;
BigInteger.prototype.and = bnAnd;
BigInteger.prototype.or = bnOr;
BigInteger.prototype.xor = bnXor;
BigInteger.prototype.andNot = bnAndNot;
BigInteger.prototype.not = bnNot;
BigInteger.prototype.shiftLeft = bnShiftLeft;
BigInteger.prototype.shiftRight = bnShiftRight;
BigInteger.prototype.getLowestSetBit = bnGetLowestSetBit;
BigInteger.prototype.bitCount = bnBitCount;
BigInteger.prototype.testBit = bnTestBit;
BigInteger.prototype.setBit = bnSetBit;
BigInteger.prototype.clearBit = bnClearBit;
BigInteger.prototype.flipBit = bnFlipBit;
BigInteger.prototype.add = bnAdd;
BigInteger.prototype.subtract = bnSubtract;
BigInteger.prototype.multiply = bnMultiply;
BigInteger.prototype.divide = bnDivide;
BigInteger.prototype.remainder = bnRemainder;
BigInteger.prototype.divideAndRemainder = bnDivideAndRemainder;
BigInteger.prototype.modPow = bnModPow;
BigInteger.prototype.modInverse = bnModInverse;
BigInteger.prototype.pow = bnPow;
BigInteger.prototype.gcd = bnGCD;
BigInteger.prototype.isProbablePrime = bnIsProbablePrime;

// JSBN-specific extension
BigInteger.prototype.square = bnSquare;

// BigInteger interfaces not implemented in jsbn:

// BigInteger(int signum, byte[] magnitude)
// double doubleValue()
// float floatValue()
// int hashCode()
// long longValue()
// static BigInteger valueOf(long val)





// prng4.js - uses Arcfour as a PRNG

function Arcfour() {
  this.i = 0;
  this.j = 0;
  this.S = new Array();
}

// Initialize arcfour context from key, an array of ints, each from [0..255]
function ARC4init(key) {
  var i, j, t;
  for(i = 0; i < 256; ++i)
    this.S[i] = i;
  j = 0;
  for(i = 0; i < 256; ++i) {
    j = (j + this.S[i] + key[i % key.length]) & 255;
    t = this.S[i];
    this.S[i] = this.S[j];
    this.S[j] = t;
  }
  this.i = 0;
  this.j = 0;
}

function ARC4next() {
  var t;
  this.i = (this.i + 1) & 255;
  this.j = (this.j + this.S[this.i]) & 255;
  t = this.S[this.i];
  this.S[this.i] = this.S[this.j];
  this.S[this.j] = t;
  return this.S[(t + this.S[this.i]) & 255];
}

Arcfour.prototype.init = ARC4init;
Arcfour.prototype.next = ARC4next;

// Plug in your RNG constructor here
function prng_newstate() {
  return new Arcfour();
}

// Pool size must be a multiple of 4 and greater than 32.
// An array of bytes the size of the pool will be passed to init()
var rng_psize = 256;






// Random number generator - requires a PRNG backend, e.g. prng4.js

// For best results, put code like
// <body onClick='rng_seed_time();' onKeyPress='rng_seed_time();'>
// in your main HTML document.

var rng_state;
var rng_pool;
var rng_pptr;

// Mix in a 32-bit integer into the pool
function rng_seed_int(x) {
  rng_pool[rng_pptr++] ^= x & 255;
  rng_pool[rng_pptr++] ^= (x >> 8) & 255;
  rng_pool[rng_pptr++] ^= (x >> 16) & 255;
  rng_pool[rng_pptr++] ^= (x >> 24) & 255;
  if(rng_pptr >= rng_psize) rng_pptr -= rng_psize;
}

// Mix in the current time (w/milliseconds) into the pool
function rng_seed_time() {
  rng_seed_int(new Date().getTime());
}

// Initialize the pool with junk if needed.
if(rng_pool == null) {
  rng_pool = new Array();
  rng_pptr = 0;
  var t;
  if(window.crypto && window.crypto.getRandomValues) {
    // Use webcrypto if available
    var ua = new Uint8Array(32);
    window.crypto.getRandomValues(ua);
    for(t = 0; t < 32; ++t)
      rng_pool[rng_pptr++] = ua[t];
  }
  if(navigator.appName == "Netscape" && navigator.appVersion < "5" && window.crypto) {
    // Extract entropy (256 bits) from NS4 RNG if available
    var z = window.crypto.random(32);
    for(t = 0; t < z.length; ++t)
      rng_pool[rng_pptr++] = z.charCodeAt(t) & 255;
  }  
  while(rng_pptr < rng_psize) {  // extract some randomness from Math.random()
    t = Math.floor(65536 * Math.random());
    rng_pool[rng_pptr++] = t >>> 8;
    rng_pool[rng_pptr++] = t & 255;
  }
  rng_pptr = 0;
  rng_seed_time();
  //rng_seed_int(window.screenX);
  //rng_seed_int(window.screenY);
}

function rng_get_byte() {
  if(rng_state == null) {
    rng_seed_time();
    rng_state = prng_newstate();
    rng_state.init(rng_pool);
    for(rng_pptr = 0; rng_pptr < rng_pool.length; ++rng_pptr)
      rng_pool[rng_pptr] = 0;
    rng_pptr = 0;
    //rng_pool = null;
  }
  // TODO: allow reseeding after first request
  return rng_state.next();
}

function rng_get_bytes(ba) {
  var i;
  for(i = 0; i < ba.length; ++i) ba[i] = rng_get_byte();
}

function SecureRandom() {}

SecureRandom.prototype.nextBytes = rng_get_bytes;





function toHexString(arr) {
    if (arr instanceof ArrayBuffer) arr = new Uint8Array(arr)
    const zero = 48,
        j=arr.length,
        length = j<<1,
        hex = new Uint8Array(length)
    for (var i=0; i<j; i++) {
        const digits = arr[i].toString(16),
            pos = i<<1
        if (digits.length&1) {
            hex[pos] = zero
            hex[pos+1] = digits.charCodeAt(0)
        }
        else {
            hex[pos] = digits.charCodeAt(0)
            hex[pos+1] = digits.charCodeAt(1)
        }
    }
    return String.fromCharCode.apply(null, hex)
}





/** @fileOverview Javascript cryptography implementation.
 *
 * Crush to remove comments, shorten variable names and
 * generally reduce transmission size.
 *
 * @author Emily Stark
 * @author Mike Hamburg
 * @author Dan Boneh
 */

/**
 * The Stanford Javascript Crypto Library, top-level namespace.
 * @namespace
 */
const sjcl = {
  /**
   * Symmetric ciphers.
   * @namespace
   */
  cipher: {},

  /**
   * Hash functions.  Right now only SHA256 is implemented.
   * @namespace
   */
  hash: {},

  /**
   * Key exchange functions.  Right now only SRP is implemented.
   * @namespace
   */
  keyexchange: {},
  
  /**
   * Cipher modes of operation.
   * @namespace
   */
  mode: {},

  /**
   * Miscellaneous.  HMAC and PBKDF2.
   * @namespace
   */
  misc: {},
  
  /**
   * Bit array encoders and decoders.
   * @namespace
   *
   * @description
   * The members of this namespace are functions which translate between
   * SJCL's bitArrays and other objects (usually strings).  Because it
   * isn't always clear which direction is encoding and which is decoding,
   * the method names are "fromBits" and "toBits".
   */
  codec: {},
  
  /**
   * Exceptions.
   * @namespace
   */
  exception: {
    /**
     * Ciphertext is corrupt.
     * @constructor
     */
    corrupt: function(message) {
      this.toString = function() { return "CORRUPT: "+this.message; };
      this.message = message;
    },
    
    /**
     * Invalid parameter.
     * @constructor
     */
    invalid: function(message) {
      this.toString = function() { return "INVALID: "+this.message; };
      this.message = message;
    },
    
    /**
     * Bug or missing feature in SJCL.
     * @constructor
     */
    bug: function(message) {
      this.toString = function() { return "BUG: "+this.message; };
      this.message = message;
    },

    /**
     * Something isn't ready.
     * @constructor
     */
    notReady: function(message) {
      this.toString = function() { return "NOT READY: "+this.message; };
      this.message = message;
    }
  }
};






/** @fileOverview Low-level AES implementation.
 *
 * This file contains a low-level implementation of AES, optimized for
 * size and for efficiency on several browsers.  It is based on
 * OpenSSL's aes_core.c, a public-domain implementation by Vincent
 * Rijmen, Antoon Bosselaers and Paulo Barreto.
 *
 * An older version of this implementation is available in the public
 * domain, but this one is (c) Emily Stark, Mike Hamburg, Dan Boneh,
 * Stanford University 2008-2010 and BSD-licensed for liability
 * reasons.
 *
 * @author Emily Stark
 * @author Mike Hamburg
 * @author Dan Boneh
 */

/**
 * Schedule out an AES key for both encryption and decryption.  This
 * is a low-level class.  Use a cipher mode to do bulk encryption.
 *
 * @constructor
 * @param {Array} key The key as an array of 4, 6 or 8 words.
 */
sjcl.cipher.aes = function (key) {
    if (!this._tables[0][0][0]) {
      this._precompute();
    }
    
    var i, j, tmp,
      encKey, decKey,
      sbox = this._tables[0][4], decTable = this._tables[1],
      keyLen = key.length, rcon = 1;
    
    if (keyLen !== 4 && keyLen !== 6 && keyLen !== 8) {
      throw new sjcl.exception.invalid("invalid aes key size");
    }
    
    this._key = [encKey = key.slice(0), decKey = []];
    
    // schedule encryption keys
    for (i = keyLen; i < 4 * keyLen + 28; i++) {
      tmp = encKey[i-1];
      
      // apply sbox
      if (i%keyLen === 0 || (keyLen === 8 && i%keyLen === 4)) {
        tmp = sbox[tmp>>>24]<<24 ^ sbox[tmp>>16&255]<<16 ^ sbox[tmp>>8&255]<<8 ^ sbox[tmp&255];
        
        // shift rows and add rcon
        if (i%keyLen === 0) {
          tmp = tmp<<8 ^ tmp>>>24 ^ rcon<<24;
          rcon = rcon<<1 ^ (rcon>>7)*283;
        }
      }
      
      encKey[i] = encKey[i-keyLen] ^ tmp;
    }
    
    // schedule decryption keys
    for (j = 0; i; j++, i--) {
      tmp = encKey[j&3 ? i : i - 4];
      if (i<=4 || j<4) {
        decKey[j] = tmp;
      } else {
        decKey[j] = decTable[0][sbox[tmp>>>24      ]] ^
                    decTable[1][sbox[tmp>>16  & 255]] ^
                    decTable[2][sbox[tmp>>8   & 255]] ^
                    decTable[3][sbox[tmp      & 255]];
      }
    }
  };
  
  sjcl.cipher.aes.prototype = {
    // public
    /* Something like this might appear here eventually
    name: "AES",
    blockSize: 4,
    keySizes: [4,6,8],
    */
    
    /**
     * Encrypt an array of 4 big-endian words.
     * @param {Array} data The plaintext.
     * @return {Array} The ciphertext.
     */
    encrypt:function (data) { return this._crypt(data,0); },
    
    /**
     * Decrypt an array of 4 big-endian words.
     * @param {Array} data The ciphertext.
     * @return {Array} The plaintext.
     */
    decrypt:function (data) { return this._crypt(data,1); },
    
    /**
     * The expanded S-box and inverse S-box tables.  These will be computed
     * on the client so that we don't have to send them down the wire.
     *
     * There are two tables, _tables[0] is for encryption and
     * _tables[1] is for decryption.
     *
     * The first 4 sub-tables are the expanded S-box with MixColumns.  The
     * last (_tables[01][4]) is the S-box itself.
     *
     * @private
     */
    _tables: [[[],[],[],[],[]],[[],[],[],[],[]]],
  
    /**
     * Expand the S-box tables.
     *
     * @private
     */
    _precompute: function () {
     var encTable = this._tables[0], decTable = this._tables[1],
         sbox = encTable[4], sboxInv = decTable[4],
         i, x, xInv, d=[], th=[], x2, x4, x8, s, tEnc, tDec;
  
      // Compute double and third tables
     for (i = 0; i < 256; i++) {
       th[( d[i] = i<<1 ^ (i>>7)*283 )^i]=i;
     }
     
     for (x = xInv = 0; !sbox[x]; x ^= x2 || 1, xInv = th[xInv] || 1) {
       // Compute sbox
       s = xInv ^ xInv<<1 ^ xInv<<2 ^ xInv<<3 ^ xInv<<4;
       s = s>>8 ^ s&255 ^ 99;
       sbox[x] = s;
       sboxInv[s] = x;
       
       // Compute MixColumns
       x8 = d[x4 = d[x2 = d[x]]];
       tDec = x8*0x1010101 ^ x4*0x10001 ^ x2*0x101 ^ x*0x1010100;
       tEnc = d[s]*0x101 ^ s*0x1010100;
       
       for (i = 0; i < 4; i++) {
         encTable[i][x] = tEnc = tEnc<<24 ^ tEnc>>>8;
         decTable[i][s] = tDec = tDec<<24 ^ tDec>>>8;
       }
     }
     
     // Compactify.  Considerable speedup on Firefox.
     for (i = 0; i < 5; i++) {
       encTable[i] = encTable[i].slice(0);
       decTable[i] = decTable[i].slice(0);
     }
    },
    
    /**
     * Encryption and decryption core.
     * @param {Array} input Four words to be encrypted or decrypted.
     * @param dir The direction, 0 for encrypt and 1 for decrypt.
     * @return {Array} The four encrypted or decrypted words.
     * @private
     */
    _crypt:function (input, dir) {
      if (input.length !== 4) {
        throw new sjcl.exception.invalid("invalid aes block size");
      }
      
      var key = this._key[dir],
          // state variables a,b,c,d are loaded with pre-whitened data
          a = input[0]           ^ key[0],
          b = input[dir ? 3 : 1] ^ key[1],
          c = input[2]           ^ key[2],
          d = input[dir ? 1 : 3] ^ key[3],
          a2, b2, c2,
          
          nInnerRounds = key.length/4 - 2,
          i,
          kIndex = 4,
          out = [0,0,0,0],
          table = this._tables[dir],
          
          // load up the tables
          t0    = table[0],
          t1    = table[1],
          t2    = table[2],
          t3    = table[3],
          sbox  = table[4];
   
      // Inner rounds.  Cribbed from OpenSSL.
      for (i = 0; i < nInnerRounds; i++) {
        a2 = t0[a>>>24] ^ t1[b>>16 & 255] ^ t2[c>>8 & 255] ^ t3[d & 255] ^ key[kIndex];
        b2 = t0[b>>>24] ^ t1[c>>16 & 255] ^ t2[d>>8 & 255] ^ t3[a & 255] ^ key[kIndex + 1];
        c2 = t0[c>>>24] ^ t1[d>>16 & 255] ^ t2[a>>8 & 255] ^ t3[b & 255] ^ key[kIndex + 2];
        d  = t0[d>>>24] ^ t1[a>>16 & 255] ^ t2[b>>8 & 255] ^ t3[c & 255] ^ key[kIndex + 3];
        kIndex += 4;
        a=a2; b=b2; c=c2;
      }
          
      // Last round.
      for (i = 0; i < 4; i++) {
        out[dir ? 3&-i : i] =
          sbox[a>>>24      ]<<24 ^ 
          sbox[b>>16  & 255]<<16 ^
          sbox[c>>8   & 255]<<8  ^
          sbox[d      & 255]     ^
          key[kIndex++];
        a2=a; a=b; b=c; c=d; d=a2;
      }
      
      return out;
    }
  };
  

  






  /** @fileOverview CCM mode implementation.
 *
 * Special thanks to Roy Nicholson for pointing out a bug in our
 * implementation.
 *
 * @author Emily Stark
 * @author Mike Hamburg
 * @author Dan Boneh
 */

/**
 * CTR mode with CBC MAC.
 * @namespace
 */
sjcl.mode.ccm = {
    /** The name of the mode.
     * @constant
     */
    name: "ccm",
    
    _progressListeners: [],
  
    listenProgress: function (cb) {
      sjcl.mode.ccm._progressListeners.push(cb);
    },
  
    unListenProgress: function (cb) {
      var index = sjcl.mode.ccm._progressListeners.indexOf(cb);
      if (index > -1) {
        sjcl.mode.ccm._progressListeners.splice(index, 1);
      }
    },
  
    _callProgressListener: function (val) {
      var p = sjcl.mode.ccm._progressListeners.slice(), i;
  
      for (i = 0; i < p.length; i += 1) {
        p[i](val);
      }
    },
  
    /** Encrypt in CCM mode.
     * @static
     * @param {Object} prf The pseudorandom function.  It must have a block size of 16 bytes.
     * @param {bitArray} plaintext The plaintext data.
     * @param {bitArray} iv The initialization value.
     * @param {bitArray} [adata=[]] The authenticated data.
     * @param {Number} [tlen=64] the desired tag length, in bits.
     * @return {bitArray} The encrypted data, an array of bytes.
     */
    encrypt: function(prf, plaintext, iv, adata, tlen) {
      var L, out = plaintext.slice(0), tag, w=sjcl.bitArray, ivl = w.bitLength(iv) / 8, ol = w.bitLength(out) / 8;
      tlen = tlen || 64;
      adata = adata || [];
      
      if (ivl < 7) {
        throw new sjcl.exception.invalid("ccm: iv must be at least 7 bytes");
      }
      
      // compute the length of the length
      for (L=2; L<4 && ol >>> 8*L; L++) {}
      if (L < 15 - ivl) { L = 15-ivl; }
      iv = w.clamp(iv,8*(15-L));
      
      // compute the tag
      tag = sjcl.mode.ccm._computeTag(prf, plaintext, iv, adata, tlen, L);
      
      // encrypt
      out = sjcl.mode.ccm._ctrMode(prf, out, iv, tag, tlen, L);
      
      return w.concat(out.data, out.tag);
    },
    
    /** Decrypt in CCM mode.
     * @static
     * @param {Object} prf The pseudorandom function.  It must have a block size of 16 bytes.
     * @param {bitArray} ciphertext The ciphertext data.
     * @param {bitArray} iv The initialization value.
     * @param {bitArray} [adata=[]] adata The authenticated data.
     * @param {Number} [tlen=64] tlen the desired tag length, in bits.
     * @return {bitArray} The decrypted data.
     */
    decrypt: function(prf, ciphertext, iv, adata, tlen) {
      tlen = tlen || 64;
      adata = adata || [];
      var L,
          w=sjcl.bitArray,
          ivl = w.bitLength(iv) / 8,
          ol = w.bitLength(ciphertext), 
          out = w.clamp(ciphertext, ol - tlen),
          tag = w.bitSlice(ciphertext, ol - tlen), tag2;
      
  
      ol = (ol - tlen) / 8;
          
      if (ivl < 7) {
        throw new sjcl.exception.invalid("ccm: iv must be at least 7 bytes");
      }
      
      // compute the length of the length
      for (L=2; L<4 && ol >>> 8*L; L++) {}
      if (L < 15 - ivl) { L = 15-ivl; }
      iv = w.clamp(iv,8*(15-L));
      
      // decrypt
      out = sjcl.mode.ccm._ctrMode(prf, out, iv, tag, tlen, L);
      
      // check the tag
      tag2 = sjcl.mode.ccm._computeTag(prf, out.data, iv, adata, tlen, L);
      if (!w.equal(out.tag, tag2)) {
        throw new sjcl.exception.corrupt("ccm: tag doesn't match");
      }
      
      return out.data;
    },
  
    _macAdditionalData: function (prf, adata, iv, tlen, ol, L) {
      var mac, tmp, i, macData = [], w=sjcl.bitArray, xor = w._xor4;
  
      // mac the flags
      mac = [w.partial(8, (adata.length ? 1<<6 : 0) | (tlen-2) << 2 | L-1)];
  
      // mac the iv and length
      mac = w.concat(mac, iv);
      mac[3] |= ol;
      mac = prf.encrypt(mac);
    
      if (adata.length) {
        // mac the associated data.  start with its length...
        tmp = w.bitLength(adata)/8;
        if (tmp <= 0xFEFF) {
          macData = [w.partial(16, tmp)];
        } else if (tmp <= 0xFFFFFFFF) {
          macData = w.concat([w.partial(16,0xFFFE)], [tmp]);
        } // else ...
      
        // mac the data itself
        macData = w.concat(macData, adata);
        for (i=0; i<macData.length; i += 4) {
          mac = prf.encrypt(xor(mac, macData.slice(i,i+4).concat([0,0,0])));
        }
      }
  
      return mac;
    },
  
    /* Compute the (unencrypted) authentication tag, according to the CCM specification
     * @param {Object} prf The pseudorandom function.
     * @param {bitArray} plaintext The plaintext data.
     * @param {bitArray} iv The initialization value.
     * @param {bitArray} adata The authenticated data.
     * @param {Number} tlen the desired tag length, in bits.
     * @return {bitArray} The tag, but not yet encrypted.
     * @private
     */
    _computeTag: function(prf, plaintext, iv, adata, tlen, L) {
      // compute B[0]
      var mac, i, w=sjcl.bitArray, xor = w._xor4;
  
      tlen /= 8;
    
      // check tag length and message length
      if (tlen % 2 || tlen < 4 || tlen > 16) {
        throw new sjcl.exception.invalid("ccm: invalid tag length");
      }
    
      if (adata.length > 0xFFFFFFFF || plaintext.length > 0xFFFFFFFF) {
        // I don't want to deal with extracting high words from doubles.
        throw new sjcl.exception.bug("ccm: can't deal with 4GiB or more data");
      }
  
      mac = sjcl.mode.ccm._macAdditionalData(prf, adata, iv, tlen, w.bitLength(plaintext)/8, L);
  
      // mac the plaintext
      for (i=0; i<plaintext.length; i+=4) {
        mac = prf.encrypt(xor(mac, plaintext.slice(i,i+4).concat([0,0,0])));
      }
  
      return w.clamp(mac, tlen * 8);
    },
  
    /** CCM CTR mode.
     * Encrypt or decrypt data and tag with the prf in CCM-style CTR mode.
     * May mutate its arguments.
     * @param {Object} prf The PRF.
     * @param {bitArray} data The data to be encrypted or decrypted.
     * @param {bitArray} iv The initialization vector.
     * @param {bitArray} tag The authentication tag.
     * @param {Number} tlen The length of th etag, in bits.
     * @param {Number} L The CCM L value.
     * @return {Object} An object with data and tag, the en/decryption of data and tag values.
     * @private
     */
    _ctrMode: function(prf, data, iv, tag, tlen, L) {
      var enc, i, w=sjcl.bitArray, xor = w._xor4, ctr, l = data.length, bl=w.bitLength(data), n = l/50, p = n;
  
      // start the ctr
      ctr = w.concat([w.partial(8,L-1)],iv).concat([0,0,0]).slice(0,4);
      
      // en/decrypt the tag
      tag = w.bitSlice(xor(tag,prf.encrypt(ctr)), 0, tlen);
    
      // en/decrypt the data
      if (!l) { return {tag:tag, data:[]}; }
      
      for (i=0; i<l; i+=4) {
        if (i > n) {
          sjcl.mode.ccm._callProgressListener(i/l);
          n += p;
        }
        ctr[3]++;
        enc = prf.encrypt(ctr);
        data[i]   ^= enc[0];
        data[i+1] ^= enc[1];
        data[i+2] ^= enc[2];
        data[i+3] ^= enc[3];
      }
      return { tag:tag, data:w.clamp(data,bl) };
    }
  };

  




/** @fileOverview Arrays of bits, encoded as arrays of Numbers.
 *
 * @author Emily Stark
 * @author Mike Hamburg
 * @author Dan Boneh
 */

/**
 * Arrays of bits, encoded as arrays of Numbers.
 * @namespace
 * @description
 * <p>
 * These objects are the currency accepted by SJCL's crypto functions.
 * </p>
 *
 * <p>
 * Most of our crypto primitives operate on arrays of 4-byte words internally,
 * but many of them can take arguments that are not a multiple of 4 bytes.
 * This library encodes arrays of bits (whose size need not be a multiple of 8
 * bits) as arrays of 32-bit words.  The bits are packed, big-endian, into an
 * array of words, 32 bits at a time.  Since the words are double-precision
 * floating point numbers, they fit some extra data.  We use this (in a private,
 * possibly-changing manner) to encode the number of bits actually  present
 * in the last word of the array.
 * </p>
 *
 * <p>
 * Because bitwise ops clear this out-of-band data, these arrays can be passed
 * to ciphers like AES which want arrays of words.
 * </p>
 */
sjcl.bitArray = {
    /**
     * Array slices in units of bits.
     * @param {bitArray} a The array to slice.
     * @param {Number} bstart The offset to the start of the slice, in bits.
     * @param {Number} bend The offset to the end of the slice, in bits.  If this is undefined,
     * slice until the end of the array.
     * @return {bitArray} The requested slice.
     */
    bitSlice: function (a, bstart, bend) {
      a = sjcl.bitArray._shiftRight(a.slice(bstart/32), 32 - (bstart & 31)).slice(1);
      return (bend === undefined) ? a : sjcl.bitArray.clamp(a, bend-bstart);
    },
  
    /**
     * Extract a number packed into a bit array.
     * @param {bitArray} a The array to slice.
     * @param {Number} bstart The offset to the start of the slice, in bits.
     * @param {Number} blength The length of the number to extract.
     * @return {Number} The requested slice.
     */
    extract: function(a, bstart, blength) {
      // FIXME: this Math.floor is not necessary at all, but for some reason
      // seems to suppress a bug in the Chromium JIT.
      var x, sh = Math.floor((-bstart-blength) & 31);
      if ((bstart + blength - 1 ^ bstart) & -32) {
        // it crosses a boundary
        x = (a[bstart/32|0] << (32 - sh)) ^ (a[bstart/32+1|0] >>> sh);
      } else {
        // within a single word
        x = a[bstart/32|0] >>> sh;
      }
      return x & ((1<<blength) - 1);
    },
  
    /**
     * Concatenate two bit arrays.
     * @param {bitArray} a1 The first array.
     * @param {bitArray} a2 The second array.
     * @return {bitArray} The concatenation of a1 and a2.
     */
    concat: function (a1, a2) {
      if (a1.length === 0 || a2.length === 0) {
        return a1.concat(a2);
      }
      
      var last = a1[a1.length-1], shift = sjcl.bitArray.getPartial(last);
      if (shift === 32) {
        return a1.concat(a2);
      } else {
        return sjcl.bitArray._shiftRight(a2, shift, last|0, a1.slice(0,a1.length-1));
      }
    },
  
    /**
     * Find the length of an array of bits.
     * @param {bitArray} a The array.
     * @return {Number} The length of a, in bits.
     */
    bitLength: function (a) {
      var l = a.length, x;
      if (l === 0) { return 0; }
      x = a[l - 1];
      return (l-1) * 32 + sjcl.bitArray.getPartial(x);
    },
  
    /**
     * Truncate an array.
     * @param {bitArray} a The array.
     * @param {Number} len The length to truncate to, in bits.
     * @return {bitArray} A new array, truncated to len bits.
     */
    clamp: function (a, len) {
      if (a.length * 32 < len) { return a; }
      a = a.slice(0, Math.ceil(len / 32));
      var l = a.length;
      len = len & 31;
      if (l > 0 && len) {
        a[l-1] = sjcl.bitArray.partial(len, a[l-1] & 0x80000000 >> (len-1), 1);
      }
      return a;
    },
  
    /**
     * Make a partial word for a bit array.
     * @param {Number} len The number of bits in the word.
     * @param {Number} x The bits.
     * @param {Number} [_end=0] Pass 1 if x has already been shifted to the high side.
     * @return {Number} The partial word.
     */
    partial: function (len, x, _end) {
      if (len === 32) { return x; }
      return (_end ? x|0 : x << (32-len)) + len * 0x10000000000;
    },
  
    /**
     * Get the number of bits used by a partial word.
     * @param {Number} x The partial word.
     * @return {Number} The number of bits used by the partial word.
     */
    getPartial: function (x) {
      return Math.round(x/0x10000000000) || 32;
    },
  
    /**
     * Compare two arrays for equality in a predictable amount of time.
     * @param {bitArray} a The first array.
     * @param {bitArray} b The second array.
     * @return {boolean} true if a == b; false otherwise.
     */
    equal: function (a, b) {
      if (sjcl.bitArray.bitLength(a) !== sjcl.bitArray.bitLength(b)) {
        return false;
      }
      var x = 0, i;
      for (i=0; i<a.length; i++) {
        x |= a[i]^b[i];
      }
      return (x === 0);
    },
  
    /** Shift an array right.
     * @param {bitArray} a The array to shift.
     * @param {Number} shift The number of bits to shift.
     * @param {Number} [carry=0] A byte to carry in
     * @param {bitArray} [out=[]] An array to prepend to the output.
     * @private
     */
    _shiftRight: function (a, shift, carry, out) {
      var i, last2=0, shift2;
      if (out === undefined) { out = []; }
      
      for (; shift >= 32; shift -= 32) {
        out.push(carry);
        carry = 0;
      }
      if (shift === 0) {
        return out.concat(a);
      }
      
      for (i=0; i<a.length; i++) {
        out.push(carry | a[i]>>>shift);
        carry = a[i] << (32-shift);
      }
      last2 = a.length ? a[a.length-1] : 0;
      shift2 = sjcl.bitArray.getPartial(last2);
      out.push(sjcl.bitArray.partial(shift+shift2 & 31, (shift + shift2 > 32) ? carry : out.pop(),1));
      return out;
    },
    
    /** xor a block of 4 words together.
     * @private
     */
    _xor4: function(x,y) {
      return [x[0]^y[0],x[1]^y[1],x[2]^y[2],x[3]^y[3]];
    },
  
    /** byteswap a word array inplace.
     * (does not handle partial words)
     * @param {sjcl.bitArray} a word array
     * @return {sjcl.bitArray} byteswapped array
     */
    byteswapM: function(a) {
      var i, v, m = 0xff00;
      for (i = 0; i < a.length; ++i) {
        v = a[i];
        a[i] = (v >>> 24) | ((v >>> 8) & m) | ((v & m) << 8) | (v << 24);
      }
      return a;
    }
  };
  
  
  
  
  
  
  
  
  /** @fileOverview Bit array codec implementations.
 *
 * @author Emily Stark
 * @author Mike Hamburg
 * @author Dan Boneh
 */

/**
 * UTF-8 strings
 * @namespace
 */
sjcl.codec.utf8String = {
    /** Convert from a bitArray to a UTF-8 string. */
    fromBits: function (arr) {
      var out = "", bl = sjcl.bitArray.bitLength(arr), i, tmp;
      for (i=0; i<bl/8; i++) {
        if ((i&3) === 0) {
          tmp = arr[i/4];
        }
        out += String.fromCharCode(tmp >>> 8 >>> 8 >>> 8);
        tmp <<= 8;
      }
      return decodeURIComponent(escape(out));
    },
  
    /** Convert from a UTF-8 string to a bitArray. */
    toBits: function (str) {
      str = unescape(encodeURIComponent(str));
      var out = [], i, tmp=0;
      for (i=0; i<str.length; i++) {
        tmp = tmp << 8 | str.charCodeAt(i);
        if ((i&3) === 3) {
          out.push(tmp);
          tmp = 0;
        }
      }
      if (i&3) {
        out.push(sjcl.bitArray.partial(8*(i&3), tmp));
      }
      return out;
    }
  };







  /** @fileOverview Bit array codec implementations.
 *
 * @author Emily Stark
 * @author Mike Hamburg
 * @author Dan Boneh
 */

/**
 * Arrays of bytes
 * @namespace
 */
sjcl.codec.bytes = {
    /** Convert from a bitArray to an array of bytes. */
    fromBits: function (arr) {
      var out = [], bl = sjcl.bitArray.bitLength(arr), i, tmp;
      for (i=0; i<bl/8; i++) {
        if ((i&3) === 0) {
          tmp = arr[i/4];
        }
        out.push(tmp >>> 24);
        tmp <<= 8;
      }
      return out;
    },
    /** Convert from an array of bytes to a bitArray. */
    toBits: function (bytes) {
        var out = [], i, tmp=0;
        for (i=0; i<bytes.length; i++) {
            tmp = tmp << 8 | bytes[i];
            if ((i&3) === 3) {
                out.push(tmp);
                tmp = 0;
            }
        }
        if (i&3) out.push(sjcl.bitArray.partial(8*(i&3), tmp));
        return out;
    }
  };

  /**
 * ArrayBuffer
 * @namespace
 */
sjcl.codec.arrayBuffer = {
    /** Convert from a bitArray to an ArrayBuffer. */
    fromBits: function (arr) {
        var bl = sjcl.bitArray.bitLength(arr), out = new Uint8Array(Math.floor(bl/8)), i, tmp
        for (i=0; i<bl/8; i++) {
            if ((i&3) === 0) tmp = arr[i/4]
            out[i] = tmp >>> 24
            tmp <<= 8
        }
        return out
    }
  };







  /**
   * ArrayBufferWithIV
   * @namespace
   */
sjcl.codec.arrayBufferWithIV = {
    // Convert from a bitArray to an ArrayBuffer with the given IV (16 bytes) appended. 
    fromBits: function (arr, iv) {
        const byl = Math.ceil(sjcl.bitArray.bitLength(arr)/8),
            bytes = new Uint8Array(byl + 16)
        var tmp
        for (var i=0; i<byl; i++) {
            if ((i&3) === 0) tmp = arr[i/4]
            bytes[i] = tmp >>> 24
            tmp <<= 8
        }
        if (iv instanceof ArrayBuffer) iv = new Uint8Array(iv)
        else if (!(iv instanceof Uint8Array)) iv = Uint8Array.from(iv)
        bytes.set(iv, byl)
        return bytes.buffer
    },
    /** Convert from an ArrayBuffer of bytes to a bitArray and the previously appended 16 byte IV. */
    toBits: function (bytes) {
        var b8 = new Uint8Array(bytes),
            bits = [],
            byl = bytes.byteLength - 16,
            tmp = 0
        for (var i=0; i<byl; i++) {
            tmp = tmp << 8 | b8[i]
            if ((i&3) === 3) {
                bits.push(tmp)
                tmp = 0
            }
        }
        if (i&3) bits.push(sjcl.bitArray.partial(8*(i&3), tmp)) 
        return { bits, iv: b8.subarray(byl) }
    }
};





// Convert key string to Uint8Array
function toUint8Array (str) {
    const j = str.length,
        U8 = new Uint8Array(j)
    for (var i=0; i<j; i++) U8[i] = str.charCodeAt(i)
    return U8
}





// Depends on jsbn.js and jsbn2.js and rng.js
// Version 1.1: support utf-8 encoding

const Signa = {

    RSAKey: function RSAKey(keyInit) {

        // Generate a new random private key B bits long, using public expt E
        this.generate = function RSAGenerate(B) {
            const E = '10001'
            var rng = new SecureRandom
            var qs = B>>1;
            this.e = parseInt(E,16);
            var ee = new BigInteger(E,16);
            for(;;) {
                for(;;) {
                    this.p = new BigInteger(B-qs,1,rng);
                    if(this.p.subtract(BigInteger.ONE).gcd(ee).compareTo(BigInteger.ONE) == 0 && this.p.isProbablePrime(10)) break;
                }
                for(;;) {
                    this.q = new BigInteger(qs,1,rng);
                    if(this.q.subtract(BigInteger.ONE).gcd(ee).compareTo(BigInteger.ONE) == 0 && this.q.isProbablePrime(10)) break;
                }
                if(this.p.compareTo(this.q) <= 0) {
                    var t = this.p;
                    this.p = this.q;
                    this.q = t;
                }
                var p1 = this.p.subtract(BigInteger.ONE);
                var q1 = this.q.subtract(BigInteger.ONE);
                var phi = p1.multiply(q1);
                if(phi.gcd(ee).compareTo(BigInteger.ONE) == 0) {
                    this.n = this.p.multiply(this.q);
                    this.d = ee.modInverse(phi);
                    this.dmp1 = this.d.mod(p1);
                    this.dmq1 = this.d.mod(q1);
                    this.coeff = this.q.modInverse(this.p);
                    break
                }
            }
        }
  
        // Return the PKCS#1 RSA encryption of "text" as a compressed ArrayBuffer
        this.encrypt = function RSAEncrypt (text) {
            var m = Signa.pkcs1pad2(text,(this.n.bitLength()+7)>>3);
            if(m == null) return null;
            var c = m.modPowInt(this.e, this.n)
            if(c == null) return null;
            var h = c.toString(16);
            if((h.length & 1) == 0) return h; else return "0" + h;
        }
        
        // Return the PKCS#1 RSA decryption of ArrayBuffer, output is a plain string.
        this.decrypt = function RSADecrypt(ctext, output) {
            var c = new BigInteger(ctext, 16);
            if(this.p == null || this.q == null) return x.modPow(this.d, this.n);
            var xp = c.mod(this.p).modPow(this.dmp1, this.p);
            var xq = c.mod(this.q).modPow(this.dmq1, this.q);
            while(xp.compareTo(xq) < 0) xp = xp.add(this.p);
            const m = xp.subtract(xq).multiply(this.coeff).mod(this.p).multiply(this.q).add(xq);
            if(m == null) return null;
            const str = Signa.pkcs1unpad2(m, (this.n.bitLength()+7)>>3);
            return output === 1 ? toUint8Array(str) : str
        }

        this.getPublicKey = function getpublicKey () {
            return this.publicKey = Signa.packNumberString(this.n.toString())
        }

        this.setPublicKey = function setPublicKey (publicKey) {
            this.publicKey = (publicKey instanceof ArrayBuffer) ? new Uint8Array(publicKey) : publicKey
            this.n = new BigInteger
            this.n.fromString(Signa.unpackNumberString(this.publicKey))
            this.e = 65537
        }

        if (!isNaN(keyInit)) this.generate(keyInit)
    },

    packNumberString: function packNumberString (str) {
        const j=str.length,
            odd = j&1,
            packed = new Uint8Array(new ArrayBuffer(Math.ceil(j/2)+odd))
        for (var i=0; i<j; i+=2) {
            const next = i+1
            var half = i/2
            packed[half] = (+str[i]<<4)+(+str[next]||0)
        }
        if (odd) packed[half+1] = 0xFF
        return packed.buffer
    },

    unpackNumberString: function unpackNumberString (packed) {
        if (packed instanceof ArrayBuffer) packed = new Uint8Array(packed)
        const j = packed.length,
            odd = packed[j-1]===0xFF ? 3 : 0,
            length = (j<<1) - odd,
            unpacked = new Uint8Array(length),
            zero = 48
        for (var i=0; i<length; i+=2) {
            const charcode = packed[i>>1],
                next = i+1
            unpacked[i] = zero+(charcode>>4)
            if (next<length) unpacked[next] = zero+(charcode & 0x0F)
        }
        return String.fromCharCode.apply(null, unpacked)
    },

    // PKCS#1 (type 2, random) pad input string s to n bytes, and return a bigint
    pkcs1pad2: function pkcs1pad2(s,n) {
        // TODO: fix for utf-8
        if (n < s.length + 11) return console.log("Message too long for RSA")
        var ba = new Array
        var i = s.length - 1;
        while (i >= 0 && n > 0) {
            var c = (s instanceof Object) ? s[i--] : s.charCodeAt(i--);
            if(c < 128) { // encode using utf-8
                ba[--n] = c;
            }
            else if((c > 127) && (c < 2048)) {
                ba[--n] = (c & 63) | 128;
                ba[--n] = (c >> 6) | 192;
            }
            else {
                ba[--n] = (c & 63) | 128;
                ba[--n] = ((c >> 6) & 63) | 128;
                ba[--n] = (c >> 12) | 224;
            }
        }
        ba[--n] = 0;
        var rng = new SecureRandom
        var x = new Array
        while(n > 2) { // random non-zero pad
            x[0] = 0;
            while(x[0] == 0) rng.nextBytes(x);
            ba[--n] = x[0];
        }
        ba[--n] = 2;
        ba[--n] = 0;
        return new BigInteger(ba);
    },
  
    // Undo PKCS#1 (type 2, random) padding and, if valid, return the plaintext
    pkcs1unpad2: function pkcs1unpad2(d,n) {
        var b = d.toByteArray();
        var i = 0;
        while (i < b.length && b[i] == 0) ++i;
        if (b.length-i != n-1 || b[i] != 2)
        return null;
        ++i;
        while(b[i] != 0) if(++i >= b.length) return null;
        var ret = "";
        while (++i < b.length) {
            var c = b[i] & 255;
            if (c < 128) { // utf-8 decode
                ret += String.fromCharCode(c);
            }
            else if (c > 191 && c < 224) {
                ret += String.fromCharCode(((c & 31) << 6) | (b[i+1] & 63));
                ++i;
            }
            else {
                ret += String.fromCharCode(((c & 15) << 12) | ((b[i+1] & 63) << 6) | (b[i+2] & 63));
                i += 2;
            }
        }
        return ret;
    },

    randomKey: function randomKey (keySize) {
        const random = new SecureRandom,
            bytes = new Uint8Array(keySize/8)
        random.nextBytes(bytes)
        return bytes
    },

    AESKey: function AESKey (keyInit) {
        
        var aes, keyBitSize

        this.generate = function AESGenerate (keySize) {
            if (keySize) this.key = Signa.randomKey(keyBitSize = keySize)
            aes = new sjcl.cipher.aes(sjcl.codec.bytes.toBits(this.key))
        }

        this.encrypt = function AESEncrypt (plaintext) {
            const binary = plaintext instanceof Object,
                iv8 = Signa.randomKey(128)
            iv8[0] = (iv8[0] & 0xFE) + (binary?0x01:0x00)
            const iv = sjcl.codec.bytes.toBits(iv8),
                plainbits = binary ? sjcl.codec.bytes.toBits(plaintext) : sjcl.codec.utf8String.toBits(plaintext),
                cipherbits = sjcl.mode.ccm.encrypt(aes, plainbits, iv, '', 128, keyBitSize)
            return sjcl.codec.arrayBufferWithIV.fromBits(cipherbits, iv8)
        }

        this.prepare = function AESPrepare (key) {
            keyBitSize = key.length * 8
            if (key) this.key = key
            aes = new sjcl.cipher.aes(sjcl.codec.bytes.toBits(key || this.key))
        }

        this.decrypt = function AESDecrypt (cipherbuffer) {
            const cipher = sjcl.codec.arrayBufferWithIV.toBits(cipherbuffer),
                iv = sjcl.codec.bytes.toBits(cipher.iv),
                plain = sjcl.mode.ccm.decrypt(aes, cipher.bits, iv, '', 128, keyBitSize),
                binary = cipher.iv[0] & 0x01
            return binary ? sjcl.codec.arrayBuffer.fromBits(plain) : sjcl.codec.utf8String.fromBits(plain)
        }

        if (!isNaN(keyInit)) this.generate(keyInit)
        else if (keyInit.length) this.prepare(keyInit)
    },
}

})()
