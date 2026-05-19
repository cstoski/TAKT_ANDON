'use strict'

function TTEvents (forms, get, unget, showErrorBox, debug, since, timerFormat) {

    TTEvents.consume = consume
    TTEvents.form = form
    TTEvents.notify = notify
    TTEvents.getUser = getUser
    TTEvents.allowed = allowed
    TTEvents.registerCallback = registerUser
    TTEvents.formCallback = formCallback
    TTEvents.scrollAndonMessage = scrollAndonMessage

    var timestamps = {},
        numStations = 0,
        user,
        formCallbacks = {},
        andon_scroll_timer

    function registerUser (obj) {
        if (obj.uuid && obj.role) user = Object.assign({}, obj)
    }

    function getUser (field) {
        if (!(user instanceof Object)) return ''
        return user[field] || ''
    }

    function allowed (roles) {
        if (!(user instanceof Object)) return
        if (user.role === 6) return true
        if (!Array.isArray(roles) || !roles.length) return false
        return roles.indexOf(user.role) > -1
    }

    function formCallback (form_name, callback) {
        if (callback instanceof Function) formCallbacks[form_name] = callback
    }

    /*
    function toggleIt () {
        setTimeout(toggleIt, 500)
        if (get('analytics-distribution-graph')) get('analytics-distribution-graph').style.visibility = get('analytics-distribution-graph').style.visibility === 'visible' ? 'hidden' : 'visible'
    }
    toggleIt()
    */

    function consume (messages) {
        if (!messages) return false
        if (!Array.isArray(messages)) messages = [messages]
        var seenDatetime
        var seenStation
        var seenAndon
        var seenTimes
        var seenProduction
        //var seenShift
        for (var i=messages.length-1; i>=0; i--) {
            if (!(messages[i] instanceof Object) || !Object.keys(messages[i]).length) continue
            var message = messages[i]

            //debug(message) //TODO: remove for production
            const screen1 = !!get('screen1'),
                screen2 = !!get('screen2'),
                screen10 = !!get('screen10'),
                either = message.dashboard || message.dashboard2
            /*
            if ('authenticated' in message) {
                if (message.authenticated === 2) {
                    if (message.user instanceof Object) registerUser(message.user)
                    else console.log('MISSING AUTHENTICATED USER DATA.')
                }
                else console.log('NOT AUTHENTICATED:', messagej)
                continue
            }
            */
            if (either instanceof Object) {
                /*
                if (either.shift && 'paused' in either.shift) {
                    if (typeof either.shift.paused === 'string') {
                        if (get('dashboard-paused').style.visibility !== 'visible') get('dashboard-paused').style.visibility = 'visible'
                        get('dashboard-paused').innerHTML = either.shift.paused.toUpperCase()
                    }
                    else {
                        if (get('dashboard-paused').style.visibility !== 'hidden') get('dashboard-paused').style.visibility = 'hidden'
                        get('dashboard-paused').innerHTML = ''
                    }
                }
                */
                if (!seenDatetime && either.times && 'datetime' in either.times) {
                    seenDatetime = true
                    const d = either.times.datetime,
                        datestring = TEXT.array_weekdays[d.dow].substring(0,3) + ' ' + TEXT.array_months[d.month-1].substring(0,3) + ' ' + (''+d.date).padStart(2,'0'),
                        timestring = (''+d.hour).padStart(2,'0') + ':' + (''+d.minute).padStart(2,'0')
                    if (screen1) {
                        get('dashboard-currentdate').innerText = datestring
                        get('dashboard-currenttime').innerText = timestring
                    }
                    if (screen2) {
                        get('analytics-currentdate').innerText = datestring
                        get('analytics-currenttime').innerText = timestring
                    }
                    if (d.paused) {
                        if (get('dashboard-paused').style.visibility !== 'visible') get('dashboard-paused').style.visibility = 'visible'
                        get('dashboard-paused').innerText = d.paused === true ? TEXT.phrase_shift_inactive : d.paused.toUpperCase()
                    }
                    else {
                        if (get('dashboard-paused').style.visibility !== 'hidden') get('dashboard-paused').style.visibility = 'hidden'
                        get('dashboard-paused').innerText = ''
                    }
                }
                if (/*!seenShift &&*/ either.shift && 'shift' in either.shift) {
                    //seenShift = true
                    const sh = either.shift.shift
                    if (screen1) get('dashboard-shift').innerText = sh || '-'
                    if (screen2) get('dashboard2-shift').innerText = sh ? 'T'+sh : ''
                    if (screen10) get('layout-shift').innerText = sh || '-'
                }
            }
            if (message.reload) return location.reload()
            else if (message.dashboard instanceof Object) {
                if (screen1 || screen10) {
                    for (var d in message.dashboard) {
                        const dat = message.dashboard[d]
                        //
                        //if (debug(dat, d)) break
                        //showErrorBox(d + ': ' + JSON.stringify(dat))
                        //
                        if (d === 'station') {
                            if (seenStation) continue; else seenStation = true
                            if (screen1) {
                                const num = Object.keys(dat).length,
                                    drawn = get('stations').children.length,
                                    basis = 100 / Math.ceil(num / 4)
                                if (!drawn && num === 14) {
                                    var html = ''
                                    for (var j in dat) {
                                        html += `
                                            <div id="station-status-${j}" class="station-status" style="flex-basis:${basis}%">
                                                <span id="station-status-number-${j}" class="station-status-number">${dat[j].name}</span><br/>
                                                <span id="station-status-timestamp-${j}">&nbsp;</span>
                                            </div>
                                        `
                                    }
                                    get('stations').innerHTML = html
                                }
                                if (drawn || num === 14) {
                                    if (numStations < num) numStations = num
                                    if (displayStatus.timer) clearTimeout(displayStatus.timer)
                                    displayStatus(dat)
                                }
                            }
                            if (screen10) {
                                const num10 = Object.keys(dat).length,
                                    drawn10 = get('stations-layout').children.length
                                if (!drawn10 && num10 === 14) {
                                    var html10 = ''
                                    for (var j in dat) {
                                        if (!isNaN(dat[j].x) && !isNaN(dat[j].y)) html10 += `
                                            <div id="station-layout-status-${j}" class="station-layout-status" style="top: ${dat[j].y}%; left: ${dat[j].x}%;">
                                                <div id="station-layout-status-number-${j}" class="station-layout-status-number">${dat[j].name}</div>
                                            </div>
                                        `
                                    }
                                    get('stations-layout').innerHTML = html10
                                }
                                if (drawn10 || num10 === 14) {
                                    if (numStations < num10) numStations = num10
                                    if (displayStatus.timer) clearTimeout(displayStatus.timer)
                                    displayStatus(dat)
                                }
                            }
                        } else if (d === 'andon') {
                            if (seenAndon) continue; else seenAndon = true
                            if (screen1) {
                                const length = get('andon-message-text').innerText.length
                                get('andon-message-text').innerHTML = dat.text || '---'
                                scrollAndonMessage(length)
                            }
                        }
                    }
                }
            }
            else if (message.dashboard2 instanceof Object) {
                if (screen2) {
                    for (var d in message.dashboard2) {
                        const dat = message.dashboard2[d]
                        if (d === 'times') {
                            if (seenTimes) continue; else seenTimes = true
                            var start = 0,
                                total_proportion = 0
                            const colors = ['red', 'yellow', 'blue', 'green']
                            for (var i in colors) total_proportion += dat[colors[i]+'_pc']
                            for (var i in colors) {
                                if (!((colors[i]+'_pc') in dat)) continue
                                const current = total_proportion ? dat[colors[i]+'_pc'] / total_proportion * 189 : 0
                                const style = get('distribution-graph-' + colors[i]).style
                                //const style = get('analytics-distribution-graph').children[0].children[i]
                                if (!style) continue
                                style.strokeDasharray = `0 ${start}% ${current}% 100%`
                                //style.strokeWidth = '56%'
                                //style.stroke = colors[i]
                                start += current
                            }
                            if ('taktremain' in dat) get('analytics-taktremain').innerText = timerFormat(+dat.taktremain * 1000, true, false)
                            if ('runtime' in dat && 'plan_runtime' in dat) {
                                get('analytics-runtime').innerText = timerFormat(dat.runtime, true, false)
                                get('cadence-graph-arrow').style.left = Math.min(1, dat.plan_runtime ? (dat.runtime / dat.plan_runtime) : 0) * 100 - 24 + '%'
                            }
                            if ('redtime' in dat) get('analytics-redtime').innerText = timerFormat(dat.redtime, true, false)
                            if ('green_pc' in dat) get('analytics-distribution-green-pc').innerText = (dat.green_pc * 100).toFixed(1)
                            if ('yellow_pc' in dat) get('analytics-distribution-yellow-pc').innerText = (dat.yellow_pc * 100).toFixed(1)
                            if ('blue_pc' in dat) get('analytics-distribution-blue-pc').innerText = (dat.blue_pc * 100).toFixed(1)
                            if ('red_pc' in dat) get('analytics-distribution-red-pc').innerText = (dat.red_pc * 100).toFixed(1)
                        }
                        else if (d === 'production') {
                            if (seenProduction) continue; else seenProduction = true
                            if ('accepted' in dat) get('production-prod-shift').innerText = get('cadence-graph-done').innerText = dat.accepted
                            if ('rejected' in dat) get('production-reject-shift').innerText = dat.rejected
                            if ('accepted_day' in dat) get('production-prod-day').innerText = dat.accepted_day || 0
                            if ('rejected_day' in dat) get('production-reject-day').innerText = dat.rejected_day || 0
                            if ('remaining' in dat) {
                                get('cadence-graph-left').innerText = Math.max(0, dat.remaining)
                                if ('accepted' in dat) {
                                    const pc = Math.min(100, (dat.accepted / ((dat.accepted + Math.max(0, dat.remaining)) || 0.01)) * 100)
                                    get('cadence-graph-bar').style.width = 100 - pc + '%'
                                    get('cadence-graph-indicator').style.left = pc - 1 + '%'
                                }
                            }
                            const metrics = ['oee', 'availability', 'performance', 'quality']
                            for (var j in metrics) {
                                if (metrics[j] in dat) {
                                    const metric = Math.min(100, dat[metrics[j]] * 100).toFixed(1)
                                    get('analytics-' + metrics[j]).innerText = metric + '%'
                                    get('analytics-graph-' + metrics[j]).style.width = (100 - metric) + '%'
                                }
                            }
                        }
                        else if (d === 'shift') {
                            //if (seenShift) continue; else seenShift = true
                            if ('shift' in dat || 'unshift' in dat) get('dashboard2-shift').innerText = dat.shift ? 'T'+dat.shift : dat.unshift ? 'T'+dat.unshift : ''
                            if ('plan' in dat) get('production-plan-shift').innerText = dat.plan || 0
                            if ('plan_day' in dat) get('production-plan-day').innerText = dat.plan_day || 0
                        }
                    }
                }
            }
            else {
                if (message.form && message.form.name) {
                    if (!(formCallbacks[message.form.name] instanceof Function) || !formCallbacks[message.form.name](message.form)) {
                        for (var c in message.form.fields) {
                            updateElement(c, message.form.fields[c])
                            const ele = get(c)
                            /*
                            if (ele && message.form && !message.form.submit) {
                                const which = ele.parentElement.id.startsWith('field-highlight-') ? ele.parentElement : ele
                                which.classList.add('update-highlight')
                                setTimeout((function(){ this.classList.add('update-highlight-fade') }).bind(which), 30)
                                setTimeout((function(){ this.classList.remove('update-highlight') }).bind(which), 1000)
                                notify(`<div>!</div> Some data changed while editing form, please review before saving.`)
                            }
                            */
                        }
                    }
                    if (message.form.submit) {
                        if (!message.form.error && get(message.form.submit) && get(message.form.submit+'-checkmark')) {
                            const ele = get(message.form.submit+'-checkmark').parentElement
                            ele.classList.add('button-checkmark-container-show')
                            setTimeout(()=>{ ele.classList.remove('button-checkmark-container-show') }, 3000)
                        }
                        for (var e in forms[message.form.name]) {
                            const ele = forms[message.form.name][e],
                                which = (ele.parentElement && ele.parentElement.id.startsWith('field-highlight-')) ? ele.parentElement : ele
                            which.classList.remove('update-highlight-fade')
                        }
                    }
                }
                if (message.bypass instanceof Object) {
                    for (var c in message.bypass) {
                        if (!get(c)) continue
                        const length = get('andon-message-text') && get('andon-message-text').innerText.length
                        updateElement(c, message.bypass[c], true)
                        if (c === 'andon-message-text') scrollAndonMessage(length)
                    }
                }
            }
        }
        return false
    }

    function updateElement (id, item, direct) {
        const ele = get(id)
        if (!ele || item === undefined) return
        if (ele.nodeName === 'SELECT') {
            item = ''+item
            for (var a in ele.children) {
                if (ele.children[a].value === item) {
                    if (!direct) ele.setAttribute('undovalue', ele.hasAttribute('undovalue') ? ele.selectedIndex : a)
                    ele.selectedIndex = +a
                }
            }
        } else if (ele.nodeName === 'INPUT') {
            if (ele.type === 'checkbox' || ele.type === 'radio') {
                if (typeof item === 'boolean') ele.checked = item
            } else if (ele.type === 'text') {
                if (!direct) ele.setAttribute('undovalue', ele.hasAttribute('undovalue') ? ele.value : item)
                ele.value = item
            }
        } else if ('innerHTML' in ele) {
            if (item instanceof Object) for (var upd in item) ele[upd] = item[upd]
            else ele.innerHTML = item
            return
        }
    }

    function displayStatus (data) {
        if (!displayStatus.data) displayStatus.data = data
        displayStatus.timer = setTimeout(displayStatus.bind(undefined, displayStatus.data), 1000)
        const which = displayStatus.which = 1 - (displayStatus.which||0),
            screen1 = !!get('screen1'),
            screen10 = !!get('screen10')
        for (var station in displayStatus.data) {
            if (displayStatus.data !== data && data[station]) Object.assign(displayStatus.data[station], data[station])
            const error = (displayStatus.data[station].status||0) < 1,
                stat = displayStatus.data[station].status,
                attending = displayStatus.data[station].attending
            if (stat === 7 && (!attending || !attending.length)) continue
            const status = stat === 7 ? (which * 2) + (attending[which] ? 1 : 0) + 1 : stat
            if (station in data) {
                if (stat === 8) displayStatus.data[station].timestamp = displayStatus.data[station].timestamp7 = undefined
                timestamps[station] = error ? [-1] : [displayStatus.data[station].timestamp, displayStatus.data[station].timestamp7]
            }
            if (screen1) {
                if (!timestamps[station][0]) get('station-status-timestamp-' + station).innerHTML = '&nbsp;'
                else if (timestamps[station][0] < 0) get('station-status-timestamp-' + station).innerText = '!!!'
                else get('station-status-timestamp-' + station).innerText = timerFormat(Math.max(0, since(timestamps[station][stat === 7 ? which : 0])), true, false)
            }
            if ((station in data) || stat === 7) {
                const color = Math.ceil(status / 2) || 0,
                    attend = status && status < 8 && status % 2 === 0
                if (screen1) {
                    if (get('station-status-' + station) && get('station-status-number-' + station)) {
                        get('station-status-' + station).classList = `station-status station-status-color-${color} ${attend ? 'station-status-border-'+color : ''}`
                        get('station-status-number-' + station).classList = `station-status-number station-status-number-${color}`
                    }
                }
                if (screen10) {
                    if (get('station-layout-status-' + station) && get('station-layout-status-number-' + station)) {
                        get('station-layout-status-' + station).classList = `station-layout-status station-status-color-${color} ${attend ? 'station-status-border-'+color : ''}`
                        get('station-layout-status-number-' + station).classList = `station-layout-status-number station-status-number-${color}`
                    }
                }
            }
        }
    }

    function scrollAndonMessage (length) {
        const ele = get('andon-message-text'),
            firstRun = andon_scroll_timer === undefined
        if (!firstRun && length === ele.innerText.length) return
        const right = ele.parentElement.offsetWidth,
            width = ele.offsetWidth,
            duration = (right + width) * 5,
            delay = 100
        ele.style.transition = ''
        ele.style.transform = `translateX(${right}px)`
        setTimeout(()=>{
            ele.style.transition = `transform ${duration}ms linear`
            ele.style.transform = `translateX(${-width}px)`
        }, delay)
        clearTimeout(andon_scroll_timer)
        andon_scroll_timer = setTimeout(scrollAndonMessage.bind(undefined, -1), duration + delay)
    }

    function form (form_name, form_submit) {
        notify()
        const fields = {},
            event = { form: { name: form_name, submit: form_submit, fields: fields } }
        if (!forms[form_name]) return
        for (var field_name in forms[form_name]) {
            const ele = forms[form_name][field_name]
            if (!ele) continue
            if (ele.getAttribute('dirty')) {
                forms[form_name][field_name].setAttribute('dirty', '')
                if (ele.type === 'checkbox' || ele.type === 'radio') fields[field_name] = ele.checked
                else {
                    if ('value' in ele) fields[field_name] = ele.value.trim()
                    ele.setAttribute('undovalue', ele.nodeName === 'SELECT' ? ele.selectedIndex : ele.value)
                }
            }
            if (get(field_name) && get(field_name).nextElementSibling)
                get(field_name).nextElementSibling.classList.remove('undo-box-show')
        }
        return event
    }

    function notify (content) {
        if (!get('notify')) {
            Object.assign(get('notify', 'div'), {
                classList: 'notify'
            })
            document.body.append(get('notify'))
        }
        if (content === undefined) {
            get('notify').classList.remove('notify-show')
            get('notify').innerText = ''
        } else {
            get('notify').innerHTML = content
            setTimeout(()=>{ get('notify').classList.add('notify-show') }, 30)
            setTimeout(()=>{ get('notify').classList.remove('notify-show') }, 5000)
        }
    }
}
