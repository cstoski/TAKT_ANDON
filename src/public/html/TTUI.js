//Takt Time UI
'use strict'

function TTUI (pathname) {

    window.addEventListener('error', error)
    window.addEventListener('unhandledrejection', error)
    window.addEventListener('rejectionhandled', error)
    function error (e) { debug({ stack: (e && e.error) ? e.error.stack : undefined }, 2) }

    const urlInsecure = location.host+'/secure',
        urlSecure = location.host+'/secure',
        element = {},
        forms = {},
        state = { caches: {} },
        one_second_ms = 1000,
        one_minute = 60,
        one_minute_ms = one_minute * one_second_ms,
        one_hour = 60 * 60,
        one_hour_ms = one_hour * 1000,
        one_day_ms = 60 * 60 * 24 * 1000,
        hours_24 = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23'],
        minutes_5_interval = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'],
        minutes_1_interval = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51', '52', '53', '54', '55', '56', '57', '58', '59'],
        start_page = [0, showScreen_Welcome, showScreen_Welcome, showScreen_Welcome, showScreen_Welcome, showScreen_Welcome, showScreen_Welcome, showScreen_Welcome],
        SHIFTS = 2,
        STOPPAGES = 6,
        CLEAR = 1,
        idleTimeoutPeriod = 10 * one_minute_ms,
        eventQueryTimeout = 60 * one_second_ms,
        reportQueryTimeout = 60 * one_second_ms,
        PERMISSIONS = {
            //                  NONE    OPER   COORD   MNGR    MAINT   ADMIN   DEV     GUEST    LEAD    SPEC
            form_message:       [0,     0,     null,   null,   0,      0,      null,   0,       0,      false],
            line_entry:         [0,     0,     0,      0,      0,      0,      0,   0,       0,      0],
            form_roles:         [0,     0,     0,      null,   0,      null,   null,   0,       0,      0],
            form_database:      [0,     0,     0,      0,      0,      null,   null,   0,       0,      0],
            form_production:    [0,     0,     0,      0,      0,      null,   null,   0,       0,      0],
            form_mail:          [0,     0,     0,      0,      0,      null,   null,   0,       0,      0],
            plan_entry:         [0,     0,     null,   null,   0,      0,      null,   0,       0,      false],
            shifts_entry:       [0,     0,     null,   null,   0,      0,      null,   0,       0,      false],
            holiday_entry:      [0,     0,     null,   null,   0,      0,      null,   0,       0,      false],
            stops_entry:        [0,     0,     null,   null,   0,      0,      null,   0,       0,      false],
            stations_entry:     [0,     0,     0,      null,   null,   0,      null,   0,       0,      0],
            plc_maintenance:    [0,     0,     0,      false,  null,   0,      null,   0,       0,      0],
            form_test:          [0,     0,     null,   null,   null,   0,      null,   0,       0,      0],
            form_plc:           [0,     0,     0,      false,  null,   0,      null,   0,       0,      0],
            form_test_takt:     [0,     0,     null,   null,   null,   0,      null,   0,       0,      0],
            form_agc:           [0,     0,     false,  null,   0,      0,      null,   0,       0,      0],
            form_scheduler_run: [0,     0,     null,   null,   null,   0,      null,   0,       0,      0],
            form_reset_only:    [0,     0,     null,   null,   null,   0,      null,   0,       0,      0],
            form_reset_clear:   [0,     0,     null,   null,   null,   0,      null,   0,       0,      0],
            form_report:        [0,     0,     null,   null,   0,      0,      null,   0,       0,      0],
            form_user_role:     [0,     0,     0,      null,   0,      null,   null,   0,       0,      0],
            form_users:         [0,     false, false,  null,   0,      null,   null,   0,       0,      0],
            schedule:           [0,     false, false,  false,  false,  false,  false,  false,   false,  false],
            form_events:        [0,     null,  null,   null,   0,      0,      null,   0,       null,   null],
            form_event_details: [0,     null,  null,   null,   0,      0,      null,   0,       null,   false],
            form_event_approve: [0,     0,     null,   null,   0,      0,      null,   0,       null,   false],
            form_event:         [0,     null,  null,   null,   0,      0,      null,   0,       true,   null],
        }
    var secure = true,
        mouseThrottling,
        idleTimeout

    TTEvents(forms, get, unget, showErrorBox, debug, since, timerFormat)
    addEventListener('resize', adjustFontSize)
    checkTimechange()
    
    switch (pathname.toLowerCase()) {
        case '/tv': showErrorBox(TEXT.title_connection_error); secure = false; showTV1(); break
        case '/tv2': showErrorBox(TEXT.title_connection_error); secure = false; showTV2(); break
        default: onbeforeunload = exitApp; onhashchange = preventBackButton; preventBackButton(true); showLogin(); break
    }
    
    function debug (obj, level) {
        Transport.send(secure ? urlSecure : urlInsecure, Object.assign((obj instanceof Object) ? obj : { message: obj }, { time: Date.now(), debug: level||1 }))
    }

    function since (then, now) {
        return Transport.since(secure ? urlSecure : urlInsecure, then, now)
    }

    function checkTimechange () {
        clearTimeout(checkTimechange.timer)
        const repetition = 2500,
            now = Date.now()
        if (checkTimechange.timestamp && Math.abs(now - checkTimechange.timestamp) > (repetition + 500)) {
            Transport.timebeat(secure ? urlSecure : urlInsecure, now)
        }
        checkTimechange.timestamp = now
        checkTimechange.timer = setTimeout(checkTimechange, repetition)
    }

    function permission (resource) {
        if (!(resource in PERMISSIONS)) return
        const role = TTEvents.getUser('role')
        return PERMISSIONS[resource][role] === false || PERMISSIONS[resource][role] === true || PERMISSIONS[resource][role] === null
    }
        
    function adjustFontSize () {
        const ele = (get('screen1') && !get('screen1').classList.contains('screen-hide'))
            ? get('dashboard-format')
            : (get('screen2') && !get('screen2').classList.contains('screen-hide'))
                ? get('dashboard2-format')
                : undefined
        if (!ele) return
        ele.style.fontSize = (ele.offsetHeight / 100) + 'px'
    }

    function exitApp (e) {
        if (idleTimeout === true) return
        if (!TTEvents.getUser('uuid') && (state.currentScreen === 'screen1' || state.currentScreen === 'screen2')) {
            e && e.preventDefault()
            return
        }
        return TEXT.phrase_exit_app
    }

    function preventBackButton (init) {
        if (init === true) location.hash = '#!'
        if (init === true || location._hash !== '#') {
            location._hash = '#'
            setTimeout(()=>{
                location._hash = undefined
                location.hash = '#'
            }, 250)
        }
    }

    function setIdleTimeout (e) {
        if (mouseThrottling) return
        mouseThrottling = true
        setTimeout(()=>{ mouseThrottling = false }, 1000)
        if (document.hidden) return
        clearTimeout(idleTimeout)
        idleTimeout = setTimeout(()=>{ idleTimeout = true; location.reload() }, idleTimeoutPeriod)
    }
    
    function showTV1 () {
        Transport.set({
            url: urlInsecure,
            handler: TTEvents.consume,
            callback: showScreen_Dashboard1,
            error: showErrorBox,
            refresh: refreshDashboards,
        })
        showFullscreenMask()
    }

    function showTV2 () {
        Transport.set({
            url: urlInsecure,
            handler: TTEvents.consume,
            callback: showScreen_Dashboard2,
            error: showErrorBox,
            refresh: refreshDashboards,
        })
        showFullscreenMask()
    }

    function showFullscreenMask () {
        get('fullscreen').style.display = 'block'
        document.documentElement.addEventListener('click', goFullscreen)
        document.addEventListener('fullscreenchange', changeFullscreen)
    }

    function goFullscreen (e) {
        var isInFullScreen = (document.fullscreenElement && document.fullscreenElement !== null) ||
        (document.webkitFullscreenElement && document.webkitFullscreenElement !== null) ||
        (document.mozFullScreenElement && document.mozFullScreenElement !== null) ||
        (document.msFullscreenElement && document.msFullscreenElement !== null);

        var docElm = document.documentElement;
        if (!isInFullScreen) {
            if (docElm.requestFullscreen) {
                docElm.requestFullscreen();
            } else if (docElm.mozRequestFullScreen) {
                docElm.mozRequestFullScreen();
            } else if (docElm.webkitRequestFullScreen) {
                docElm.webkitRequestFullScreen();
            } else if (docElm.msRequestFullscreen) {
                docElm.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }

    function changeFullscreen (e) {
        if (document.fullscreenElement) get('fullscreen').style.cursor = 'pointer'
        else get('fullscreen').style.cursor = 'zoom-in'
    }

    function refreshDashboards () {
        if (get('screen1')) Transport.send(urlInsecure, { dashboard: true })
        if (get('screen2')) Transport.send(urlInsecure, { dashboard2: true })
    }

    function pdow (day) {
        return day ? day - 1 : 6
    }
    
    function hour_minute (time_tuple) {
        if (!(time_tuple instanceof Object) || isNaN(+time_tuple[0]) || isNaN(+time_tuple[1])) return 0
        return ((+time_tuple[0] || 0) * 60 + (+time_tuple[1] || 0)) * 60 * 1000
    }
        
    function showLogin () {
        if (!get('loginBox')) {
            Object.assign(get('loginBox', 'div'), {
                classList: 'loginBox',
                innerHTML: `
                    <div class="table-centered">
                        <span class="inside-centered margin-8px">
                            <div class="screen-subtitle centered">${TEXT.login_prompt}</div>
                            <form action="#" method="POST" id="loginBoxForm">
                                <div class="login-icon user-icon"></div><input id="username" name="username" type="text" autocomplete="username"/>
                                <div class="login-icon password-icon"></div><input id="password" name="password" type="password" autocomplete="current-password"/>
                                ${draw_button('login-button', 'button-login.svg', `<span style="color:black;">${TEXT.login_button}</span>`)}
                            </form>
                            <span id="loginError"></span>
                        </span>
                    </div>
                `
            })
            document.body.append(get('loginBox'))
            get('username').focus()
            get('login-button').addEventListener('click', checkLoginForm)
            get('loginBoxForm').addEventListener('submit', loginUIResponse)
            submitOnEnter('username', 'login-button')
            submitOnEnter('password', 'login-button')
        }
        setTimeout(()=>{ get('loginBox').classList.add('loginBox-show') }, 30)
    }

    function showMenuIcon () {
        if (get('menu-icon')) {
            get('menu-user').innerText = `${TTEvents.getUser('firstname')} ${TTEvents.getUser('lastname')}`
            get('menu-icon').classList.add('menu-show')
        } else {
            Object.assign(get('menu-container2', 'div'), {
                classList: 'menu-container max-width',
                innerHTML: `
                    <div id="menu-panel" class="menu-panel menu-panel-hide">
                        <div class="menu-logo"></div>
                    </div>    
                `,
            })
            Object.assign(get('menu-container', 'div'), {
                classList: 'menu-container max-width',
                innerHTML: `
                    <div id="menu-icon" class="menu-icon menu-icon-show"></div>
                    <div id="menu-user" class="menu-user">
                        ${TTEvents.getUser('firstname')} ${TTEvents.getUser('lastname')}
                    </div>
                `,
            })
            document.body.append(get('menu-container2'))
            document.body.append(get('menu-container'))
            get('menu-icon').addEventListener('click', toggleMenu)
            Object.assign(get('menu-mask', 'div'), {
                classList: 'menu-mask'
            })
            document.body.append(get('menu-mask'))
            get('menu-mask').addEventListener('click', toggleMenu)
            //
            const menuItems = [
                { label:TEXT.menu_help, id:'help', icon:'help-icon.svg', roles:[1,2,3,4,5,8,9] },
                { label:TEXT.menu_line, id:'line', icon:'line-icon.svg', roles:[1,2,3,4,5,8,9], select:['LINHA 1'] },
                { label:TEXT.menu_view, id:'view', icon:'view-icon.svg', roles:[1,2,3,4,5,8,9], select:[' ','TV 1','TV 2','LINHA'] },
                { label:TEXT.menu_events_reports, id:'events', icon:'events-icon.svg', roles:[1,2,3,8,9] },
                { label:TEXT.menu_shifts, id:'shifts', icon:'shifts-icon.svg', roles:[2,3,9] },
                { label:TEXT.menu_administration, id:'administration', icon:'administration-icon.svg', roles:[2,3,5] },
                { label:TEXT.menu_dataentry, id:'data-entry', icon:'data-entry-icon.svg', roles:[2,3,4] },
                { label:TEXT.menu_welcome, id:'welcome', icon:'welcome-icon.svg', roles:[1,2,3,4,5,7,8,9] },
                { label:TEXT.menu_logout, id:'logout', icon:'logout-icon.svg', roles:[1,2,3,4,5,7,8,9] },
            ]
            for (var i=0, j=menuItems.length; i<j; i++) {
                if (!TTEvents.allowed(menuItems[i].roles)) continue
                const item = 'menu-item-'+menuItems[i].id
                Object.assign(get(item, 'div'), {
                    id: item,
                    classList: 'menu-item',
                    innerHTML: `
                        <div class="menu-item-icon" style="background-image:url('images/${menuItems[i].icon}')"></div>
                        ${menuItems[i].label}
                        ${menuItems[i].select ? draw_menu_select(menuItems[i].id, menuItems[i].select) : ''}
                    `
                })
                get('menu-panel').append(get(item))
                if (menuItems[i].select) get('menu-item-select-'+menuItems[i].id).addEventListener('change', (e)=>menuSelect(e.target.value))
                else get(item).addEventListener('click', ()=>menuSelect(item))
            }
            
            function draw_menu_select (id, options) {
                var ret = `<select id="menu-item-select-${id}">`
                for (var i=0, j=options.length; i<j; i++)
                    ret += `<option value="menu-item-${options[i]}">${options[i]}</option>`
                ret += `</select></div>`
                return ret
            }
            return true
        }
    }

    function toggleMenu () {
        if (state.isMenuOpen = !state.isMenuOpen) {
            get('menu-mask').classList.add('menu-mask-show')
            get('menu-panel').classList.remove('menu-panel-hide')
            setTimeout(()=>{
                get('menu-panel').classList.add('menu-panel-show')
            }, 10)
        } else {
            get('menu-mask').classList.remove('menu-mask-show')
            get('menu-panel').classList.remove('menu-panel-show')
            setTimeout(()=>{
                get('menu-panel').classList.add('menu-panel-hide')
            }, 300)
        }
    }

    function menuSelect (id) {
        const safe = id.replace(/[\s+=]/g,'-')
        switch (safe) {
            case 'menu-item-help': toggleMenu(); hideScreens(); showScreen_Help(); break
            case 'menu-item-LINHA-1': break;
            case 'menu-item--': break
            case 'menu-item-TV-1': toggleMenu(); hideScreens(); get('menu-container').classList.remove('max-width'); get('menu-container2').classList.remove('max-width'); showScreen_Dashboard1(); break
            case 'menu-item-TV-2': toggleMenu(); hideScreens(); get('menu-container').classList.remove('max-width'); get('menu-container2').classList.remove('max-width'); showScreen_Dashboard2(); break
            case 'menu-item-LINHA': toggleMenu(); hideScreens(); get('menu-container').classList.remove('max-width'); get('menu-container2').classList.remove('max-width'); showScreen_Line1(); break
            case 'menu-item-administration': toggleMenu(); hideScreens(); showScreen_Administration(); break
            case 'menu-item-events': toggleMenu(); hideScreens(); showScreen_Events_Reports(); break
            case 'menu-item-data-entry': toggleMenu(); hideScreens(); showScreen_DataEntry(); break
            case 'menu-item-shifts': toggleMenu(); hideScreens(); showScreen_Shifts(); break
            case 'menu-item-welcome': toggleMenu(); hideScreens(); showScreen_Welcome(); break
            case 'menu-item-logout': location.reload(); break
        }
    }

//--------------------------------------------------INPUTS--------------------------------------
    function draw_form (form_name, form_title, form_fields, flex) {
        return `
            <form id="${form_name}" name="${form_name}" onsubmit="return false">
                <fieldset>
                    <legend id="${form_name}-legend">${(form_title||'').toUpperCase()}</legend>
                    <div class="fieldset" ${flex ? `style="display: flex;"`:''}>
                        ${form_fields}
                    </div>
                </fieldset>
            </form>
        `
    }

    function markDirtyField (e) {
        if (e.target.getAttribute('dirty')) return
        e.target.setAttribute('dirty', '1')
        if (e.target.type === 'radio') {
            const group = document.getElementsByName(e.target.name)
            for (var i=0, j=group.length; i<j; i++) if (group[i] !== e.target) group[i].setAttribute('dirty', '1')
        }
        if (e.target.type === 'checkbox' || e.target.type === 'radio') return
        e.target.nextElementSibling && e.target.nextElementSibling.classList.add('undo-box-show')
    }
    
    function markDirtyFieldSimple (e) {
        e.target.setAttribute('dirty','1')
    }

    function draw_undo_box (form_name, id) {
        const ele = get(id)
        if (!ele) return
        if (ele.type === 'checkbox' || ele.type === 'radio' || ele.type === 'button' || ele.type === 'password') return
        const idu = ele.id+'-undo'
        Object.assign(get(idu, 'div'), {
            id: idu,
            classList: 'undo-box',
            innerHTML: '&circlearrowleft;',
        })
        get(idu).addEventListener('click', e=>{
            ele[ele.nodeName === 'select-one' ? 'selectedIndex' : 'value'] = ele.getAttribute('undovalue')
            ele.setAttribute('undovalue', ele.value)
            ele.setAttribute('dirty', '')
            e.target.classList.remove('undo-box-show')
        })
        get(id).parentElement.append(get(idu))
    }

    function draw_button (id, icon, value, style, inline) { // keep checkbox attached to button element for proper checkbox selector function
        return `${!inline ? '<div class="button-right-align">' : ''}
            <div id="${id}" class="button" style="${style||''}"><span class="button-image"><img id="${id}-image" src="images/${icon}"/></span>${value || ''}<div class="button-checkmark-container"><div id="${id}-checkmark" class="button-checkmark">&#10003;</div></div></div>
            ${!inline ? '</div>' : ''}
        `
    }

    function draw_confirmation_button (id, label, text, button, style, right) {
        return `
            <div id="${id}-confirmation-container" class="button-confirmation-container" ${right ? `style="margin-top: -32px;"` : ''}>
                <div id="${id}-confirmation" class="button-confirmation" style="${style||''}">
                    <label id="${id}-confirmation-label" for="${id}-confirmation-checkbox" class="button-confirmation-label">${label||''}</label>
                    <input id="${id}-confirmation-checkbox" type="checkbox"/ class="button-confirmation-checkbox">
                    <div class="button-confirmation-text"><div style="width: max-content; height: max-content;">${text||'Are you sure?'}</div>
                        <div id="${id}" class="button-confirmation-OK">${button||'OK'}</div>
                    </div>
                </div>
            </div>
        `
    }

    function draw_textarea (id, label, attributes, enabled) { //leave closing div next to input for nextSibling undo button linking
        const mod = (attributes && attributes.indexOf('width:') > -1) ? `style="flex-basis: unset; flex: none;"`: ''
        return `
            <div id="field-highlight-${id}" class="inline-block margin-2 input-container input-highlight auto-height" ${mod}>
                <label for="${id}">${label || '&nbsp;'}</label>
                <textarea id="${id}" ${enabled === false ? `disabled="true"` : ''} ${attributes || ''}></textarea></div>
        `
    }
    function draw_input (id, label, attributes, enabled) { //leave closing div next to input for nextSibling undo button linking
        const mod = (attributes && attributes.indexOf('width:') > -1) ? `style="flex-basis: unset; flex: none;"`: ''
        return `
            <div id="field-highlight-${id}" class="inline-block margin-2 input-container input-highlight" ${mod}>
                <label for="${id}">${label || '&nbsp;'}</label>
                <input ${id.endsWith('password') ? 'type="password"' : ''} id="${id}" ${enabled === false ? `disabled="true"` : ''} value="" ${attributes || ''}/></div>
        `
    }
    function enable_input (ele, enabled) {
        ele.disabled = !enabled
        ele.style.opacity = enabled ? 1 : 0.7
        ;(ele.previousElementSibling || ele).style.opacity = enabled ? 1 : 0.5
    }

    function draw_checkbox (id, label, checked, attributes, above, enabled) {
        const mod = (attributes && attributes.indexOf('width:') > -1) ? `flex-basis: unset; flex: none; height: auto;`: '',
            lab = `<label for="${id}" class="--inline-block input-label-large" ${attributes || ''}>${label || ''}</label>`
        return `
            <div id="field-highlight-${id}" class="inline-block margin-2 input-container input-highlight centered" style="${mod}; height: ${above ? '64px' : '42px'};">
                ${above ? lab /*+ `<br/>`*/ : ''}
                <input id="${id}" ${enabled === false ? `disabled="true"` : ''} type="checkbox" ${checked ? 'checked' : ''}
                />${!above ? lab : ''}
            </div>
        `
    }

    function draw_radio (id, label, selected, group, attributes, above, enabled) {
        const mod = (attributes && attributes.indexOf('width:') > -1) ? `style="flex-basis: unset; flex: none;"`: ''
        return `
            <div id="field-highlight-${id}" class="inline-block input-container radio-container-mod" ${mod}>
                <input id="${id}" ${enabled === false ? `disabled="true"` : ''} type="radio" name="${group}" ${selected ? 'checked' : ''}
                /><label for="${id}" class="inline-block input-label-large" ${attributes || ''}>${label || ''}</label>
            </div>
        `
    }

    function draw_select (id, label, options, attributes, enabled) {
        //leave closing div next to input for nextSibling undo button linking
        const mod = (attributes && attributes.indexOf('width:') > -1) ? `style="flex-basis: unset; flex: none;"`: ''
        return `
            <div id="field-highlight-${id}" class="inline-block margin-2 input-container input-highlight" ${mod}>
                <label for="${id}">${label || ''}</label>
                <select id="${id}" ${enabled === false ? `disabled="true"` : ''} ${attributes || ''}>${options || ''}</select></div>
        `
    }

    function draw_select_options (opt, index) {
        var html = ''
        for (var i=0, j=opt.length; i<j; i++) {
            html += Array.isArray(opt[i])
                ? `<option value="${opt[i][0]}" ${i === index ? 'selected' : ''}>${opt[i][1]}</option>`
                : `<option ${i === index ? 'selected' : ''}>${opt[i]}</option>`
            }
        return html
    }

    function draw_select_table (id, heading, width, height, colspan) {
        var widths = '',
            headings = ''
        if (Array.isArray(heading)) for (var i in heading) {
            headings += `<th colspan="${colspan || 1}"><div>${heading[i]}</div></th>`
            widths += `<td style="${Array.isArray(width) ? `width:${width[i]};` : ``}">${Array.isArray(heading) ? heading[i] : ''}</td>`
        }
        else headings = `<th colspan="${heading.length}"><div>${heading}</div></th>`
        var html = `
            <div class="input-highlight table-700 margin-2">
                <table id="${id}" class="field-select-table">
                    <tbody style="${height ? `height: ${height}` : ''}">
                        <tr>${headings}</tr>
                        <tr style="visibility: hidden; margin-bottom: -100%;">${widths}</tr>
                    </tbody>
                </table>
            </div>
        `
        return html
    }

    function draw_select_table_option (id, option, select_handler) {
        if (!get(id)) return
        const eleid = id+'-'+option[0]
        var html = ''
        for (var i=1; i<option.length; i++) html += `<td>${option[i]}</td>`
        Object.assign(get(eleid, 'tr'), {
            id: eleid,
            innerHTML: html,
        })
        get(id).children[0].appendChild(get(eleid))
        get(eleid).setAttribute('_id', option[0])
        for (var i=0, j=get(eleid).children.length; i<j; i++) {
            const cell = get(eleid).children[i]
            if (cell.children[0] && cell.children[0].classList.contains('contenteditable')) cell.setAttribute('contenteditable', 'true')
        }
        select_handler && get(eleid).addEventListener('click', select_handler)
    }

    function draw_output (id, label, attributes, value) {
        const mod = (attributes && attributes.indexOf('width:') > -1) ? `style="flex-basis: unset; flex: none;"`: ''
        return `
            <div id="field-highlight-${id}" class="inline-block margin-2 input-container input-highlight" ${mod}>
                <label for="${id}">${label || '&nbsp;'}</label>
                <div class="input-output" id="${id}" ${attributes||''}>${value||''}</div>
            </div>
        `
    }

    function draw_break () {
        return `<div class="breaker"></div>`
    }

    function draw_spacer () {
        return `<div class="spacer"></div>`
    }

    function select_table_handler (e) {
        var which,
            target = e.target
        while (target.tagName !== 'TR') target = target.parentElement
        const rows = target.parentElement.children //change 'children' to 'rows'?
        for (var i=1; i < rows.length; i++) {
            const one = rows[i]
            if (one === target) { which = i; one.classList.add('field-select-table-row-on') }
            else one.classList.remove('field-select-table-row-on')
        }
        return which
    }

    function showErrorBox (messages, custom_color, custom_text) {
        if (messages === undefined) return
        if (!Array.isArray(messages)) messages = [messages]
        const limit = 20,
            timeout = 6000
        const name = 'display-error'
        var ele = get(name)
        if (!ele) {
            (ele = get(name, 'div')).classList = name
            document.body.append(ele)
        }
        if (ele.children.length > limit+messages.length)
            for (var j=0; j<(ele.children.length-limit-messages.length); j++)
                ele.removeChild(ele.children[0])
        for (var i=0; i<messages.length; i++) {
            if (typeof messages[i] === 'string' && messages[i].indexOf('://') >= 0) continue
            var ele2 = get(undefined, 'div')
            ele2.innerHTML = messages[i] instanceof Object ? JSON.stringify(messages[i]) : messages[i] === 'permissions' ? TEXT.phrase_permission_denied : messages[i] 
            ele.appendChild(ele2)
        }
        ele.style.backgroundColor = custom_color || 'rgba(255,0,0,0.8)'
        ele.style.color = custom_text || 'white'
        ele.classList.add('display-error-show')
        //
        if (showErrorBox.timeout) clearTimeout(showErrorBox.timeout)
        showErrorBox.timeout = setTimeout(hideErrorBox, timeout)
    }

    function hideErrorBox () {
        const name = 'display-error',
            ele = get(name)
        if (!ele) return
        ele.classList.remove('display-error-show')
        document.body.removeChild(unget(ele))
    }

//---------------------------------------------------SCREENS--------------------------------------------
    function showScreen_Dashboard1 () {
        const name = 'screen1'
        state.currentScreen = name
        get('dashboard-paused').style.display = 'block'
        if (get(name)) {
            get(name).classList.remove('screen-hide')
            get(name).classList.add('screen-show')
        }
        else {
            Object.assign(get(name, 'div'), {
                classList: 'dashboard format-16x9-container',
                innerHTML: `
                    <div id="dashboard-format" class="format-16x9">
                        <div class="screen-inlay-left"></div>
                        <div id="dashboard-shift-container" class="dashboard-shift">${TEXT.title_shift} <span id="dashboard-shift">-</span></div>
                        <div class="dashboard-datetime">
                            <div id="dashboard-currentdate"></div>
                            <div id="dashboard-currenttime"></div>
                        </div>
                        <div id="stations"></div>
                        <div class="andon-container">
                            <div id="andon-message-text" class="andon-message">---</div>
                        </div>
                    </div>
                `
            })
            document.body.append(get(name))
            setTimeout(()=>{ get(name).classList.add('screen-show') }, 30)
            //TTEvents.scrollAndonMessage()
            //window.addEventListener('resize', TTEvents.scrollAndonMessage)
            if (idleTimeout !== undefined) get(name).addEventListener('scroll', setIdleTimeout)
            Transport.send(secure ? urlSecure : urlInsecure, { dashboard: true })
        }
        adjustFontSize()
        //get('menu-container2') && get('menu-icon').classList.add('menu-icon-inset')
        get('menu-item-select-view') && (get('menu-item-select-view').selectedIndex = 1)
    }

//--------------------------------------------------------------------------------------------------------
    function showScreen_Dashboard2 () {
        const name = 'screen2'
        state.currentScreen = name
        get('dashboard-paused').style.display = 'block'
        if (get(name)) {
            get(name).classList.remove('screen-hide')
            get(name).classList.add('screen-show')
        }
        else {
            Object.assign(get(name, 'div'), {
                classList: 'dashboard format-16x9-container',
                innerHTML: `
                    <div id="dashboard2-format" class="format-16x9">
                        <div class="screen-inlay-center"></div>
                        <div id="dashboard2-shift" class="dashboard2-shift"></div>
                        <table class="analytics-calc">
                            <tr>
                                <td width="40%">OEE</td>
                                <td width="40%">${draw_analytics_graph('oee')}</td>
                                <td id="analytics-oee" width="20%" align="right">-%</td>
                            </tr>
                            <tr>
                                <td>Disponibilidade</td>
                                <td>${draw_analytics_graph('availability')}</td>
                                <td id="analytics-availability" align="right">-%</td>
                            </tr>
                            <tr>
                                <td>Produtividade</td>
                                <td>${draw_analytics_graph('performance')}</td>
                                <td id="analytics-performance" align="right">-%</td>
                            </tr>
                            <tr>
                                <td>Qualidade</td>
                                <td>${draw_analytics_graph('quality')}</td>
                                <td id="analytics-quality" align="right">-%</td>
                            </tr>
                        </table>
        
                        <div class="analytics-runbreak">
                            tempo<br/>produção
                            <span class="analytics-time" id="analytics-runtime">0:00:00</span>
                            paradas
                            <span class="analytics-time" id="analytics-redtime">0:00:00</span>
                        </div>
        
                        <div class="analytics-taktremain">
                            ${TEXT.label_cycle_time} <span id="analytics-taktremain">0:00:00</span>
                        </div>

                        <div class="analytics-datetime">
                            <div id="analytics-currentdate"></div>
                            <div id="analytics-currenttime"></div>
                        </div>

                        <table class="production">
                            <tr>
                                <td></td>
                                <td colspan="2">TURNO&nbsp;&nbsp;DIA</td>
                            </tr>
                            <tr>
                                <td>PLAN.</td>
                                <td id="production-plan-shift" class="td-border">0</td>
                                <td id="production-plan-day" class="td-border">0</td>
                            </tr>
                            <tr>
                                <td>PROD.</td>
                                <td id="production-prod-shift" class="td-border">0</td>
                                <td id="production-prod-day" class="td-border">0</td>
                            </tr>
                            <tr>
                                <td>REP.</td>
                                <td id="production-reject-shift" class="td-border">0</td>
                                <td id="production-reject-day" class="td-border">0</td>
                            </tr>
                        </table>
                    
                        ${draw_progress_graph('cadence-graph', 'CADENCIA DA LINHA')}
        
                        <div id="analytics-distribution-graph">
                            <svg>
                                <circle r="30%" cx="50%" cy="50%" fill="transparent" style="stroke-width:56%; stroke:red;" id="distribution-graph-red" />
                                <circle r="30%" cx="50%" cy="50%" fill="transparent" style="stroke-width:56%; stroke:yellow;" id="distribution-graph-yellow" />
                                <circle r="30%" cx="50%" cy="50%" fill="transparent" style="stroke-width:56%; stroke:blue;" id="distribution-graph-blue" />
                                <circle r="30%" cx="50%" cy="50%" fill="transparent" style="stroke-width:56%; stroke:green;" id="distribution-graph-green" />
                            </svg>
                        </div>
                        <div class="analytics-status-times">${TEXT.title_status_times.toUpperCase()}</div>

                        <table class="analytics-distribution"><tr>
                            <td><div class="button-icon radial-gradient-3"></div></div>&nbsp;<span id="analytics-distribution-green-pc"></span>% ${TEXT.label_nominal}</td>
                            <td><div class="button-icon radial-gradient-0"></div></div>&nbsp;<span id="analytics-distribution-yellow-pc"></span>% ${TEXT.label_maintenance}</td>
                            <td><div class="button-icon radial-gradient-1"></div></div>&nbsp;<span id="analytics-distribution-blue-pc"></span>% ${TEXT.label_logistic}</td>
                            <td><div class="button-icon radial-gradient-2"></div></div>&nbsp;<span id="analytics-distribution-red-pc"></span>% ${TEXT.label_stoppage}</td>
                        </tr></table>
                    </div>
                `
            })
            document.body.append(get(name))
            setTimeout(()=>{ get(name).classList.add('screen-show') }, 30)
            if (idleTimeout !== undefined) get(name).addEventListener('scroll', setIdleTimeout)
            Transport.send(secure ? urlSecure : urlInsecure, { dashboard2: true })
        }
        adjustFontSize()
        //window.addEventListener('resize', resize_distribution_graph)
        get('menu-item-select-view') && (get('menu-item-select-view').selectedIndex = 2)

        /*
        function resize_distribution_graph (e) {
            const colors = ['red', 'yellow', 'blue', 'green']
            for (var j in colors) get('distribution-graph-' + colors[j]).style.strokeDasharray = '0 0'
        }
        */

        function draw_progress_graph (name, label) {
            return `
                <div id="${name}" class="progress-graph">
                    ${label}
                    <table>
                        <tr>
                            <td id="${name}-done" class="progress-graph-number">0</td>
                            <td class="progress-graph-gradient align-right">
                                <span id="${name}-bar" class="progress-graph-bar"></span>
                                <span id="${name}-indicator" class="progress-graph-indicator"></span>
                                <span id="${name}-arrow" class="progress-graph-arrow"><img src="images/arrow-icon.svg" width="100%"/></span>
                            </td>
                            <td id="${name}-left" class="progress-graph-number">0</td>
                        </tr>
                        <tr>
                            <td></td>
                            <td class="progress-graph-contain">${'&nbsp;'.repeat(40)}</td>
                            <td></td>
                        </tr>
                    </table>
                </div>
            `
        }
    
        function draw_analytics_graph (item) {
            return `
                <div class="analytics-graph-gradient">
                    <div class="analytics-graph" id="analytics-graph-${item}"></div>
                </div>
            `
        }    
    }

//--------------------------------------------------------------------------------------------------------------
    function showScreen_Help () {
        const name = 'screen4'
        state.currentScreen = name
        if (get(name)) {
            get(name).classList.remove('screen-hide')
            get(name).classList.add('screen-show')
        } else {
            Object.assign(get(name, 'div'), {
                classList: 'screen max-width',
                innerHTML: `
                    <div class="screen-inlay-top"><img src="images/perkins-logo-large-blue.png"/></div>
                    <h2>${TEXT.menu_help}</h2>
                `
            })
            document.body.append(get(name))
            setTimeout(()=>{ get(name).classList.add('screen-show') }, 30)
            if (idleTimeout !== undefined) get(name).addEventListener('scroll', setIdleTimeout)
        }
    }

//--------------------------------------------------------------------------------------------------------------
function showScreen_Line1 () {
    const name = 'screen10'
    state.currentScreen = name
    get('dashboard-paused').style.display = 'block'
    if (get(name)) {
        get(name).classList.remove('screen-hide')
        get(name).classList.add('screen-show')
    } else {
        Object.assign(get(name, 'div'), {
            classList: 'screen line-background white-title',
            innerHTML: `
                <div class="screen-inlay-top"><img src="images/perkins-logo-large-white.png"/></div>
                <h2 style="color: white;">${TEXT.menu_line} 1</h2>
                <div id="layout-shift-container" class="layout-shift">${TEXT.title_shift} <span id="layout-shift">-</span></div>
                <div id="stations-layout"></div>
            `
        })
        document.body.append(get(name))
        setTimeout(()=>{ get(name).classList.add('screen-show') }, 30)
        if (idleTimeout !== undefined) get(name).addEventListener('scroll', setIdleTimeout)
        Transport.send(secure ? urlSecure : urlInsecure, { dashboard: true })
    }
    adjustFontSize()
}

//-----------------------------------------------------------------------------------------------
    function showScreen_Administration () {
        const name = 'screen5'
        state.currentScreen = name
        if (get(name)) {
            get(name).classList.remove('screen-hide')
            get(name).classList.add('screen-show')
        } else {
            const form_message = 'form_message',
                form_submit_message = form_message+'-submit',
                form_roles = 'form_roles',
                form_submit_roles = form_roles+'-submit',
                form_user_role = 'form_user_role',
                //form_submit_user_role = form_user_role+'-submit',
                form_agc = 'form_agc',
                form_submit_agc = form_agc+'-submit',
                form_line = 'line_entry',
                form_submit_line = form_line+'-submit',
                form_database = 'form_database',
                form_submit_database = form_database+'-submit',
                form_database_test = 'form_database_test',
                form_submit_database_test = form_database_test+'-submit',
                form_production = 'form_production',
                form_submit_production = form_production+'-submit',
                form_mail = 'form_mail',
                form_submit_mail = form_mail+'-submit'

            document.body.append(Object.assign(get(name, 'div'), {
                classList: 'screen max-width',
                innerHTML: `
                    <div class="screen-inlay-top"><img src="images/perkins-logo-large-blue.png"/></div>
                    <h2>${TEXT.menu_administration}</h2>
                    
                    ${permission(form_message) ? draw_form(form_message, TEXT.title_andon_message, `
                        ${draw_input(form_message+'-text', TEXT.field_message)}
                        ${draw_button(form_submit_message, 'save-icon.svg', TEXT.button_save, undefined, true)}
                    `, true) : ''}

                    ${permission(form_roles) ? draw_form(form_roles, TEXT.title_user_roles, `
                        <div id="${form_roles}-container" class="height-expand"></div>
                        <div class="breaker"></div>
                        ${draw_button(form_submit_roles, 'list-icon.svg', TEXT.button_list)}
                    `, true) : ''}
                    
                    ${permission(form_line) ? draw_form(form_line, TEXT.title_line, `
                        ${draw_input(form_line+'-name', TEXT.field_name.toUpperCase())}
                        ${draw_input(form_line+'-description', TEXT.field_description.toUpperCase())}
                        ${draw_button(form_submit_line, 'save-icon.svg', TEXT.button_save, undefined, true)}
                    `, true) : ''}
                    
                    ${permission(form_database) ? draw_form(form_database, TEXT.title_database, `
                        <div class="button-icon-cont"><div id="${form_submit_database_test}" class="radial-gradient-gray button-icon button-test-white"></div></div>
                        ${draw_input(form_database+'-address', TEXT.field_server_address)}
                        ${draw_input(form_database+'-port', TEXT.field_port)}
                        ${draw_input(form_database+'-database', TEXT.field_database)}
                        ${draw_input(form_database+'-dusername', TEXT.field_username)}
                        ${draw_input(form_database+'-dpassword', TEXT.field_password)}
                        ${draw_button(form_submit_database, 'save-icon.svg', TEXT.button_save, undefined, true)}
                    `, true) : ''}
                    
                    ${permission(form_production) ? draw_form(form_production, TEXT.title_production, `
                        ${draw_input(form_production+'-address', TEXT.field_server_address)}
                        ${draw_input(form_production+'-pusername', TEXT.field_username)}
                        ${draw_input(form_production+'-ppassword', TEXT.field_password)}
                        ${draw_button(form_submit_production, 'save-icon.svg', TEXT.button_save, undefined, true)}
                    `, true) : ''}
                    
                    ${permission(form_mail) ? draw_form(form_mail, TEXT.title_mail_server, `
                        ${draw_input(form_mail+'-email', TEXT.field_ops_email)}
                        ${draw_input(form_mail+'-address', TEXT.field_server_address)}
                        ${draw_input(form_mail+'-port', TEXT.field_port)}
                        ${draw_input(form_mail+'-musername', TEXT.field_username)}
                        ${draw_input(form_mail+'-mpassword', TEXT.field_password)}
                        ${draw_button(form_submit_mail, 'save-icon.svg', TEXT.button_save, undefined, true)}
                    `, true) : ''}

                    ${permission(form_agc) ? draw_form(form_agc, TEXT.title_agc, `
                        <div class="agc-container">
                            <div id="${form_agc}-area-panel" class="agc-editor-panel"><div class="agc-editor-title">${TEXT.title_agc_area}</div><div class="agc-editor-label"></div><div id="${form_agc}-area" class="agc-editor-content"></div></div>
                            <div id="${form_agc}-group-panel" class="agc-editor-panel"><div class="agc-editor-title">${TEXT.title_agc_group}</div><div id="${form_agc}-group-label" class="agc-editor-label"></div><div id="${form_agc}-group" class="agc-editor-content"></div></div>
                            <div id="${form_agc}-purpose-panel" class="agc-editor-panel"><div class="agc-editor-title">${TEXT.title_agc_cause}</div><div id="${form_agc}-purpose-label" class="agc-editor-label"></div><div id="${form_agc}-purpose" class="agc-editor-content"></div></div>
                        </div>
                        ${draw_break()}
                        <div class="button-left-align">
                            ${draw_button(form_agc+'-reset', 'reset-icon.svg', TEXT.button_reset, undefined, true)}
                            ${draw_button(form_submit_agc, 'save-icon.svg', TEXT.button_save, 'float:right', true)}
                        </div>
                    `, true) : ''}
                    
                `,
            }))
            
            if (permission(form_agc)) {

                function deselectA (e) {
                    if (state.AGC_editing || e.target !== e.currentTarget) return
                    const old_index = +get(form_agc+'-area').getAttribute('index')
                    if (old_index) {
                        state.caches.AGC_area[old_index].classList.remove('editable-list-item-on')
                        state.caches.AGC_area[old_index].children[1].contentEditable = false
                        get(form_agc+'-area').setAttribute('index', '')
                    }
                    get(form_agc+'-group-label').innerText = get(form_agc+'-group').innerText = ''
                    get(form_agc+'-purpose-label').innerText = get(form_agc+'-purpose').innerText = ''
                }

                function deselectG (e) {
                    if (state.AGC_editing || e.target !== e.currentTarget) return
                    const old_index = +get(form_agc+'-group').getAttribute('index')
                    if (old_index) {
                        state.caches.AGC_group[old_index].classList.remove('editable-list-item-on')
                        state.caches.AGC_group[old_index].children[1].contentEditable = false
                        get(form_agc+'-group').setAttribute('index', '')
                    }
                    get(form_agc+'-purpose-label').innerText = get(form_agc+'-purpose').innerText = ''
                }

                function deselectC (e) {
                    if (state.AGC_editing || e.target !== e.currentTarget) return
                    const old_index = get(form_agc+'-purpose').getAttribute('index')
                    if (old_index) {
                        state.caches.AGC_purpose[old_index].classList.remove('editable-list-item-on')
                        state.caches.AGC_purpose[old_index].children[1].contentEditable = false
                        get(form_agc+'-purpose').setAttribute('index', '')
                    }
                }

                function changeA (e) {
                    const old_index = +get(form_agc+'-area').getAttribute('index'),
                        new_ele = e.target.parentElement === get(form_agc+'-area') ? e.target : e.target.parentElement,
                        new_index = +new_ele.getAttribute('index')
                    if (state.AGC_editing || old_index === new_index) return
                    if (old_index && state.caches.AGC_area[old_index]) {
                        state.caches.AGC_area[old_index].classList.remove('editable-list-item-on')
                        state.caches.AGC_area[old_index].children[1].contentEditable = false
                    }
                    get(form_agc+'-area').setAttribute('index', new_index)
                    new_ele.classList.add('editable-list-item-on')
                    get(form_agc+'-group-label').innerText = get(form_agc+'-group').innerText = ''
                    get(form_agc+'-group').setAttribute('index', '')
                    get(form_agc+'-purpose-label').innerText = get(form_agc+'-purpose').innerText = ''
                    get(form_agc+'-purpose').setAttribute('index', '')
                    if (new_ele.children[1].innerText) {
                        if (!(state.caches.AGC[new_index] instanceof Object)) state.caches.AGC[new_index] = { 0: state.caches.AGC[new_index] }
                        state.caches.AGC_group = editable_list(state.caches.AGC[new_index], get(form_agc+'-group-label'), get(form_agc+'-group'))
                    }
                }
                
                function preserveA (force_index) {
                    const new_index = force_index || get(form_agc+'-area').getAttribute('index'),
                        new_ele = get(form_agc+'-area').children[new_index - 1]
                    if (new_ele) new_ele.classList.add('editable-list-item-on')
                    get(form_agc+'-group-label').innerText = get(form_agc+'-group').innerText = ''
                    get(form_agc+'-purpose-label').innerText = get(form_agc+'-purpose').innerText = ''
                    if (new_ele) state.caches.AGC_group = editable_list(state.caches.AGC[new_index], get(form_agc+'-group-label'), get(form_agc+'-group'), 2)
                }

                function changeG (e) {
                    const area_index = +get(form_agc+'-area').getAttribute('index'),
                        old_index = get(form_agc+'-group').getAttribute('index'),
                        new_ele = e.target.parentElement === get(form_agc+'-group') ? e.target : e.target.parentElement,
                        new_index = +new_ele.getAttribute('index')
                    if (state.AGC_editing || old_index === new_index) return
                    if (old_index && state.caches.AGC_group[old_index]) {
                        state.caches.AGC_group[old_index].classList.remove('editable-list-item-on')
                        state.caches.AGC_group[old_index].children[1].contentEditable = false
                    }
                    get(form_agc+'-group').setAttribute('index', new_index)
                    new_ele.classList.add('editable-list-item-on')
                    get(form_agc+'-purpose-label').innerText = get(form_agc+'-purpose').innerText = ''
                    get(form_agc+'-purpose').setAttribute('index', '')
                    if (new_ele.children[1].innerText) {
                        if (!(state.caches.AGC[area_index][new_index] instanceof Object)) state.caches.AGC[area_index][new_index] = { 0: state.caches.AGC[area_index][new_index] }
                        state.caches.AGC_purpose = editable_list(state.caches.AGC[area_index][new_index], get(form_agc+'-purpose-label'), get(form_agc+'-purpose'))
                    }
                }
    
                function preserveG () {
                    const area_index = +get(form_agc+'-area').getAttribute('index'),
                        new_index = +get(form_agc+'-group').getAttribute('index'),
                        new_ele = !isNaN(new_index) ? get(form_agc+'-group').children[new_index - 1] : undefined
                    if (new_ele) new_ele.classList.add('editable-list-item-on')
                    get(form_agc+'-purpose-label').innerText = get(form_agc+'-purpose').innerText = ''
                    if (new_ele) state.caches.AGC_purpose = editable_list(state.caches.AGC[area_index][new_index], get(form_agc+'-purpose-label'), get(form_agc+'-purpose'), 3)
                }

                function changeC (e) {
                    const old_index = +get(form_agc+'-purpose').getAttribute('index'),
                        new_ele = e.target.parentElement === get(form_agc+'-purpose') ? e.target : e.target.parentElement,
                        new_index = +new_ele.getAttribute('index')
                    if (state.AGC_editing || old_index === new_index) return
                    if (old_index && state.caches.AGC_purpose[old_index]) {
                        state.caches.AGC_purpose[old_index].classList.remove('editable-list-item-on')
                        state.caches.AGC_purpose[old_index].children[1].contentEditable = false
                    }
                    get(form_agc+'-purpose').setAttribute('index', new_index)
                    new_ele.classList.add('editable-list-item-on')
                }
    
                function preserveC () {
                    const new_index = +get(form_agc+'-purpose').getAttribute('index'),
                        new_ele = !isNaN(new_index) ? +get(form_agc+'-purpose').children[new_index - 1] : undefined
                    if (new_ele) new_ele.classList.add('editable-list-item-on')
                }

                function getAGC () {
                    state.caches.AGC_changes = []
                    Transport.send(urlSecure, { form: { name: form_agc } })
                }
                
                function editorAGC (form) {
                    state.caches.AGC = form.fields
                    if (!get(form_agc)) return
                    state.caches.AGC_area = editable_list(form.fields, undefined, get(form_agc+'-area'), 1)
                }
            
                function saveAGC () {
                    if (!state.caches.AGC_changes.length) return
                    Transport.send(urlSecure, { form: { name: form_agc, submit: form_submit_agc, fields: { changes: state.caches.AGC_changes } } })
                }
                
                function editable_list (menu, ele, ele2, preserve) {
                    if (!(menu instanceof Object) || !ele2) return
                    const list = {},
                        eles = {}
                    if (ele) ele.innerText = ''
                    ele2.innerText = ''
                    const keys = Object.keys(menu)
                    for (var i in keys) {
                        const item = menu[keys[i]]
                        list[keys[i]] = item instanceof Object ? item[0] : item
                    }
                    const sorted = Object.keys(list).sort(tag_sort)
                    if (!+sorted[0]) {
                        if (ele) ele.innerText = menu[sorted[0]].replace(/^_*/, '')
                        sorted.shift()
                    }
                    sorted.push(++state.AGC_id)
                    for (var i in sorted) {
                        if (isNaN(+sorted[i])) continue
                        eles[sorted[i]] = addEditableItem(ele2, sorted[i], list[sorted[i]])
                    }
                    if (preserve) preserve === 1 ? preserveA() : preserve === 2 ? preserveG() : preserveC()
                    else ele2.setAttribute('index', '')
                    return eles
                }

                function getSelections () {
                    const selections = []
                    const area = get(form_agc+'-area').getAttribute('index')
                    if (area) {
                        selections[0] = area
                         if (get(form_agc+'-area').getAttribute('undo')) return selections
                    }
                    const group = get(form_agc+'-group').getAttribute('index')
                    if (group) {
                        selections[1] = group
                        if (get(form_agc+'-group').getAttribute('undo')) return selections
                    }
                    const purpose = get(form_agc+'-purpose').getAttribute('index')
                    if (purpose) selections[2] = purpose
                    return selections
                }

                function startEditing (e) {
                    if (state.AGC_editing) return
                    if (e.target === e.currentTarget.children[2]) return
                    const panel_id = e.currentTarget.parentElement.id
                    if (panel_id.endsWith('-area')) changeA(e)
                    else if (panel_id.endsWith('-group')) changeG(e)
                    else if (panel_id.endsWith('-purpose')) changeC(e)
                    state.AGC_editing = e.currentTarget
                    const editable = e.currentTarget.children[1]
                    editable.contentEditable = true
                    editable.classList.add('editing-border')
                    editable.addEventListener('input', duringEditing)
                    window.getSelection().selectAllChildren(editable)
                    e.currentTarget.parentElement.setAttribute('undo', editable.innerText)
                    window.addEventListener('keydown', escapeEditing)
                }

                function escapeEditing (e) {
                    if (e.keyCode !== 27) return
                    e.preventDefault()
                    finishEditing.call(state.AGC_editing.children[1], true)
                }

                function duringEditing (e) {
                    if (e.inputType === 'insertFromPaste') e.target.innerText = e.target.innerText.replace(/\n/g, ' ')
                    else if (e.inputType === 'insertParagraph' || (e.inputType === 'insertText' && e.data === null)) {
                        e.target.innerText = e.target.innerText.replace(/\n/g, '')
                        finishEditing.call(this)
                    }
                }

                function finishEditing (esc, disable) {
                    if (!state.AGC_editing) return
                    state.AGC_editing = undefined
                    if (disable === undefined) window.removeEventListener('keydown', escapeEditing)
                    const names = ['area', 'group', 'purpose'],
                        selections = getSelections(),
                        index = selections[selections.length - 1],
                        which = (index !== undefined) && (selections.length - 1)
                    if (isNaN(which)) return
                    const panel = get(form_agc+'-'+names[which]),
                        undo = panel.getAttribute('undo'),
                        text = (disable ? '_' : '') + this.innerText.replace(/^_*/, '').trim()
                    if (disable === undefined) {
                        this.contentEditable = false
                        this.classList.remove('editing-border')
                        if (text) this.nextElementSibling.classList.remove('hidden')
                    }
                    if (text === undo || !text || esc) this.innerText = undo
                    else {
                        push_replace_firstElement_indexOf(state.caches.AGC_changes, [selections.join('|'), text])
                        const [a_index, g_index, c_index] = selections
                        if (disable === undefined && !undo) {
                            const ele = addEditableItem(panel, ++state.AGC_id)
                            state.caches['AGC_'+names[which]][ele.getAttribute('index')] = ele
                        }
                        if (which === 0) {
                            if (state.caches.AGC[a_index] instanceof Object) state.caches.AGC[a_index][0] = text
                            else state.caches.AGC[a_index] = { 0: text }
                            state.caches.AGC_group = editable_list(state.caches.AGC[a_index], get(form_agc+'-group-label'), get(form_agc+'-group'))
                        }
                        else if (which === 1) {
                            if (state.caches.AGC[a_index][g_index] instanceof Object) state.caches.AGC[a_index][g_index][0] = text
                            else state.caches.AGC[a_index][g_index] = { 0: text }
                            state.caches.AGC_purpose = editable_list(state.caches.AGC[a_index][g_index], get(form_agc+'-purpose-label'), get(form_agc+'-purpose'))
                        }
                        else state.caches.AGC[a_index][g_index][c_index] = text
                    }
                    if (disable === undefined) panel.setAttribute('undo', '')
                }

                function push_replace_firstElement_indexOf(arr, element) {
                    const index = arr.indexOf(element),
                        ins = index >= 0 ? index : arr.length
                    arr[ins] = element
                    return ins
                }

                function addEditableItem (ele2, id, desc) {
                    const empty = +id > 1e10,
                        div = Object.assign(get('', 'div'), {
                        classList: 'editable-list-item',
                        innerHTML: `
                            <div class="editable-list-item-name">${empty ? TEXT.label_new : id}</div>
                            <div class="editable-list-item-description">${desc ? (desc.startsWith('_') ? desc.substring(1) : desc)||'':''}</div>
                            <div class="eye ${empty ? 'hidden' : ''}"></div>
                        `,
                    })
                    div.setAttribute('index', id)
                    ele2.append(div)
                    if (permission('form_agc')) div.addEventListener('dblclick', startEditing)
                    const eye = div.children[2]
                    if (eye) {
                        if (typeof desc === 'string' && desc.startsWith('_')) {
                            div.setAttribute('eye-off', '1')
                            eye.classList.add('eye-off')
                        }
                        eye.addEventListener('dblclick', toggleEye)
                    }
                    return div
                }

                function toggleEye (e) {
                    state.AGC_editing = true
                    const parent = e.currentTarget.parentElement
                    if (parent.getAttribute('eye-off')) {
                        parent.setAttribute('eye-off', '')
                        e.currentTarget.classList.remove('eye-off')
                        finishEditing.call(e.currentTarget.parentElement.children[1], false, false)
                    }
                    else {
                        parent.setAttribute('eye-off', '1')
                        e.currentTarget.classList.add('eye-off')
                        finishEditing.call(e.currentTarget.parentElement.children[1], false, true)
                    }
                }
                
                state.AGC_id = Date.now()
                updateAGC.editor = editorAGC
                if (!state.caches.AGC) setTimeout(getAGC, 1000)
                get(form_agc+'-reset').addEventListener('click', getAGC)
                get(form_submit_agc).addEventListener('click', saveAGC)
                get(form_agc+'-area').addEventListener('click', changeA)
                get(form_agc+'-group').addEventListener('click', changeG)
                get(form_agc+'-purpose').addEventListener('click', changeC)
                get(form_agc+'-area-panel').addEventListener('click', deselectA)
                get(form_agc+'-group-panel').addEventListener('click', deselectG)
                get(form_agc+'-purpose-panel').addEventListener('click', deselectC)
                get(form_agc+'-area').innerText = ''
                get(form_agc+'-group').innerText = ''
                get(form_agc+'-purpose').innerText = ''
            }

            setTimeout(()=>{ get(name).classList.add('screen-show') }, 30)

            const message_administration_array = []

            // FORM_MESSAGE ------------------------------------------------------------------------------------
            if (permission(form_message)) {
                /*forms[form_message] = {
                    text: get(form_message+'-text')
                }
                const fields_list = {
                        "form_message-text": form_message,
                    }
                for (var field_name in fields_list) {
                    if (!get(field_name)) continue
                    get(field_name).addEventListener('keyup', markDirtyField)
                    draw_undo_box(form_message, field_name)
                }
                get(form_submit_message).addEventListener('click', ()=>{
                    Transport.send(urlSecure, TTEvents.form(form_message, form_submit_message))
                })
                TTEvents.formCallback(form_message, form=>{
                    //TODO: update html message
                    setAttribute('undovalue', ...)
                })
                */
                get(form_submit_message).addEventListener('click', ()=>{
                    if (get('form_message-text').getAttribute('undo') === get('form_message-text').value || !get('form_message-text').value.trim()) return
                    Transport.send(urlSecure, { form: { name: form_message, submit: form_submit_message, fields: { text: get('form_message-text').value.trim() } } })
                })
                TTEvents.formCallback(form_message, form=>{
                    get('form_message-text').setAttribute('undo', form.fields['form_message-text'])
                })
                message_administration_array.push({ form: { name: form_message } })
            }

        // USER ROLES ---------------------------------------------------------------------------------------------
            if (permission(form_roles)) {
                forms[form_roles] = {}
                get(form_submit_roles).addEventListener('click', ()=>{
                    Transport.send(urlSecure, TTEvents.form(form_roles, form_submit_roles))
                })
                TTEvents.formCallback(form_roles, (form)=>{
                    unget(get(form_roles+'-table'))
                    get(form_roles+'-container').innerHTML = draw_select_table(form_roles+'-table', TEXT.array_user_headings, ['15%','15%','15%','15%','15%',0,0,0], '500px', 1)
                    get(form_roles+'-container').style.height = '500px';
                    get(form_roles+'-container').style.opacity = 1;
                    form.fields.users.sort(sort_by_active_firstname)
                    for (var i=0, j=form.fields.users.length; i<j; i++) {
                        draw_select_table_option(form_roles+'-table', [
                            i,
                            `<span class="bold-text">${form.fields.users[i].uuid}</span>`,
                            `<span class="contenteditable">${form.fields.users[i].firstname||TEXT.default_firstname}</span>`,
                            `<span class="contenteditable">${form.fields.users[i].lastname||TEXT.default_lastname}</span>`,
                            `<span class="contenteditable">${form.fields.users[i].email||''}</span>`,
                            draw_select(form_roles+'-role-'+i),
                            draw_checkbox(form_roles+'-alerts-'+i, undefined, !!form.fields.users[i].alerts),
                            draw_checkbox(form_roles+'-reports-'+i, undefined, !!form.fields.users[i].reports),
                            draw_button(form_roles+'-save-'+i, 'user-save-icon.svg'),
                        ], select_table_handler)
                        get(form_roles+'-role-'+i).innerHTML = draw_select_options(TEXT.array_user_roles, form.fields.users[i].role)
                        get(form_roles+'-save-'+i).addEventListener('click', (e)=>{
                            var ele = e.target
                            while (ele !== document.body && !ele.classList.contains('button')) ele = ele.parentElement
                            if (ele === document.body) return
                            const index = +ele.id.split(form_roles+'-save-')[1],
                                row = get(form_roles+'-table').children[0].rows[index + 2]
                            Transport.send(urlSecure, {
                                form: {
                                    name: form_user_role,
                                    fields: {
                                        index,
                                        uuid: row.children[0].innerText,
                                        firstname: row.children[1].innerText,
                                        lastname: row.children[2].innerText,
                                        email: row.children[3].innerText,
                                        role: row.children[4].children[0].children[1].selectedIndex,
                                        alerts: row.children[5].children[0].children[0].checked,
                                        reports: row.children[6].children[0].children[0].checked,
                                    }
                                },
                            })
                        })
                    }
                    return true
                })
                TTEvents.formCallback(form_user_role, (form)=>{
                    if (form.error) showErrorBox(form.error)
                })
                //message_administration_array.push({ form: { name: form_roles } })
            }


        // FORM_LINE ----------------------------------------------------------------------------
            if (permission(form_line)) {
                get(form_submit_line).addEventListener('click', ()=>{
                    if (!get(form_line+'-name').value.trim()) return
                    const field_names = ['name', 'description'],
                        fields = {}
                    for (var i in field_names) {
                        const ele = get(form_line+'-'+field_names[i])
                        if (ele.value.trim() !== ele.getAttribute('undo')) fields[form_line+'-'+field_names[i]] = ele.value.trim()
                    }
                    if (Object.keys(fields).length) Transport.send(urlSecure, { form: { name: form_line, submit: form_submit_line, fields } })
                })
                TTEvents.formCallback(form_line, form=>{
                    get(form_line+'-name').setAttribute('undo', form.fields[form_line+'-name'])
                    get(form_line+'-description').setAttribute('undo', form.fields[form_line+'-description'])
                })
                message_administration_array.push({ form: { name: form_line } })
            }

        // DATABASE CREDENTIALS ---------------------------------------------------------------------------------------------
            if (permission(form_database)) {
                get(form_submit_database).addEventListener('click', form_database_submit)
                get(form_submit_database_test).addEventListener('click', form_database_submit)
                TTEvents.formCallback(form_database, form=>{
                    if (form.error) showErrorBox(form.error)
                    else if (form.success) showErrorBox(form.success, 'green', 'white')
                })
                message_administration_array.push({ form: { name: form_database } })
                
                function form_database_submit () {
                    const field_names = ['address','port','database','dusername','dpassword'],
                        fields = {}
                    for (var i in field_names) {
                        const ele = get(form_database+'-'+field_names[i])
                        if (ele.value.trim() !== ele.getAttribute('undo')) fields[form_database+'-'+field_names[i]] = ele.value.trim()
                    }
                    if (Object.keys(fields).length) {
                        showErrorBox(TEXT.phrase_please_wait, 'gray', 'black')
                        Transport.send(urlSecure, {
                            form: {
                                name: form_database,
                                submit: get(form_submit_database) === this ? form_submit_database : undefined,
                                fields,
                            }
                        })
                    }
                }
            }

        // PRODUCTION CREDENTIALS ---------------------------------------------------------------------------------------------
            if (permission(form_production)) {
                get(form_submit_production).addEventListener('click', ()=>{
                    const field_names = ['address','pusername','ppassword'],
                        fields = {}
                    for (var i in field_names) {
                        const ele = get(form_production+'-'+field_names[i])
                        if (ele.value.trim() !== ele.getAttribute('undo')) fields[form_production+'-'+field_names[i]] = ele.value.trim()
                    }
                    if (Object.keys(fields).length) Transport.send(urlSecure, { form: { name: form_production, submit: form_submit_production, fields } })
                })
                TTEvents.formCallback(form_production, form=>{
                    if (form.error) showErrorBox(form.error)
                })
                message_administration_array.push({ form: { name: form_production } })
            }

        // MAIL SERVER CREDENTIALS ---------------------------------------------------------------------------------------------
            if (permission(form_mail)) {
                get(form_submit_mail).addEventListener('click', ()=>{
                    const field_names = ['email','address','port','musername','mpassword'],
                        fields = {}
                    for (var i in field_names) {
                        const ele = get(form_mail+'-'+field_names[i])
                        if (ele.value.trim() !== ele.getAttribute('undo')) fields[form_mail+'-'+field_names[i]] = ele.value.trim()
                    }
                    Transport.send(urlSecure, { form: { name: form_mail, submit: form_submit_mail, fields } })
                })
                TTEvents.formCallback(form_mail, form=>{
                    if (form.error) showErrorBox(form.error)
                })
                message_administration_array.push({ form: { name: form_mail } })
            }
            if (idleTimeout !== undefined) get(name).addEventListener('scroll', setIdleTimeout)
            if (message_administration_array.length) Transport.send(urlSecure, message_administration_array)
        }
    }

//-------------------------------------------------------------------------------------------------------------
    function showScreen_Events_Reports () {
        const name = 'screen6'
        state.currentScreen = name       
        if (get(name)) {
            get(name).classList.remove('screen-hide')
            get(name).classList.add('screen-show')
        } else {
            if (!permission('form_events')) return
			
			const form_events = 'form_events',
                form_submit_events = form_events+'-submit',
                form_event = 'form_event',
                form_submit_event = form_event+'-submit',
                form_event_details = 'form_event_details',
                form_submit_event_details = form_event_details+'-submit',
                form_event_approve = 'form_event_approve',
                form_submit_event_approve = form_event_approve+'-submit',
                form_report = 'form_report',
                form_submit_report = form_report+'-submit',
                form_users = 'form_users',
                //form_submit_users = form_users+'-submit',
                shift_attributes = `style="width: 64px;"`,
                year_attributes = `style="width: 110px;"`,
                month_attributes = `style="width: 180px;"`,
                day_attributes = `style="width: 70px;"`,
                colon = `<div class="bottom-align-text">:</div>`,
                today = new Date,
                the_year = today.getFullYear(),
                the_month = today.getMonth() + 1,
                the_date = today.getDate(),
                column_headings = [
                    TEXT.column_line,
                    TEXT.column_shift,
                    TEXT.column_station,
                    TEXT.column_code,
                    TEXT.column_status,
                    TEXT.column_date,
                    TEXT.column_duration,
                    TEXT.column_description,
                ],
                years = []

            for (var i=2020; i<=the_year; i++) years.push(i)
    
            document.body.append(Object.assign(get(name, 'div'), {
                classList: 'screen max-width',
                innerHTML: `
                    <div class="screen-inlay-top"><img src="images/perkins-logo-large-blue.png"/></div>
                    <h2>${TEXT.title_events_reports}</h2>
                    <div class="field-container">
                        ${draw_select(form_events+'-start-year', TEXT.label_period_from, draw_select_options(years), year_attributes)}
                        ${draw_select(form_events+'-start-month', TEXT.field_month, draw_select_options(TEXT.array_months), month_attributes)}
                        ${draw_select(form_events+'-start-date', TEXT.field_date, undefined, day_attributes)}
                        ${draw_select(form_events+'-start-hour', TEXT.field_hour, draw_select_options(hours_24), shift_attributes)}${colon}
                        ${draw_select(form_events+'-start-minute', TEXT.field_min, draw_select_options(minutes_1_interval), shift_attributes)}
                        <div class="divider-horizontal"></div>
                        ${draw_select(form_events+'-end-year', TEXT.label_period_to, draw_select_options(years), year_attributes)}
                        ${draw_select(form_events+'-end-month', TEXT.field_month, draw_select_options(TEXT.array_months), month_attributes)}
                        ${draw_select(form_events+'-end-date', TEXT.field_date, undefined, day_attributes)}
                        ${draw_select(form_events+'-end-hour', TEXT.field_hour, draw_select_options(hours_24), shift_attributes)}${colon}
                        ${draw_select(form_events+'-end-minute', TEXT.field_min, draw_select_options(minutes_1_interval), shift_attributes)}
                    </div>
                    ${permission('form_report')
                    ? `<div class="field-container">
                        ${draw_select(form_report+'-option', TEXT.label_report_option, draw_select_options(TEXT.array_report_styles))}
                        ${draw_checkbox(form_report+'-download', TEXT.field_download, true)}
                        ${draw_button(form_submit_report, 'report-icon.svg', TEXT.button_report.toUpperCase(), undefined, true)}
                    </div>` : ''}
                    <div class="field-container">
                        ${draw_select(form_events+'-uuid', TEXT.field_uuid)}
                        <div class="field-container" style="flex-wrap: nowrap;">
                            <input id="${form_events+'-event-0'}" type="checkbox" class="color-checkbox" style="background-color:yellow;" checked="true"/>
                            <input id="${form_events+'-event-1'}" type="checkbox" class="color-checkbox" style="background-color:blue;" checked="true"/>
                            <input id="${form_events+'-event-2'}" type="checkbox" class="color-checkbox" style="background-color:red;" checked="true"/><br/>
                            <label>${TEXT.field_event_type.toUpperCase()}</label>
                        </div>
                        ${draw_checkbox(form_events+'-ascend', TEXT.field_ascend, true)}
                        ${draw_button(form_submit_events, 'search-icon.svg', TEXT.button_search.toUpperCase(), undefined, true)}
                    </div>
                    <div class="field-container">
                        ${draw_checkbox(form_events+'-initiated', TEXT.field_initiated, true)}
                        ${draw_checkbox(form_events+'-finalized', TEXT.field_finalized)}
                        ${draw_checkbox(form_events+'-concluded', TEXT.field_concluded)}
                        ${draw_checkbox(form_events+'-analyzed', TEXT.field_analyzed)}
                    </div>
                    <div class="divider"></div>
                    ${draw_select_table(form_events+'-selector', column_headings, [0,0,0,0,0,0,0,'100%'])}
                `
            }))
            setTimeout(()=>{ get(name).classList.add('screen-show') }, 30)

            get(form_events+'-selector').addEventListener('click', (e)=>{
                const selector = get(form_events+'-selector'),
                    rows = selector.children[0].rows
                var editor = get(form_event+'-editor')
                var target = e.target
                if (target.id.endsWith('-close-event')) {
                    rows[state.event_current].classList.remove('field-select-table-row-on')
                    selector.deleteRow(state.event_current + 1)
                    state.event_current = undefined
                    return
                }
                while (target && (target.tagName !== 'TR' || target.parentElement === get(form_event+'-summary'))) target = target.parentElement
                if (!target) return
                var next_current = Array.prototype.indexOf.call(rows, target)
                if (next_current < 1 || next_current === state.event_current + 1) return
                if (state.event_current) {
                    rows[state.event_current].classList.remove('field-select-table-row-on')
                    editor.style.transition = 'none'
                    editor.style.opacity = 0
                    selector.deleteRow(state.event_current + 1)
                }
                if (next_current > state.event_current) next_current--
                rows[next_current].classList.add('field-select-table-row-on')
                state.event_current = next_current
                selector.insertRow(state.event_current + 1)
                rows[state.event_current + 1].className = 'event-container'
                rows[state.event_current + 1].innerHTML = `<td colspan="${column_headings.length}"><div class="triangle-down"></div><div id="${form_event}-close-event" class="close-x">&times;</div></td>`
                if (editor) rows[state.event_current + 1].cells[0].append(editor)
                else {
                    rows[state.event_current + 1].cells[0].append(editor = drawEventEditor())
                    editor.style.transition = "none"
                    editor.style.opacity = 0
                    get(form_event+'-version').addEventListener('change', (e)=>{
                        if (!(state.caches[form_event] instanceof Object)) return showErrorBox('No Event Selected')
                        const fields = {
                            r: state.caches[form_event].r,
                            v: +e.target.value,
                        }
                        Transport.send(urlSecure, { form: { name: form_event, submit: form_submit_event, fields } })
                    })
                    get(form_submit_event_details) && get(form_submit_event_details).addEventListener('click', ()=>{
                        if (!(state.caches[form_event] instanceof Object)) return showErrorBox('No Event Selected')
                        const x = get(form_event+'-quality-checkbox'),
                            d = get(form_event+'-description'),
                            a = get(form_event+'-action'),
                            o = get(form_event+'-observation'),
                            fields = {
                                r: state.caches[form_event].r,
                                d: d.value.trim(),
                                a: a.value.trim(),
                                o: o.value.trim(),
                                v: null,
                                x: x.checked,
                            },
                            x_changed = fields.x !== (x.getAttribute('original') === 'true' ? true : false)
                        if (!fields.d && !x_changed) showErrorBox(TEXT.phrase_description_not_filled, 'orange')
                        else if (
                            x_changed
                            || (fields.d && d.getAttribute('original') !== fields.d)
                            || (fields.d && fields.a && a.getAttribute('original') !== fields.a)
                            || (fields.o && o.getAttribute('original') !== fields.o)
                        ) {
                            //TODO: Remove load flicker?
                            //fillEventFields()
                            Transport.send(urlSecure, { form: { name: form_event_details, submit: form_submit_event_details, fields } })
                        }
                    })
                    get(form_event+'-area').addEventListener('change', changeA)
                    get(form_event+'-group').addEventListener('change', changeG)
        
                    function changeA (e) {
                        get(form_event+'-group').innerHTML = combo_list(state.caches.AGC[e.target.value])
                        get(form_event+'-group').value = ''
                        get(form_event+'-purpose').innerText = ''
                    }
        
                    function changeG (e) {
                        get(form_event+'-purpose').innerHTML = combo_list(state.caches.AGC[get(form_event+'-area').value][e.target.value])
                        get(form_event+'-purpose').value = ''
                    }
        
                    get(form_submit_event_approve) && get(form_submit_event_approve).addEventListener('click', ()=>{
                        if (!permission(form_event_approve)) return showErrorBox(TEXT.phrase_permission, 'orange')
                        const x = get(form_event+'-quality-checkbox')
                        const x_changed = x ? x.checked !== (x.getAttribute('original') === 'true' ? true : false) : false
                        if (!x_changed && (!get(form_event+'-description').value.trim() || !get(form_event+'-action').value.trim())) {
                            return showErrorBox(TEXT.phrase_description_action_not_filled, 'orange')
                        }
                        if (x_changed && !x.checked) get(form_event+'-area').value = undefined
                        var unset, tryset
                        if (!get(form_event+'-area').value) unset = true
                        else {
                            tryset = true
                            if (get(form_event+'-group').options.length) {
                                if (!get(form_event+'-group').value) unset = true
                                else if (get(form_event+'-purpose').options.length) {
                                    if (!get(form_event+'-purpose').value) unset = true
                                }
                            }
                        }
                        if (tryset && unset) return showErrorBox(TEXT.phrase_AGC_not_filled, 'orange')
                        var changed
                        const checkers = ['description','action','observation','area','group','purpose']
                        for (var c in checkers) {
                            const ele = get(form_event+'-'+checkers[c])
                            if (ele.getAttribute('original') !== ele.value) changed = true
                        }
                        if (x_changed || changed) {
                            const fields = {
                                    r: state.caches[form_event].r,
                                    v: null,
                                    d: get(form_event+'-description').value,
                                    a: get(form_event+'-action').value,
                                    o: get(form_event+'-observation').value,
                                    q: get(form_event+'-area').value,
                                    g: get(form_event+'-group').value,
                                    p: get(form_event+'-purpose').value,
                                    x: get(form_event+'-quality-checkbox').checked,
                                }
                            //TODO: Remove load flicker?
                            //fillEventFields()
                            Transport.send(urlSecure, { form: { name: unset ? form_event_details : form_event_approve, submit: form_submit_event_approve, fields } })
                        }
                    })
                }

                const off_screen = editor.getBoundingClientRect().bottom - (window.innerHeight || document.documentElement.clientHeight)
                if (off_screen > 0) get(name).scrollTop += off_screen + 32
                    
                const fields = {
                    r: +rows[state.event_current].getAttribute('event_reference'),
                    v: null,
                }
                //TODO: Remove load flicker?
                //fillEventFields()
                Transport.send(urlSecure, { form: { name: form_event, submit: form_submit_event, fields, AGC: !state.caches.AGC } })
                
                /*setTimeout(()=>{ 
                    editor.style.transition = "opacity 150ms ease-out"
                    setTimeout(()=>{ editor.style.opacity = 1 }, 0)
                }, 0)
                */
            })

            const start_trigger = drawDaysInMonth.bind(undefined, get(form_events+'-start-year'), get(form_events+'-start-month'), get(form_events+'-start-date'))
            get(form_events+'-start-year').selectedIndex = years.indexOf(the_year)
            get(form_events+'-start-year').addEventListener('change', start_trigger)
            get(form_events+'-start-month').selectedIndex = the_month - 1
            get(form_events+'-start-month').addEventListener('change', start_trigger)
            drawDaysInMonth(get(form_events+'-start-year'), get(form_events+'-start-month'), get(form_events+'-start-date'))
            get(form_events+'-start-date').selectedIndex = the_date - 1
            
            const end_trigger = drawDaysInMonth.bind(undefined, get(form_events+'-end-year'), get(form_events+'-end-month'), get(form_events+'-end-date'))
            get(form_events+'-end-year').value = the_year
            get(form_events+'-end-year').addEventListener('change', end_trigger)
            get(form_events+'-end-month').selectedIndex = the_month - 1
            get(form_events+'-end-month').addEventListener('change', end_trigger)
            drawDaysInMonth(get(form_events+'-end-year'), get(form_events+'-end-month'), get(form_events+'-end-date'))
            get(form_events+'-end-date').value = the_date
            get(form_events+'-end-hour').value = 23
            get(form_events+'-end-minute').value = 59

            //Transport.send(urlSecure, { form: { name: form_users } })

        // UUIDs
            TTEvents.formCallback(form_users, (form)=>{
                if (form.error || !(form.fields instanceof Object)) return
                const options = [['', '---']]
                for (var user in form.fields.users.sort(sort_by_index_1)) {
                    const usr = form.fields.users[user]
                    if (typeof usr[2] === 'string' && typeof usr[1] === 'string')
                        options.push([usr[0], `${usr[1]} ${usr[2]} [${usr[0]}]`])
                }
                get(form_events+'-uuid').innerHTML = draw_select_options(options)
                return true
            })

        //QUERY EVENTS
            get(form_submit_events).addEventListener('click', ()=>{
                if (state[form_submit_events+'-busy']) return
                const tbody = get(form_events+'-selector').children[0],
                    headings = tbody.children[0],
                    widths = tbody.children[1]
                tbody.innerText = ''
                tbody.appendChild(headings)
                tbody.appendChild(widths)
                const fields = {
                    start: new Date(
                        +get(form_events+'-start-year').value,
                        get(form_events+'-start-month').selectedIndex,
                        get(form_events+'-start-date').selectedIndex + 1,
                        get(form_events+'-start-hour').selectedIndex,
                        get(form_events+'-start-minute').selectedIndex,
                    ).getTime(),
                    end: new Date(
                        +get(form_events+'-end-year').value,
                        get(form_events+'-end-month').selectedIndex,
                        get(form_events+'-end-date').selectedIndex + 1,
                        get(form_events+'-end-hour').selectedIndex,
                        get(form_events+'-end-minute').selectedIndex,
                    ).getTime(),
                    initiated: get(form_events+'-initiated').checked,
                    finalized: get(form_events+'-finalized').checked,
                    concluded: get(form_events+'-concluded').checked,
                    analyzed: get(form_events+'-analyzed').checked,
                    event0: get(form_events+'-event-0').checked,
                    event1: get(form_events+'-event-1').checked,
                    event2: get(form_events+'-event-2').checked,
                    ascend: get(form_events+'-ascend').checked,
                    uuid: get(form_events+'-uuid').value,
                }
                delete state.event_current
                Transport.send(urlSecure, { form: { name: form_events, submit: form_submit_events, fields } })
                get(form_submit_events+'-image').classList.add('button-spinning')
                state[form_submit_events+'-busy'] = setTimeout(()=>{
                    delete state[form_submit_events+'-busy']
                    get(form_submit_events+'-image').classList.remove('button-spinning')
                    showErrorBox(TEXT.phrase_database_timeout, 'orange')
                }, eventQueryTimeout)
            })
            TTEvents.formCallback(form_events, (form)=>{
                clearTimeout(state[form_submit_events+'-busy'])
                delete state[form_submit_events+'-busy']
                get(form_submit_events+'-image').classList.remove('button-spinning')
                if (form.error) showErrorBox(form.error)
                else {
                    if (!form.fields.length) {
                        showErrorBox(TEXT.phrase_no_results)
                        return true
                    }
                    if (form.limited) showErrorBox(TEXT.phrase_results_more_than + ' ' + form.limited + ' ' + TEXT.phrase_results_limited, 'orange', 'black')
                    else showErrorBox(form.count + ' ' + TEXT.phrase_results_count, 'green', 'white')
                    const tbody = get(form_events+'-selector').children[0],
                        headings = tbody.children[0],
                        widths = tbody.children[1]
                    tbody.innerText = ''
                    tbody.appendChild(headings)
                    tbody.appendChild(widths)
                    for (var i=0; i<form.fields.length; i++) {
                        const row = get('', 'tr')
                        row.style.textAlign = 'center'
                        row.innerHTML = drawSingleEvent(form.fields[i])
                        tbody.appendChild(row)
                        row.setAttribute('event_reference', form.fields[i].r)
                    }
                }
                return true
            })

            function drawDaysInMonth (ele_year, ele_month, ele_day, e) {
                const month = ele_month.selectedIndex + 1,
                    days_in_month = new Date(+ele_year.value + (month === 12 ?  1 : 0), month === 12 ? 0 : month, 0).getDate()
                var html = ''
                for (var i=1; i<=days_in_month; i++) html += `<option>${i}</option>`
                ele_day.innerHTML = html
            }

            function drawSingleEvent (columns) {
                if (!(columns instanceof Object)) return ''
                return `
                    <td>${columns.l}</td>
                    <td>${columns.w || '-'}</td>
                    <td><span class="bolder">${columns.sn}</span></td>
                    <td class="event-code-color-${columns.c[0]} no-wrap">${columns.c}</td>
                    <td>${TEXT.field_status_enum[columns.st]}</td>
                    <td class="three-quarter-font no-wrap">${dateTimeOnly(columns.r, ' ')}</td>
                    <td>${columns.e ? +((columns.e - columns.r) / one_minute_ms).toFixed(1) : '&hellip;'}</td>
                    <td class="relative"><span class="summarized">${columns.d||''}</span></td>
                `
            }

        //EVENT DETAILS EDITOR
            function drawEventEditor () {
                const editor = get(form_event+'-editor', 'div')
                editor.innerHTML = `
                    <div class="event-content event-summary">
                        <table id="${form_event+'-summary'}">
                            <tr><td>${TEXT.column_line}</td><td></td></tr>
                            <tr><td>${TEXT.column_shift}</td><td></td></tr>
                            <tr><td>${TEXT.column_station}</td><td></td></tr>
                            <tr><td>${TEXT.field_start}</td><td style="font-size: 0.8em"></td></tr>
                            <tr><td>${TEXT.field_end}</td><td style="font-size: 0.8em"></td></tr>
                            <tr><td>${TEXT.field_duration_wait}</td><td></td></tr>
                            <tr><td>${TEXT.field_duration_hold}</td><td></td></tr>
                            <tr><td>${TEXT.field_duration}</td><td></td></tr>
                            <tr><td>${TEXT.field_stage}</td><td></td></tr>
                            <tr><td>${TEXT.field_version}</td><td><select id="${form_event}-version" style="margin-left: 0px;"></select></td></tr>
                        </table>
                        <div id="${form_event}-quality-container" class="${form_event}-quality">
                            <input type="checkbox" id="${form_event}-quality-checkbox"/>
                            <label for="${form_event}-quality-checkbox" style="line-height: 40px;">${TEXT.label_quality}</label>
                        </div>
                    </div>
                    <div class="event-content event-details">
                        ${draw_textarea(form_event+'-description', TEXT.field_description)}
                        ${draw_textarea(form_event+'-action', TEXT.field_action, undefined, false)}
                        ${draw_textarea(form_event+'-observation', TEXT.field_observation)}
                        <span id="${form_event}-modified" class="flex1 centered"></span>
                    </div>
                    <div class="event-content event-approval justify">
                        ${draw_select(form_event+'-area', TEXT.column_area, [], 'width: 100%;', false)}
                        ${draw_select(form_event+'-group', TEXT.column_group, [], 'width: 100%;', false)}
                        ${draw_select(form_event+'-purpose', TEXT.column_cause, [], 'width: 100%;', false)}
                        <div class="align-right full-width">${permission(form_event_approve)
                            ? draw_button(form_submit_event_approve, 'approve-icon.svg', TEXT.button_save+' / '+TEXT.button_approve)
                            : draw_button(form_submit_event_details, 'save-icon.svg', TEXT.button_save)
                        }</div>
                    </div>
                `
                return editor
            }

        // SINGLE EVENT
            TTEvents.formCallback(form_event, getEventFields)
            TTEvents.formCallback(form_event_details, getEventFields)
            TTEvents.formCallback(form_event_approve, getEventFields)

            function getEventFields (form) {
                if (form.error) showErrorBox(form.error === 'permissions' ? TEXT.phrase_permission : form.error, 'orange')
                else if (isNaN(state.event_current)) showErrorBox('No Event Selected')
                else if (!(form.fields instanceof Object)) showErrorBox(TEXT.phrase_no_results)
                else {
                    hideErrorBox()
                    //TODO: Restore for no load flicker
                    fillEventFields()
                    state.caches[form_event] = form.fields
                    if (permission(form_event_approve)) {
                        if (form.AGC instanceof Object) state.caches.AGC = form.AGC
                        fillEventFields(form.fields, state.caches.AGC)
                    }
                    else fillEventFields(form.fields)
                }
                return true
            }

            function fillEventFields (data, AGC) {
                var clearing
                if (!(data instanceof Object)) {
                    clearing = true
                    data = {}
                    const checkers = ['description','action','observation','area','group','purpose']
                    for (var c in checkers)
                        get(form_event+'-'+checkers[c]).setAttribute('original', get(form_event+'-'+checkers[c]).value = '')
                }
                else get(form_event+'-editor').style.opacity = 1
                const summary = get(form_event+'-summary').rows,
                    fields = [
                        data.l || '',
                        data.w || '',
                        `<span class="bolder">${data.sn || ''}</span>`,
                        data.r ? dateTimeOnly(data.r, ' ') : ' ',
                        data.e ? dateTimeOnly(data.e, ' ') : ' ',
                        data.z ? timerFormat(data.z, true) + (data.h ? '' : ' +') : ' ',
                        data.h ? timerFormat(data.h, true) + (data.e ? '' : ' +') : ' ',
                        (data.z || data.h) ? timerFormat((data.z||0) + (data.h||0), true) + (data.e ? '' : ' +') : ' ',
                        data.val !== undefined ? TEXT.field_stage_enum[data.val] || TEXT.field_stage_enum[0] : '',
                    ]
                for (var i=0; i<fields.length; i++) summary[i].cells[1].innerHTML = fields[i]

                if (clearing) get(form_event+'-version').setAttribute('event_versions', get(form_event+'-version').innerText = '')
                else if (data.vv > +get(form_event+'-version').getAttribute('event_versions')) {
                    get(form_event+'-version').setAttribute('event_versions', data.vv)
                    var opts = ''
                    for (var i=data.vv; i>0; i--) opts += `<option>${i}</option>`
                    get(form_event+'-version').innerHTML = opts
                }
                get(form_event+'-version').value = data.v
                get(form_event+'-quality-container').style.display = data.b === 2 ? 'block' : 'none'
                get(form_event+'-quality-checkbox').setAttribute('original', get(form_event+'-quality-checkbox').checked = !!data.x)

                get(form_event+'-description').setAttribute('original', get(form_event+'-description').value = data.d || '')
                enable_input(get(form_event+'-action'), data.st)
                get(form_event+'-action').setAttribute('original', get(form_event+'-action').value = data.a || '')
                get(form_event+'-observation').setAttribute('original', get(form_event+'-observation').value = data.o || '')

                get(form_event+'-modified').innerHTML = (data.mf ? `${data.ml},${data.mf}` : '') + `<br/>${dateTimeOnly(data.id, ' ')}`

                get(form_events+'-selector').children[0].rows[state.event_current].innerHTML = drawSingleEvent(state.caches[form_event])

                if (!clearing) updateAGC(AGC, data, !!(data.st >= 15 || (data.st >= 10 && data.d.trim() && data.a.trim() && +get(form_event+'-version').getAttribute('event_versions'))))
            }

            // REPORT GENERATOR
            if (permission('form_report')) {
                get(form_submit_report).addEventListener('click', ()=>{
                    if (state[form_submit_report+'-busy']) return
                    const start = new Date(
                            +get(form_events+'-start-year').value,
                            get(form_events+'-start-month').selectedIndex,
                            get(form_events+'-start-date').selectedIndex + 1,
                            get(form_events+'-start-hour').selectedIndex,
                            get(form_events+'-start-minute').selectedIndex,
                        ),
                        end = new Date(
                            +get(form_events+'-end-year').value,
                            get(form_events+'-end-month').selectedIndex,
                            get(form_events+'-end-date').selectedIndex + 1,
                            get(form_events+'-end-hour').selectedIndex,
                            get(form_events+'-end-minute').selectedIndex,
                        ),
                        fields = {
                            line: 1,
                            start: start.getTime(),
                            end: end.getTime(),
                            initiated: get(form_events+'-initiated').checked,
                            finalized: get(form_events+'-finalized').checked,
                            concluded: get(form_events+'-concluded').checked,
                            analyzed: get(form_events+'-analyzed').checked,
                            event0: get(form_events+'-event-0').checked,
                            event1: get(form_events+'-event-1').checked,
                            event2: get(form_events+'-event-2').checked,
                            ascend: get(form_events+'-ascend').checked,
                            option: get(form_report+'-option').selectedIndex,
                            download: get(form_report+'-download').checked,
                        }
                    window.transport_DOWNLOAD = `Takttime Relatorio - ${start.getFullYear()}-${(''+(start.getMonth()+1)).padStart(2,'0')}-${(''+start.getDate()).padStart(2,'0')}-${(''+start.getHours()).padStart(2,'0')}_${(''+start.getMinutes()).padStart(2,'0')}-${end.getFullYear()}-${(''+(end.getMonth()+1)).padStart(2,'0')}-${(''+end.getDate()).padStart(2,'0')}-${(''+end.getHours()).padStart(2,'0')}_${(''+end.getMinutes()).padStart(2,'0')}.xlsm`
                    Transport.send(urlSecure, { form: { name: form_report, submit: form_submit_report, fields } })
                    get(form_submit_report+'-image').classList.add('button-spinning')
                    state[form_submit_report+'-busy'] = setTimeout(()=>{
                        delete state[form_submit_report+'-busy']
                        get(form_submit_report+'-image').classList.remove('button-spinning')
                        showErrorBox(TEXT.phrase_database_timeout, 'orange')
                    }, reportQueryTimeout)
                })
                TTEvents.formCallback(form_report, (form)=>{
                    clearTimeout(state[form_submit_report+'-busy'])
                    state[form_submit_report+'-busy'] = false
                    get(form_submit_report+'-image').classList.remove('button-spinning')
                    if (form.error) showErrorBox(form.error) //TODO: combine possible errors concat
                    else showErrorBox(TEXT.phrase_report_downloaded, 'green', 'white')
                    return true
                })
            }
            if (idleTimeout !== undefined) get(name).addEventListener('scroll', setIdleTimeout)
        }
        Transport.send(urlSecure, { form: { name: 'form_users' } })
    }

    //------------------------//

    TTEvents.formCallback('form_agc', form=>{
        if (form.submit && form.accepted) state.caches.AGC_changes = []
        if (updateAGC.editor instanceof Function) updateAGC.editor(form)
        if (document.getElementById('form_event-area')) updateAGC(form.fields)
        return true
    })

    function updateAGC (menu, data, enabled) {
        const form_event = 'form_event',
            form_event_approve = 'form_event_approve',
            fields = ['area', 'group', 'purpose'],
            which = ['q', 'g', 'p']
        enable_input(get(form_event+'-quality-checkbox'), data.st <= 5)
        for (var i in fields) {
            const ele = get(form_event+'-'+fields[i])
            var value = data instanceof Object ? data[which[i]] || '' : ele.value || ''
            if (enabled && permission(form_event_approve)) {
                enable_input(ele, data.x ? false : enabled)
                if (i==='0') {
                    if (data.x) {
                        for (var j in menu) if (menu[j][0].indexOf('Qualidade') >= 0) {
                            if (j !== value) {
                                data.q = value = j
                                data.g = undefined
                                data.p = undefined
                            }
                            break
                        }
                    }
                }
            }
            if (enabled && menu instanceof Object && (!menu['0'] || !menu['0'].startsWith('_'))) {
                ele.innerHTML = combo_list(menu)
                menu = (menu[value] instanceof Object) ? menu[value] : {}
            }
            else ele.innerText = ''
            ele.setAttribute('original', ele.value = value)
        }
    }

    function combo_list (menu) {
        var html = ''
        if (menu instanceof Object) {
            const keys = Object.keys(menu).sort(tag_sort)
            for (var i in keys) if (keys[i] !== '0') {
                const item = menu[keys[i]],
                    text = item instanceof Object ? item[0] : item
                if (typeof text !== 'string') continue
                if (!text.startsWith('_')) html += `<option value="${keys[i]}">${text}</option>`
            }
        }
        return html
    }

    function tag_sort (a, b) {
        const _a = +a, _b = +b
        var p_a, p_b
        return _a < _b ? -1 : _a > _b ? 1 : (p_a = parseInt(a)) < (p_b = parseInt(b)) ? -1 : p_a > p_b ? 1 : a < b ? -1 : a > b ? 1 : 0
    }

    function sort_by_active_firstname (a, b) {
        if (a instanceof Object && b instanceof Object) {
            return !a.role && b.role
                ? 1
                : a.role && !b.role
                    ? -1
                    : (!a.firstname || a.firstname < b.firstname)
                        ? -1
                        : 1
        }
        else return 0
    }

    function sort_by_index_1 (a, b) {
        return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0
    }

//-------------------------------------------------------------------------------------------------------------
    function showScreen_DataEntry () {
        const name = 'screen7'
        state.currentScreen = name
        if (get(name)) {
            get(name).classList.remove('screen-hide')
            get(name).classList.add('screen-show')
        } else {
            const form_commands = 'form_commands',
                form_stations = 'stations_entry',
                button_id = form_stations+'-button-',
                form_submit_stations = form_stations+'-submit',
                form_test = 'form_test',
                form_test_takt = 'form_test_takt',
                form_submit_test_takt = form_test_takt+'-TEST',
                form_plc = 'form_plc',
                form_plc_submit = form_plc+'-submit',
                form_reset_only = 'form_reset_only',
                form_reset_clear = 'form_reset_clear',
                form_scheduler_run = 'form_scheduler_run',
                ip_attributes = `maxlength="3" style="width: 64px;"`,
                port_attributes = `maxlength="5" style="width: 72px;"`,
                address_attributes = `style="width: 96px;"`,
                offset_attributes = `style="width: 72px;" type="number" min="0" max="999" step="1"`,
                status_attributes = `style="flex-basis: 150px;"`,
                dot = `<div class="bottom-align-text">.</div>`,
                colon = `<div class="bottom-align-text">:</div>`

            var plc_optional = ''
            if (permission(form_stations)) {
                for (var b = 0; b <= 2; b++) {
                    plc_optional +=  `
                        ${draw_break()}
                        <div class="field-container background-bbb">
                            <div class="button-icon-cont"><div id="${button_id}${b}-TEST" class="radial-gradient-${b} button-icon button-test-${b?'white':'black'}"></div></div>
                            ${draw_input(button_id+b+'-ip1', TEXT.field_ipaddr, ip_attributes)}${dot}
                            ${draw_input(button_id+b+'-ip2', TEXT.field_subnet, ip_attributes)}${dot}
                            ${draw_input(button_id+b+'-ip3', TEXT.field_subnet, ip_attributes)}${dot}
                            ${draw_input(button_id+b+'-ip4', TEXT.field_subnet, ip_attributes)}${colon}
                            ${draw_input(button_id+b+'-port', TEXT.field_port, port_attributes)}
                            ${draw_input(button_id+b+'-address', TEXT.field_address, address_attributes)}
                            ${draw_input(button_id+b+'-offset', TEXT.field_offset, offset_attributes)}
                            ${draw_output(button_id+b+'-status', TEXT.field_status, status_attributes)}
                            ${draw_break()}
                        </div>
                    `
                }
            }
                
            var plcs = ''
            if (permission(form_plc)) for (var sh=1; sh<=SHIFTS; sh++) {
                const tname = form_plc+'-'+sh
                plcs += `
                    <td>
                    <div class="inline-block">
                        <h3>${TEXT.title_shift} ${sh}</h3>
                        ${draw_input(tname+'-shift-address', TEXT.field_address, address_attributes)}
                        ${draw_input(tname+'-shift-start-offset', TEXT.field_start+' '+TEXT.field_off, offset_attributes)}
                        ${draw_input(tname+'-shift-end-offset', TEXT.field_end+' '+TEXT.field_off, offset_attributes)}
                        ${draw_output(tname+'-shift-status', TEXT.field_status, status_attributes)}
                        ${draw_break()}
                        ${TEXT.title_takttime}<br/>
                        ${draw_input(tname+'-takttime-address', TEXT.field_address, address_attributes)}
                        ${draw_input(tname+'-takttime-offset', TEXT.field_offset, offset_attributes)}
                        ${draw_output(tname+'-takttime-status', TEXT.field_status, status_attributes)}
                        ${draw_break()}
                        ${TEXT.title_takt_counter}<br/>
                        ${draw_input(tname+'-taktremain-address', TEXT.field_address, address_attributes)}
                        ${draw_input(tname+'-taktremain-offset', TEXT.field_offset, offset_attributes)}
                        ${draw_output(tname+'-taktremain-status', TEXT.field_status, status_attributes)}
                        ${draw_break()}
                        ${TEXT.title_trigger}<br/>
                        ${draw_input(tname+'-takt-trigger-address', TEXT.field_address, address_attributes)}
                        ${draw_input(tname+'-takt-trigger-offset', TEXT.field_offset, offset_attributes)}
                        ${draw_output(tname+'-takt-trigger-status', TEXT.field_status, status_attributes)}
                        ${draw_break()}
                        <div class="divider"></div>
                        <!--TURNO TRIGGER<br/>
                        ${draw_input(tname+'-shift-trigger-address', TEXT.field_address, address_attributes)}
                        ${draw_input(tname+'-shift-trigger-offset', TEXT.field_offset, offset_attributes)}
                        ${draw_output(tname+'-shift-trigger-status', TEXT.field_status, status_attributes)}
                        ${draw_break()}
                        <div class="divider"></div>-->
                        PARADAS<br/>
                `
                for (var j=1; j<=STOPPAGES; j++) {
                    const fname = form_plc+'-'+sh+'-'+j
                    plcs += `
                        ${j}
                        ${draw_input(fname+'-stoppage-address', TEXT.field_address, address_attributes)}
                        ${draw_input(fname+'-stoppage-start-offset', TEXT.field_start+' '+TEXT.field_off, offset_attributes)}
                        ${draw_input(fname+'-stoppage-end-offset', TEXT.field_end+' '+TEXT.field_off, offset_attributes)}
                        ${draw_output(fname+'-stoppage-status', TEXT.field_status, status_attributes)}
                        ${draw_break()}
                    `
                }
                plcs += `
                        ${TEXT.title_stoppage_trigger}<br/>
                        ${draw_input(tname+'-stoppage-trigger-address', TEXT.field_address, address_attributes)}
                        ${draw_input(tname+'-stoppage-trigger-offset', TEXT.field_offset, offset_attributes)}
                        ${draw_output(tname+'-stoppage-trigger-status', TEXT.field_status, status_attributes)}
                        ${draw_break()}
                    </td>
                `
            }

            document.body.append(Object.assign(get(name, 'div'), {
                classList: 'screen max-width',
                innerHTML: `
                    <div class="screen-inlay-top"><img src="images/perkins-logo-large-blue.png"/></div>
                    <h2>${TEXT.menu_dataentry}</h2>
                    
                    ${draw_form(form_commands, TEXT.title_commands, `
                        ${permission(form_scheduler_run) ? draw_confirmation_button('form_submit_scheduler_run', TEXT.button_scheduler_run.toUpperCase(), TEXT.phrase_reschedule_confirmation, TEXT.button_yes, 'background-color:#d89300;') : ''}
                        ${permission(form_reset_only) ? draw_confirmation_button('form_submit_reset_only', TEXT.button_reset_only.toUpperCase(), TEXT.phrase_reset_only_confirmation, TEXT.button_yes, 'background-color: lightgray;') : ''}
                        ${permission(form_reset_clear) ? draw_confirmation_button('form_submit_reset_clear', TEXT.button_reset_clear.toUpperCase(), TEXT.phrase_reset_clear_confirmation, TEXT.button_yes, 'background-color: orangered;') : ''}
                    `, false)}

                    ${permission(form_stations) ? draw_form(form_stations, TEXT.title_stations, `
                        ${draw_select_table(form_stations+'-selector', TEXT.title_andon_stations, [0,'100%'], '200px', 2)}
                        ${draw_break()}
                        ${draw_input(form_stations+'-name', TEXT.field_name.toUpperCase())}
                        ${draw_input(form_stations+'-description', TEXT.field_description.toUpperCase())}
                        ${plc_optional}
                        ${draw_break()}
                        ${draw_button(form_submit_stations, 'save-icon.svg', TEXT.button_save)}
                    `, true) : ''}

                    ${permission(form_plc) ? draw_form(form_plc, TEXT.title_PLC_configuration, `
                        <div class="field-container background-bbb">
                            <div class="button-icon-cont"><div id="${form_submit_test_takt}" class="radial-gradient-gray button-icon button-test-white"></div></div>
                            ${draw_input(form_plc+'-ip1', TEXT.field_ipaddr, ip_attributes)}${dot}
                            ${draw_input(form_plc+'-ip2', TEXT.field_subnet, ip_attributes)}${dot}
                            ${draw_input(form_plc+'-ip3', TEXT.field_subnet, ip_attributes)}${dot}
                            ${draw_input(form_plc+'-ip4', TEXT.field_subnet, ip_attributes)}${colon}
                            ${draw_input(form_plc+'-port', TEXT.field_port, port_attributes)}
                        </div>
                        ${draw_break()}
                        ${TEXT.title_datetime}
                        ${draw_break()}
                        ${draw_input(form_plc+'-datetime-address', TEXT.field_address, address_attributes)}
                        ${draw_input(form_plc+'-datetime-offset', TEXT.field_offset, offset_attributes)}
                        ${draw_output(form_plc+'-datetime-status', TEXT.field_status, status_attributes)}
                        ${draw_break()}
                        ${TEXT.title_date_trigger}
                        ${draw_break()}
                        ${draw_input(form_plc+'-datetime-trigger-address', TEXT.field_address, address_attributes)}
                        ${draw_input(form_plc+'-datetime-trigger-offset', TEXT.field_offset, offset_attributes)}
                        ${draw_output(form_plc+'-datetime-trigger-status', TEXT.field_status, status_attributes)}
                        ${draw_break()}
                        <div class="divider"></div>
                        <table width="100%"><tr>
                        ${plcs}
                        </tr></table>
                        ${permission(form_plc) ? `
                            ${draw_break()}
                            ${draw_button(form_plc_submit, 'save-icon.svg', TEXT.button_save)}
                            ` : ''}
                    `, true) : ''}
                `
            }))

            if (permission(form_plc)) {
                const ipFields = ['ip1','ip2','ip3','ip4','offset']
                for (var b=0; b<=2; b++) {
                    for (var i in ipFields) {
                        get(button_id+b+'-'+ipFields[i]).addEventListener('keydown', ensureNumber)
                        get(button_id+b+'-'+ipFields[i]).addEventListener('keyup', ensureByteRange)
                        get(button_id+b+'-'+ipFields[i]).addEventListener('change', ensureByteRange)
                    }
                    get(button_id+b+'-port').addEventListener('keydown', ensureNumber)
                    get(button_id+b+'-address').addEventListener('keydown', ensureNoSpace)

                    get(button_id+b+'-TEST').addEventListener('click', (b=>{
                        Transport.send(urlSecure, {
                            form: {
                                name: form_test,
                                fields: {
                                    ip1: +get(button_id+b+'-ip1').value,
                                    ip2: +get(button_id+b+'-ip2').value,
                                    ip3: +get(button_id+b+'-ip3').value,
                                    ip4: +get(button_id+b+'-ip4').value,
                                    port: +get(button_id+b+'-port').value,
                                    address: get(button_id+b+'-address').value,
                                    offset: +get(button_id+b+'-offset').value,
                                    trigger_address: get(button_id+b+'-address').value,
                                    trigger_offset: +get(button_id+b+'-offset').value,
                                    result_id: button_id+b+'-status',
                                },
                            },
                        })
                    }).bind(null, b))
                }

                const numFields = ['ip1','ip2','ip3','ip4']
                for (var i in numFields) {
                    get(form_plc+'-'+numFields[i]).addEventListener('keydown', ensureNumber)
                    get(form_plc+'-'+numFields[i]).addEventListener('keyup', ensureByteRange)
                    get(form_plc+'-'+numFields[i]).addEventListener('change', ensureByteRange)
                }
                //TODO get(shift_id+'-plan').addEventListener('keydown', ensureNumber)

                //get(shift_id+'-takttime').addEventListener('keydown', ensureNumber)
                get(form_plc+'-port').addEventListener('keydown', ensureNumber)
                //get(shift_id+'-takt-address').addEventListener('keydown', ensureNoSpace)
            }
    
            if (permission(form_stations)) {
                const tbody2 = get(form_stations+'-selector').children[0],
                    header2 = tbody2.rows[0].cells[0].children[0]
                tbody2.style.marginTop = header2.offsetHeight + 'px'
                header2.style.marginTop = -header2.offsetHeight + 'px'
        
                state.caches[form_stations] = {}
                state.stations_current = 0

                get(form_submit_stations).addEventListener('click', ()=>{
                    if (state.stations_current === undefined) return
                    const rows = get(form_stations+'-selector').children[0].rows,
                        id = rows[state.stations_current].getAttribute('_id'),
                        fields = {}
                    fields[id] = {
                        name: get(form_stations+'-name').value,
                        description: get(form_stations+'-description').value,
                        button: [{},{},{}],
                    }
                    for (var b=0; b<=2; b++) {
                        fields[id].button[b].host = [
                            +get(button_id+b+'-ip1').value,
                            +get(button_id+b+'-ip2').value,
                            +get(button_id+b+'-ip3').value,
                            +get(button_id+b+'-ip4').value,
                        ]
                        fields[id].button[b].port = +get(button_id+b+'-port').value
                        fields[id].button[b].address = get(button_id+b+'-address').value
                        fields[id].button[b].offset = +get(button_id+b+'-offset').value
                    }

                    Transport.send(urlSecure, { form: { name: form_stations, submit: form_submit_stations, fields: fields } })
                })

                Transport.send(urlSecure, { form: { name: form_stations } })
            }

            setTimeout(()=>{ get(name).classList.add('screen-show') }, 30)

            Transport.send(urlSecure, { form: { name: form_plc } })

        // FORM_STATIONS ---------------------------------------------------------------------------
            if (permission(form_stations)) {
                TTEvents.formCallback(form_stations, form=>{
                    if (form.error) return showErrorBox(form.error)
                    const rows = get(form_stations+'-selector').children[0].rows,
                        fields = form.fields
                    for (var i in fields) {
                        state.caches[form_stations][i] = fields[i]
                        var which
                        for (var j = 1; j < rows.length; j++) {
                            if (rows[j].getAttribute('_id') === i) { which = j; break }
                        }
                        if (which === undefined) {
                            draw_select_table_option(form_stations+'-selector', [i, fields[i].name, fields[i].description], e=>{
                                state.stations_current = select_table_handler(e)
                                const selected = state.caches[form_stations][rows[state.stations_current].getAttribute('_id')]
                                get(form_stations+'-name').value = selected.name
                                get(form_stations+'-description').value = selected.description
                                //add permission check?
                                if (selected.button instanceof Object) {
                                    for (var b=0; b<=2; b++) {
                                        get(button_id+b+'-ip1').value = selected.button[b].host[0]
                                        get(button_id+b+'-ip2').value = selected.button[b].host[1]
                                        get(button_id+b+'-ip3').value = selected.button[b].host[2]
                                        get(button_id+b+'-ip4').value = selected.button[b].host[3]
                                        get(button_id+b+'-port').value = selected.button[b].port
                                        get(button_id+b+'-address').value = selected.button[b].address
                                        get(button_id+b+'-offset').value = selected.button[b].offset
                                        get(button_id+b+'-status').innerText = ''
                                    }
                                }
                            })
                        } else {
                            if (which === state.stations_current) {
                                const updated = fields[i]
                                get(form_stations+'-name').value = updated.name
                                get(form_stations+'-description').value = updated.description
                                //add permission check?
                                if (Array.isArray(updated.button)) {
                                    for (var b=0; b<=2; b++) {
                                        get(button_id+b+'-ip1').value = updated.button[b].host[0]
                                        get(button_id+b+'-ip2').value = updated.button[b].host[1]
                                        get(button_id+b+'-ip3').value = updated.button[b].host[2]
                                        get(button_id+b+'-ip4').value = updated.button[b].host[3]
                                        get(button_id+b+'-port').value = updated.button[b].port
                                        get(button_id+b+'-address').value = updated.button[b].address
                                        get(button_id+b+'-offset').value = updated.button[b].offset
                                        get(button_id+b+'-status').innerText = ''
                                    }
                                }
                                if (form.submit) {
                                    get(form_stations+'-selector-'+i).innerHTML = `
                                        <td>${updated.name}</td>
                                        <td>${updated.description}</td>
                                    `
                                }
                            }
                        }
                    }
                    return true
                })
            }

    // TAKT FIELDS
            if (permission(form_plc)) {
                get(form_submit_test_takt).addEventListener('click', ()=>{
                    Transport.send(urlSecure, { form: { name: form_test_takt, submit: form_submit_test_takt, fields: getTaktFields(form_plc) } })
                })
                TTEvents.formCallback(form_test_takt, form=>{
                    const fields = form.fields
                    for (var i in fields) get(form_plc+'-'+i).innerHTML = fields[i]
                    return true
                })
            }

            if (permission(form_plc)) {
                get(form_plc_submit).addEventListener('click', ()=>{
                    Transport.send(urlSecure, { form: { name: form_plc, submit: form_plc_submit, fields: getTaktFields(form_plc) } })
                })
                TTEvents.formCallback(form_plc, form=>{
                    const fields = form.fields
                    for (var i in fields.host) get(form_plc+'-ip'+(+i+1)).value = fields.host[i]
                    get(form_plc+'-port').value = fields.port
                    get(form_plc+'-datetime-address').value = fields.address
                    get(form_plc+'-datetime-offset').value = fields.offset
                    get(form_plc+'-datetime-trigger-address').value = fields.trigger_address
                    get(form_plc+'-datetime-trigger-offset').value = fields.trigger_offset
                    for (var f in fields.addresses) {
                        if (get(form_plc+'-'+f)) {
                            get(form_plc+'-'+f).value = fields.addresses[f]
                            //if (f.endsWith('-trigger-address')) get(form_plc+'-'+f).disabled = true
                        }
                    }
                    return true
                })
            }

            function getTaktFields (fname) {
                const fields = {
                    host: [
                        +get(fname+'-ip1').value,
                        +get(fname+'-ip2').value,
                        +get(fname+'-ip3').value,
                        +get(fname+'-ip4').value,
                    ],
                    port: +get(fname+'-port').value,
                    address: get(fname+'-datetime-address').value,
                    offset: +get(fname+'-datetime-offset').value,
                    trigger_address: get(fname+'-datetime-trigger-address').value,
                    trigger_offset: get(fname+'-datetime-trigger-offset').value,
                    addresses: {},
                }
                for (var sh=1; sh<=SHIFTS; sh++) {
                    const ttag = fname+'-'+sh
                    fields.addresses[sh+'-takttime-address'] = get(ttag+'-takttime-address').value
                    fields.addresses[sh+'-takttime-offset'] = get(ttag+'-takttime-offset').value
                    fields.addresses[sh+'-taktremain-address'] = get(ttag+'-taktremain-address').value
                    fields.addresses[sh+'-taktremain-offset'] = get(ttag+'-taktremain-offset').value
                    fields.addresses[sh+'-takt-trigger-address'] = get(ttag+'-takt-trigger-address').value
                    fields.addresses[sh+'-takt-trigger-offset'] = get(ttag+'-takt-trigger-offset').value
                    //fields.addresses[sh+'-shift-trigger-address'] = get(ttag+'-shift-trigger-address').value
                    //fields.addresses[sh+'-shift-trigger-offset'] = get(ttag+'-shift-trigger-offset').value
                    fields.addresses[sh+'-stoppage-trigger-address'] = get(ttag+'-stoppage-trigger-address').value
                    fields.addresses[sh+'-stoppage-trigger-offset'] = get(ttag+'-stoppage-trigger-offset').value
                    fields.addresses[sh+'-shift-address'] = get(ttag+'-shift-address').value
                    fields.addresses[sh+'-shift-start-offset'] = get(ttag+'-shift-start-offset').value
                    fields.addresses[sh+'-shift-end-offset'] = get(ttag+'-shift-end-offset').value
                for (var j=1; j<=STOPPAGES; j++) {
                        const tag = fname+'-'+sh+'-'+j
                        fields.addresses[sh+'-'+j+'-stoppage-address'] = get(tag+'-stoppage-address').value
                        fields.addresses[sh+'-'+j+'-stoppage-start-offset'] = get(tag+'-stoppage-start-offset').value
                        fields.addresses[sh+'-'+j+'-stoppage-end-offset'] = get(tag+'-stoppage-end-offset').value
                    }
                }
                return fields
            }

        //CLOSE CONFIRMATION BUTTON
            function closeConfirmationButton (e) {
                const ele = get(e.currentTarget.id+'-checkbox') || get(e.currentTarget.id+'-confirmation-checkbox')
                if (ele && ele.checked) ele.checked = false
            }

        // RESET BUTTONS
            if (permission(form_scheduler_run)) {
                get('form_submit_scheduler_run').addEventListener('click', (e)=>{
                    Transport.send(urlSecure, { form: { name: 'form_scheduler_run', submit: 'form_submit_scheduler_run', fields: { confirmed: true } } })
                    closeConfirmationButton.call(e.currentTarget, e)
                })
                get('form_submit_scheduler_run'+'-confirmation').addEventListener('mouseleave', closeConfirmationButton)
                TTEvents.formCallback('form_scheduler_run', (form)=>{
                    showErrorBox(form.error)
                })
            }
            if (permission(form_reset_only)) {
                get('form_submit_reset_only').addEventListener('click', (e)=>{
                    Transport.send(urlSecure, { form: { name: 'form_reset_only', submit: 'form_submit_reset_only', fields: { confirmed: true } } })
                    closeConfirmationButton.call(e.currentTarget, e)
                })
                get('form_submit_reset_only'+'-confirmation').addEventListener('mouseleave', closeConfirmationButton)
                TTEvents.formCallback('form_reset_only', (form)=>{
                    showErrorBox(form.error)
                })
            }
            if (permission(form_reset_clear)) {
                get('form_submit_reset_clear').addEventListener('click', (e)=>{
                    Transport.send(urlSecure, { form: { name: 'form_reset_clear', submit: 'form_submit_reset_clear', fields: { confirmed: true } } })
                    closeConfirmationButton.call(e.currentTarget, e)
                })
                get('form_submit_reset_clear'+'-confirmation').addEventListener('mouseleave', closeConfirmationButton)
                TTEvents.formCallback('form_reset_clear', (form)=>{
                    showErrorBox(form.error)
                })
            }
            if (idleTimeout !== undefined) get(name).addEventListener('scroll', setIdleTimeout)
        }
    }
//-----------------------------------------------------------------------------------------------------------
    function showScreen_Shifts () {
        if (!permission('shifts_entry')) return
		
		const name = state.currentScreen = 'screen8',
            form_name = 'shifts_entry',
            form_submit = form_name+'-submit',
            shift_id = form_name+'-shift-',
            form_stops = 'stops_entry',
            form_holiday = 'holiday_entry',
            form_submit_holiday = form_holiday+'-submit',
            form_plan = 'plan_entry',
            form_submit_plan = form_plan+'-submit',
            shift_attributes = `style="width: 64px;"`,
            difference_attributes = `style="flex: 1; font-size:1.2em;"`,
            holiday_attributes = `style="width: 130px; height: 54px;"`,
            stop_attributes = `style="width: 64px;;"`,
            stop2_attributes = `style="width: 48px;"`,
            stop3_attributes = `type="number" min="1" step="1" style="width: 74px;"`,
            stop4_attributes = `style="flex-basis: unset; flex: none; width: auto; margin-top: 8px;"`,
            plan_attributes = `type="number" min="1" step="1" style="width: 72px;"`,
            time_attributes = `type="number" min="1" step="1" style="width: 74px"`,
            shift2_attributes = `style="width: 24px;"`,
            weekdays_attributes = `style="width: 150px;;"`,
            colon = `<div class="bottom-align-text">:</div>`,
            repeat = ['unique','daily','weekly','monthly'],
            stoppage_elements = ['on','name','description','start-hour','start-minute','end-hour','end-minute']

        const //tomorrow = new Date(Date.now() + one_day),
            today = new Date,
            the_year = today.getFullYear(),
            the_month = today.getMonth() + 1,
            the_date = today.getDate()
        state.date_current = the_date
            
        if (get(name)) {
            get(name).classList.remove('screen-hide')
            get(name).classList.add('screen-show')
            
        } else {
            const years = []
            for (var i=2020; i<the_year + 5; i++) years.push(i)

            var shifts = '',
                stoppages = ''
            for (var sh=1; sh<=SHIFTS; sh++) {
                shifts += `
                    ${draw_break()}
                    <div class="field-container background-bbb">
                        ${draw_checkbox(shift_id+sh+'-on', sh, false, shift2_attributes)}
                        <div class="divider-horizontal"></div>
                        ${draw_select(shift_id+sh+'-start-hour', TEXT.field_shift, draw_select_options(hours_24), shift_attributes)}${colon}
                        ${draw_select(shift_id+sh+'-start-minute', '&nbsp;', draw_select_options(minutes_1_interval), shift_attributes)}
                        <div class="divider-horizontal-light"></div>
                        ${draw_select(shift_id+sh+'-end-hour', TEXT.field_end, draw_select_options(hours_24), shift_attributes)}${colon}
                        ${draw_select(shift_id+sh+'-end-minute', '&nbsp;', draw_select_options(minutes_1_interval), shift_attributes)}
                        <div class="divider-horizontal"></div>
                        ${draw_select(shift_id+sh+'-break-start-hour', TEXT.field_break, draw_select_options(hours_24), shift_attributes)}${colon}
                        ${draw_select(shift_id+sh+'-break-start-minute', '&nbsp;', draw_select_options(minutes_1_interval), shift_attributes)}
                        <div class="divider-horizontal-light"></div>
                        ${draw_select(shift_id+sh+'-break-end-hour', TEXT.field_end, draw_select_options(hours_24), shift_attributes)}${colon}
                        ${draw_select(shift_id+sh+'-break-end-minute', '&nbsp;', draw_select_options(minutes_1_interval), shift_attributes)}
                        <div class="divider-horizontal"></div>
                        ${draw_input(shift_id+sh+'-plan', TEXT.field_plan, plan_attributes)}
                        ${draw_input(shift_id+sh+'-takttime', TEXT.field_takttime, time_attributes)}
                    </div>
                    ${draw_break()}
                    <div class="divider"></div>
                `
                stoppages += `
                    <div id=${form_stops+'-'+sh+'-shift-container'} class="field-container background-bbb vertical-margin"></div>
                `
            }

            document.body.append(Object.assign(get(name, 'div'), {
                classList: 'screen max-width',
                innerHTML: `
                    <div class="screen-inlay-top"><img src="images/perkins-logo-large-blue.png"/></div>
                    <h2>${TEXT.menu_shifts}</h2>

                    ${draw_form(form_stops, TEXT.title_events, `
                        ${draw_select_table(form_stops+'-selector', `
                            <div class="field-container unwrap">
                                <input id="${form_stops}-focus" style="position: absolute; width: 0; height: 0; opacity: 0;"/>
                                <label for="${form_stops}-month">${TEXT.title_calendar.toUpperCase()}</label><select id="${form_stops}-month" style="width: 180px;">${ draw_select_options(TEXT.array_months)}</select>
                                <select id="${form_stops}-year" style="width: 110px;">${draw_select_options(years)}</select>
                                <div id="${form_stops}-status" class="inline-block input-container field-status"></div>
                            </div>
                        `, ['','100%'], '400px', 2)}
                        ${draw_break()}
                    `, true)}
                    ${permission(form_name) ? draw_form(form_name, TEXT.title_default_shifts, `
                        ${false ? draw_select(form_name+'-weekdays', TEXT.field_day_of_week.toUpperCase(), draw_select_options(TEXT.array_weekdays), weekdays_attributes) : ''}
                        ${shifts}
                        ${draw_checkbox(form_name+'-apply-m-t', TEXT.phrase_apply_monday_thursday)}
                        ${draw_button(form_submit, 'save-icon.svg', TEXT.button_save, undefined, true)}
                    `, true) : ''}
                    ${draw_break()}
                    <div class="fixed-top">
                        <div id="${form_stops}-stops-subtitle" class="fixed-content"></div>
                    </div>
                    ${draw_break()}
                    <div id="${form_stops}-holidays" class="field-container">
                        <div class="inline-block margin-8px" style="height: auto;">
                            <h3>${TEXT.title_municipal_holiday}</h3>
                        </div>
                        ${draw_checkbox(form_holiday+'-hi', TEXT.phrase_is_holiday, false, holiday_attributes)}
                        ${draw_input(form_holiday+'-hname', TEXT.field_name)}
                        ${draw_button(form_submit_holiday, 'save-icon.svg', TEXT.button_save, undefined, true)}
                    </div>
                    ${draw_break()}
                    <div id="${form_stops}-plans" class="field-container">
                        <div class="inline-block margin-8px" style="height: auto;">
                            <h3>${TEXT.title_production_plan}</h3>
                        </div>
                        <div id="${form_stops+'-plans-list'}" class="inline-block"></div>
                        ${draw_spacer()}
                        ${draw_button(form_submit_plan, 'save-icon.svg', TEXT.button_save, undefined, true)}
                    </div>
                    ${draw_break()}
                    <div id="${form_stops}-stops" class="field-container">
                        <h3>${TEXT.title_shift_extension} / ${TEXT.title_stops}</h3>
                        ${draw_break()}
                        <div id="${form_stops}-container">${stoppages}</div>
                    </div>
                    ${draw_break()}
                `
            }))

            setTimeout(()=>{ get(name).classList.add('screen-show') }, 30)
            
            get(form_stops+'-year').addEventListener('change', selectChange)
            get(form_stops+'-month').addEventListener('change', selectChange)
            window.addEventListener('keydown', selectDateCursor)

            const tbody = get(form_stops+'-selector').children[0],
                header = tbody.rows[0].cells[0].children[0]
            tbody.style.marginTop = header.offsetHeight + 'px'
            header.style.marginTop = -header.offsetHeight + 'px'

            var plan_html = ''
            for (var sh=1; sh<=SHIFTS; sh++) plan_html += draw_input(form_plan+'-'+sh+'-plan', TEXT.field_shift+' '+sh, stop3_attributes)
            get(form_stops+'-plans-list').innerHTML = plan_html

//FORM_HOLIDAY --------------------------------------------------------------------------------------
            get(form_submit_holiday).addEventListener('click', ()=>{
                const fields = {},
                    date = fields[`${state.year_current}-${state.month_current}-${state.date_current}`] = {}
                    var key = +get(form_holiday+'-hname').getAttribute('_id')
                    if (!key) get(form_holiday+'-hname').setAttribute('_id', key = Date.now())
                    date[0] = {
                        hi: !!get(form_holiday+'-hi').checked,
                        h: get(form_holiday+'-hname').value || '',
                        k: key,
                    }
                Transport.send(urlSecure, { form: { name: form_holiday, submit: form_submit_holiday, fields } })
            })
            TTEvents.formCallback(form_holiday, form=>{
                if (form.reload) Transport.send(urlSecure, { form: { name: form_stops, dates: state.year_current + '-' + state.month_current } })
            })

//FORM_PLAN --------------------------------------------------------------------------------------
            get(form_submit_plan).addEventListener('click', ()=>{
                const fields = {},
                    date = fields[`${state.year_current}-${state.month_current}-${state.date_current}`] = {}
                var error_flag
                for (var sh=1; sh<=SHIFTS; sh++) {
                    const tag0 = form_stops+'-'+sh+'-shift'
                    if (!get(tag0+'-startdate')) continue

                    if (get(form_plan+'-'+sh+'-plan').value.length && !(+get(form_plan+'-'+sh+'-plan').value > 0)) {
                        get(form_plan+'-'+sh+'-plan').classList.add('input-error')
                        error_flag = true
                    }
                    else get(form_plan+'-'+sh+'-plan').classList.remove('input-error')

                    date[sh] = { p: +get(form_plan+'-'+sh+'-plan').value || undefined }
                    var key = +get(tag0+'-startdate').getAttribute('_id')
                    if (!key) get(tag0+'-startdate').setAttribute('_id', key = Date.now())
                    date[sh].k = key
                }
                if (!error_flag) Transport.send(urlSecure, { form: { name: form_plan, submit: form_submit_plan, fields } })
                else showErrorBox(TEXT.phrase_value_greater_than_zero)
            })
            TTEvents.formCallback(form_plan, form=>{
                if (form.reload) Transport.send(urlSecure, { form: { name: form_stops, dates: state.year_current + '-' + state.month_current } })
            })

// FORM_STOPPAGES ---------------------------------------------------------------------------------
            function save_shift_times (ext, sh) {
                const fields = {},
                    date = fields[`${state.year_current}-${state.month_current}-${state.date_current}`] = {}
                var new_id = Date.now()
                const tag0 = form_stops+'-'+sh+'-shift'
                if (!get(tag0+'-container')) return
                const stops = date[sh] = {},
                    key0 = (get(tag0+'-startdate') && get(tag0+'-startdate').getAttribute('_id')) || 0
                stops[key0] = { type: 0, unique: true }
                for (var i in stoppage_elements) {
                    const ele = get(tag0+'-'+stoppage_elements[i])
                    if (!ele) continue
                    if (ele.type === 'radio' || ele.type === 'checkbox') { if (ele.selected || ele.checked) stops[key0][stoppage_elements[i]] = true }
                    else stops[key0][stoppage_elements[i]] = ele.value
                }
                const children = get(form_stops+'-'+sh+'-stoppage-container').children
                for (var j=1; j<=children.length; j++) {
                    const tag = form_stops+'-'+sh+'-'+j
                    var not_empty = j <= 1
                    for (var k in stoppage_elements) {
                        if (get(tag+'-'+stoppage_elements[k]) && get(tag+'-'+stoppage_elements[k])[k >= 2 ? 'selectedIndex' : 'value']) { not_empty = true; break }
                    }
                    var startdate,
                        id
                    if (get(tag+'-startdate')) {
                        startdate = +get(tag+'-startdate').value
                        id = get(tag+'-startdate').getAttribute('_id')
                        if (!id) get(tag+'-startdate').setAttribute('_id', id = new_id++)
                    }
                    else id = new_id++
                    if (j <= 1 || (get(tag+'-on').checked && (get(tag+'-name').value.trim() || get(tag+'-description').value.trim()))) {
                        const stoppage = stops[id] = {
                            type: j === 1 ? 1 : 2,
                            on: get(tag+'-on').checked,
                        }
                        for (var i in stoppage_elements) {
                            const stopele = get(tag+'-'+stoppage_elements[i])
                            if (!stopele) continue
                            if (stopele.type === 'radio' || stopele.type === 'checkbox') { if (stopele.selected || stopele.checked) stoppage[stoppage_elements[i]] = true }
                            else stoppage[stoppage_elements[i]] = stopele.value
                        }
                        for (var i in repeat) if (get(tag+'-'+repeat[i]).checked) { stoppage.repeat = +i; break }
                        stoppage.startdate = startdate
                    }
                    else stops[id] = { delete: true }
                }
                if (/*ext.don ||*/ not_empty) Transport.send(urlSecure, { form: { name: form_stops, submit: tag0+'-save', shift: sh, fields: fields } })    
            }
            TTEvents.formCallback(form_stops, form=>{
                const month_view = get(form_stops+'-month').selectedIndex + 1,
                    year_view = +get(form_stops+'-year').value
                if (form.error) showErrorBox(form.error)
                //TODO one-hop?
                else if (form.reload) Transport.send(urlSecure, { form: { name: form_stops, dates: year_view + '-' + month_view, shift: form.shift } })
                else if (form.fields.dates instanceof Object) {
                    //hideErrorBox()
                    if (form.fields.ddom) drawDaysOfMonth(form.fields.year, form.fields.month, form.fields.dates)
                    if (!state.date_current) {
                        get(form_stops+'-status').innerText = ''
                        get(form_stops+'-stops-subtitle').style.display = 'none'
                        get(form_stops+'-holidays').style.display = 'none'
                        get(form_stops+'-plans').style.display = 'none'
                        get(form_stops+'-stops').style.display = 'none'
                        get(form_name).style.display = 'none'
                    }
                    if ( Object.keys(form.fields.dates).length === 1 || (form.fields.year === year_view && form.fields.month === month_view && form.fields.dates[state.date_current])) {
                        const dt = new Date(year_view, month_view - 1, state.date_current || undefined),
                            today = new Date,
                            the_year = today.getFullYear(),
                            the_month = today.getMonth() + 1,
                            the_date = today.getDate(),
                            start_of_date = new Date(the_year, the_month - 1, the_date)
                        /*if (!state.date_current) {
                            get(form_stops+'-status').innerText = ''
                            get(form_stops+'-stops-subtitle').style.display = 'none'
                            get(form_stops+'-holidays').style.display = 'none'
                            get(form_stops+'-plans').style.display = 'none'
                            get(form_stops+'-stops').style.display = 'none'
                            get(form_name).style.display = 'none'
                        }
                        else*/ if (dt.getTime() >= start_of_date.getTime()) { //TODO change to > to prevent sameday editing
                            get(form_stops+'-status').innerText = ''
                            get(form_stops+'-stops-subtitle').style.display = 'inline-block'
                            get(form_stops+'-holidays').style.display = 'flex'
                            get(form_name).style.display = 'block'
                            if (Array.isArray(form.fields.dates[state.date_current])) {
                                if (form.fields.dates[state.date_current].length > 1 && (!form.fields.dates[state.date_current][0] || !form.fields.dates[state.date_current][0].hi)) {
                                    get(form_stops+'-plans').style.display = 'flex'
                                    get(form_stops+'-stops').style.display = 'flex'
                                }
                                else {
                                    get(form_stops+'-plans').style.display = 'none'
                                    get(form_stops+'-stops').style.display = 'none'
                                }
                                get(form_holiday+'-hi').checked = form.fields.dates[state.date_current][0] && !!form.fields.dates[state.date_current][0].hi
                                get(form_holiday+'-hname').value = form.fields.dates[state.date_current][0] ? form.fields.dates[state.date_current][0].h || '' : ''
                                get(form_holiday+'-hname').setAttribute('_id', form.fields.dates[state.date_current][0] ? form.fields.dates[state.date_current][0].k : '')
                            }
                            else {
                                get(form_holiday+'-hi').checked = false
                                get(form_holiday+'-hname').value = ''
                            }
                            updateStoppages(form.fields.dates[state.date_current], form.shift)
                        }
                        else {
                            get(form_stops+'-status').innerText = TEXT.phrase_cannot_edit
                            get(form_stops+'-holidays').style.display = 'none'
                            get(form_stops+'-plans').style.display = 'none'
                            get(form_stops+'-stops').style.display = 'none'
                            get(form_name).style.display = 'none'
                        }
                    }
                }
                //get(form_stops+'-focus').focus()
                return true
            })

            function updateStoppages (shifts, which) {
                if (!shifts) return
                const shs = which || 1,
                    she = which || SHIFTS
                const daily_shifts = []
                for (var sh=shs; sh<=she; sh++) {
                    daily_shifts[sh] = (shifts[sh] && (!which || sh === which)) ? shifts[sh] : [{},{}]
                    const ext = daily_shifts[sh][0] || {},
                        tag0 = form_stops+'-'+sh+'-shift'
                    if (ext.on || ext.c || ext.con) {
                        get(tag0+'-container').style.display = 'block'
                        get('field-highlight-'+form_plan+'-'+sh+'-plan').style.display = 'inline-block'
                    }
                    else {
                        get(tag0+'-container').style.display = 'none'
                        get('field-highlight-'+form_plan+'-'+sh+'-plan').style.display = 'none'
                        continue
                    }
                    unget(get(tag0+'-container')).outerHTML = `
                        <div id=${tag0}-container class="field-container background-bbb vertical-margin">
                            <div class="field-container large-text bold-text gray-text" ${stop4_attributes}>T-${sh}</div>
                            ${draw_checkbox(tag0+'-on', TEXT.field_extension_abbr, false, shift_attributes, true)}
                            ${draw_select(tag0+'-start-hour', TEXT.field_start, draw_select_options(hours_24), shift_attributes)}${colon}
                            ${draw_select(tag0+'-start-minute', '&nbsp;', draw_select_options(minutes_1_interval), shift_attributes)}
                            <div class="divider-horizontal-light"></div>
                            ${draw_select(tag0+'-end-hour', TEXT.field_end, draw_select_options(hours_24), shift_attributes)}${colon}
                            ${draw_select(tag0+'-end-minute', '&nbsp;', draw_select_options(minutes_1_interval), shift_attributes)}
                            <div class="divider-horizontal"></div>
                            ${draw_output(tag0+'-difference', TEXT.field_difference, difference_attributes)}
                            <input id="${tag0+'-startdate'}" type="hidden"/>
                            ${draw_input(tag0+'-description', TEXT.field_description.toUpperCase())}
                            <div id="${form_stops+'-'+sh+'-stoppage-container'}"></div>
                            ${draw_button(tag0+'-save', 'save-icon.svg', TEXT.button_save)}
                        </div>
                    `
                    const difFunc = update_difference.bind(undefined, ext),
                        toggleFunc = toggle_extension.bind(undefined, ext)
                    if (ext.k) get(tag0+'-startdate').setAttribute('_id', ext.k)

                    get(tag0+'-on').addEventListener('change', toggleFunc)
                    get(tag0+'-description').value = ext.d || ''
                    get(tag0+'-start-hour').addEventListener('change', difFunc)
                    get(tag0+'-start-minute').addEventListener('change', difFunc)
                    get(tag0+'-end-hour').addEventListener('change', difFunc)
                    get(tag0+'-end-minute').addEventListener('change', difFunc)
                    
                    get(form_plan+'-'+sh+'-plan').value = ext.p || ''
                    get(form_plan+'-'+sh+'-plan').placeholder = ext.dp || '0'

                    const saveFunc = save_shift_times.bind(undefined, ext, sh)
                    get(tag0+'-save').addEventListener('click', saveFunc)

                    //get(tag0+'-on').disabled = get(tag0+'-description').disabled = get(tag0+'-start-hour').disabled = get(tag0+'-start-minute').disabled = get(tag0+'-end-hour').disabled = get(tag0+'-end-minute').disabled = !ext.don
                    get(tag0+'-on').checked = ext.con || ext.c //&& ext.don
                    //get(tag0+'-start-hour').style.opacity = get(tag0+'-start-minute').style.opacity = get(tag0+'-end-hour').style.opacity = get(tag0+'-end-minute').style.opacity = ext.don ? 1 : 0.7
                    
                    reset_shift_times(ext)

                    for (var j=1, last=daily_shifts[sh].length; j<=last; j++) {
                        get(form_stops+'-'+sh+'-stoppage-container').appendChild(getNewStoppage(sh, j, last))
                        const tagj = form_stops+'-'+sh+'-'+j
                        get('field-highlight-'+tagj+'-start-minute').append(Object.assign(get('indicator-tag-'+tagj+'-start-minute', 'div'), {
                            classList: 'indicator-tag',
                            innerHTML: TEXT.label_next_day,
                        }))
                        const showTag_stoppage = showIndicatorTag.bind(undefined, tagj+'-start', tagj+'-end', 3)
                        get(tagj+'-start-hour').addEventListener('change', showTag_stoppage)
                        get(tagj+'-start-minute').addEventListener('change', showTag_stoppage)
                        get(tagj+'-end-hour').addEventListener('change', showTag_stoppage)
                        get(tagj+'-end-minute').addEventListener('change', showTag_stoppage)
                    }
                    initStoppage(sh)

                    for (var j=1, last=daily_shifts[sh].length-1; j<=last; j++) {
                        var stop = daily_shifts[sh][j]
                        const tag = form_stops+'-'+sh+'-'+j
                        get(tag+'-on').checked = stop.con
                        if (j >= 2) {
                            get(tag+'-startdate').value = stop.sd || ''
                            get(tag+'-description').value = stop.d || ''
                            get(tag+'-'+repeat[stop.r || 0]).checked = true
                            get(tag+'-name').value = stop.n || ''
                        }
                        else {
                        //    const disabled = !ext.on /*&& !ext.don*/
                            get(tag+'-name').value = TEXT.label_break_lunch
                        //    get(tag+'-on').disabled = get(tag+'-name').disabled = get(tag+'-start-hour').disabled = get(tag+'-start-minute').disabled = get(tag+'-end-hour').disabled = get(tag+'-end-minute').disabled = disabled
                        //    get(tag+'-name').style.opacity = get(tag+'-start-hour').style.opacity = get(tag+'-start-minute').style.opacity = get(tag+'-end-hour').style.opacity = get(tag+'-end-minute').style.opacity = disabled ? 0.7 : 1
                        }
                        get(tag+'-startdate').setAttribute('_id', stop.k)
                        if (!stop) stop = {}
                        if (!stop.ds || !stop.de) {
                            stop.ds = [0,0]
                            stop.de = [0,0]
                        }
                        //const off = j === 1 //&& (/*!ext.don ||*/ ext.off)
                        get(tag+'-start-hour').selectedIndex = (stop.s||stop.ds)[0]
                        get(tag+'-start-minute').selectedIndex = (stop.s||stop.ds)[1]
                        get(tag+'-end-hour').selectedIndex = (stop.e||stop.de)[0]
                        get(tag+'-end-minute').selectedIndex = (stop.e||stop.de)[1]

                        get('field-highlight-'+tag+'-start-minute').append(Object.assign(get('indicator-tag-'+tag+'-start-minute', 'div'), {
                            classList: 'indicator-tag',
                            innerHTML: TEXT.label_next_day,
                        }))
                        const showTag_stoppage = showIndicatorTag.bind(undefined, tag+'-start', tag+'-end', 3)
                        get(tag+'-start-hour').addEventListener('change', showTag_stoppage)
                        get(tag+'-start-minute').addEventListener('change', showTag_stoppage)
                        get(tag+'-end-hour').addEventListener('change', showTag_stoppage)
                        get(tag+'-end-minute').addEventListener('change', showTag_stoppage)
                    }
    
                    function reset_shift_times (ext) {
                        if (!ext || ext.c || !(Object.keys(ext).length)) ext = { ds: [0,0], de: [0,0] }
                        get(tag0+'-start-hour').selectedIndex = ext.s ? ext.s[0] : ext.ds[0]
                        get(tag0+'-start-minute').selectedIndex = (ext.s ? ext.s[1] : ext.ds[1])
                        get(tag0+'-end-hour').selectedIndex = ext.e ? ext.e[0] : ext.de[0]
                        get(tag0+'-end-minute').selectedIndex = (ext.e ? ext.e[1] : ext.de[1])
                        update_difference(ext)
                    }

                    function update_difference (ext) {
                        var es = get(tag0+'-start-hour').selectedIndex*60 + (get(tag0+'-start-minute').selectedIndex),
                            ee = get(tag0+'-end-hour').selectedIndex*60 + (get(tag0+'-end-minute').selectedIndex),
                            ds = ext.ds instanceof Object ? ext.ds[0]*60 + ext.ds[1] : 0,
                            de = ext.de instanceof Object ? ext.de[0]*60 + ext.de[1] : 0
                            if (ee < es) ee += 60 * 24
                            if (de < ds) de += 60 * 24
                        const ext_time = ee - es,
                            default_time = de - ds,
                            difference = (ext_time - default_time)
                        get(tag0+'-difference').innerText = get(tag0+'-on').checked
                            ? ext_time ? timerFormat(difference * 60 * 1000) : TEXT.label_cancelled.toUpperCase()
                            : difference ? timerFormat(difference * 60 * 1000) : TEXT.label_default.toUpperCase()
                    }

                    function toggle_extension (ext) {
                        if (!get(tag0+'-on').checked) {
                            if (ext.ds instanceof Object) {
                                get(tag0+'-start-hour').selectedIndex = ext.ds[0]
                                get(tag0+'-start-minute').selectedIndex = ext.ds[1]
                            }
                            if (ext.de instanceof Object) {
                                get(tag0+'-end-hour').selectedIndex = ext.de[0]
                                get(tag0+'-end-minute').selectedIndex = ext.de[1]
                            }
                        }
                        update_difference(ext)
                    }
                }

                function getNewStoppage (sh, j, last) {
                    if (!daily_shifts[sh][j-1]) daily_shifts[sh][j-1] = {}
                    const tag = form_stops+'-'+sh+'-'+j
                    return Object.assign(get(undefined, 'div'), {
                        classList: `flex-container ${j===last ? 'invisible-fade' : ''}`,
                        innerHTML: `
                            ${draw_checkbox(tag+'-on', TEXT.field_on, j === last, stop2_attributes, true)}
                            <div class="field-container background-bbb">
                                ${draw_input(tag+'-name', `${TEXT.field_name} ${j===1 ? `(${TEXT.field_lunch_exception})` : ''} <input id="${tag+'-startdate'}" type="hidden"/>`, undefined, j > 1)}
                                ${draw_select(tag+'-start-hour', TEXT.field_start, draw_select_options(hours_24), stop_attributes)}${colon}
                                ${draw_select(tag+'-start-minute', '&nbsp;', draw_select_options(minutes_1_interval), stop_attributes)}
                                ${draw_select(tag+'-end-hour', TEXT.field_end, draw_select_options(hours_24), stop_attributes)}${colon}
                                ${draw_select(tag+'-end-minute', '&nbsp;', draw_select_options(minutes_1_interval), stop_attributes)}
                                ${draw_break()}
                                ${j === 1 ? '' : draw_input(tag+'-description', TEXT.field_description, undefined)}
                                ${draw_break()}
                                ${draw_radio(tag+'-unique', TEXT.field_unique, true, tag+'-repeat', stop4_attributes, undefined, j !== 1)}
                                ${j === 1 ? '' : draw_radio(tag+'-daily', TEXT.field_daily, false, tag+'-repeat', stop4_attributes)}
                                ${j === 1 ? '' : draw_radio(tag+'-weekly', TEXT.field_weekly, false, tag+'-repeat', stop4_attributes)}
                                ${j === 1 ? '' : draw_radio(tag+'-monthly', TEXT.field_monthly, false, tag+'-repeat', stop4_attributes)}
                            </div>
                        `
                    })
                }

                function initStoppage (sh) {
                    const children = get(form_stops+'-'+sh+'-stoppage-container').children
                    if (!children || !children.length) return
                    const tag = form_stops+'-'+sh+'-'+children.length
                    setTimeout(()=>{
                        if (!children[children.length-1]) return
                        children[children.length-1].style.opacity = 1
                        children[children.length-1].style.transform = 'scale(1)'
                    }, 20)
                    for (var i in stoppage_elements) if (get(tag+'-'+stoppage_elements[i])) get(tag+'-'+stoppage_elements[i]).addEventListener('change', reinitStoppage)
                }

                function reinitStoppage (e) {
                    const parts = e.target.id.split('-'),
                        tag = parts.slice(0, 3).join('-'),
                        sh = +parts[1],
                        j = +parts[2] + 1,
                        last = j
                    //get(tag+'-on').checked = true
                    for (var i in stoppage_elements) if (get(tag+'-'+stoppage_elements[i])) get(tag+'-'+stoppage_elements[i]).removeEventListener('change', reinitStoppage)
                    if (j > 6) return
                    get(form_stops+'-'+sh+'-stoppage-container').appendChild(getNewStoppage(sh, j, last))
                    const tagj = form_stops+'-'+sh+'-'+j
                    get('field-highlight-'+tagj+'-start-minute').append(Object.assign(get('indicator-tag-'+tagj+'-start-minute', 'div'), {
                        classList: 'indicator-tag',
                        innerHTML: TEXT.label_next_day,
                    }))
                    const showTag_stoppage = showIndicatorTag.bind(undefined, tagj+'-start', tagj+'-end', 3)
                    get(tagj+'-start-hour').addEventListener('change', showTag_stoppage)
                    get(tagj+'-start-minute').addEventListener('change', showTag_stoppage)
                    get(tagj+'-end-hour').addEventListener('change', showTag_stoppage)
                    get(tagj+'-end-minute').addEventListener('change', showTag_stoppage)
                    initStoppage(sh)
                }
            }

        // DEFAULT SHIFTS
            for (var sh=1; sh<=SHIFTS; sh++) {
                get('field-highlight-'+shift_id+sh+'-start-minute').append(Object.assign(get('indicator-tag-'+shift_id+sh+'-start-minute', 'div'), {
                    classList: 'indicator-tag',
                    innerHTML: TEXT.label_next_day,
                }))
                const showTag_shift = showIndicatorTag.bind(undefined, shift_id+sh+'-start', shift_id+sh+'-end', 10)
                get(shift_id+sh+'-start-hour').addEventListener('change', showTag_shift)
                get(shift_id+sh+'-start-minute').addEventListener('change', showTag_shift)
                get(shift_id+sh+'-end-hour').addEventListener('change', showTag_shift)
                get(shift_id+sh+'-end-minute').addEventListener('change', showTag_shift)

                get('field-highlight-'+shift_id+sh+'-break-start-minute').append(Object.assign(get('indicator-tag-'+shift_id+sh+'-break-start-minute', 'div'), {
                    classList: 'indicator-tag',
                    innerHTML: TEXT.label_next_day,
                }))
                const showTag_break = showIndicatorTag.bind(undefined, shift_id+sh+'-break-start', shift_id+sh+'-break-end', 3)
                get(shift_id+sh+'-break-start-hour').addEventListener('change', showTag_break)
                get(shift_id+sh+'-break-start-minute').addEventListener('change', showTag_break)
                get(shift_id+sh+'-break-end-hour').addEventListener('change', showTag_break)
                get(shift_id+sh+'-break-end-minute').addEventListener('change', showTag_break)
            }
            
            state.caches[form_name] = {}

            get(form_submit).addEventListener('click', ()=>{
                const fields = { "apply-m-t": get(form_name+'-apply-m-t').checked },
                    fields_dow = fields[state.shifts_dow] = {},
                    times = ['start', 'end', 'break-start', 'break-end']

                var error_flag
                for (var sh=1; sh<=SHIFTS; sh++) {
                    if (!(+get(shift_id+sh+'-plan').value > 0)) {
                        get(shift_id+sh+'-plan').classList.add('input-error')
                        error_flag = true
                    }
                    else get(shift_id+sh+'-plan').classList.remove('input-error')

                    if (!(+get(shift_id+sh+'-takttime').value > 0)) {
                        get(shift_id+sh+'-takttime').classList.add('input-error')
                        error_flag = true
                    }
                    else get(shift_id+sh+'-takttime').classList.remove('input-error')

                    fields_dow[sh] = {
                        on: get(shift_id+sh+'-on').checked,
                        plan: +get(shift_id+sh+'-plan').value,
                        takttime: +get(shift_id+sh+'-takttime').value,
                    }
                    for (var t in times) fields_dow[sh][times[t]] = [
                        +get(shift_id+sh+'-'+times[t]+'-hour').value,
                        +get(shift_id+sh+'-'+times[t]+'-minute').value,
                    ]
                }
                if (!error_flag) Transport.send(urlSecure, { form: { name: form_name, submit: form_submit, fields: fields } })
                else showErrorBox(TEXT.phrase_value_greater_than_zero)
            })
            TTEvents.formCallback(form_name, form=>{
                const fields = form.fields,
                    month_view = get(form_stops+'-month').selectedIndex + 1,
                    year_view = +get(form_stops+'-year').value
                for (var d in fields) {
                    const dow = +d
                    if (isNaN(dow) || !(fields[dow] instanceof Object)) continue
                    const updated = fields[dow]
                    state.caches[form_name][dow] = updated
                    if (Object.keys(fields).length === 1) state.shifts_dow = dow
                    updateShifts(shift_id, updated)
                }
                if (form.reload) Transport.send(urlSecure, { form: { name: form_stops, dates: year_view + '-' + month_view } })
                if (form.corrected) showErrorBox(TEXT.phrase_shift_data_modified, 'orange')
                return true
            })

            function showIndicatorTag (name1, name2, limit, e) {
                const ss = (+get(name1+'-hour').value * 60) + (+get(name1+'-minute').value),
                    se = (+get(name2+'-hour').value * 60) + (+get(name2+'-minute').value),
                    duration = se - ss,
                    ele = get('field-highlight-'+name1+'-minute').children[2]
                var extension = 0
                ele.innerText = ''
                if (duration < 0) {
                    extension = 12 * 60
                    ele.innerHTML = TEXT.label_next_day + '<br/>'
                    ele.classList.add('indicator-tag-show')
                }
                if ((duration + extension) >= limit * 60) {
                    ele.innerText += limit+'+'+TEXT.label_hours
                    ele.classList.add('indicator-tag-show')
                }
                if (!ele.innerHTML) ele.classList.remove('indicator-tag-show')
            }

            function updateShifts (shift_id, updated) {
                if (!(updated instanceof Object)) updated = {}
                get(form_name+'-legend').innerText = `${TEXT.title_default_shifts}: ${TEXT.array_weekdays[state.shifts_dow].toUpperCase()}`
                get(form_name+'-apply-m-t').checked = false
                for (var sh=1; sh<=SHIFTS; sh++) {
                    if (!(updated[sh] instanceof Object) || !updated[sh]['start'] || !updated[sh]['end'] || !updated[sh]['break-start'] || !updated[sh]['break-start'])
                        updated[sh] = { "plan":0, "takttime":0, "start":[0,0], "end":[0,0], "break-start":[0,0], "break-end":[0,0], }
                    get(shift_id+sh+'-on').checked = !!updated[sh]['on']
                    get(shift_id+sh+'-plan').value = updated[sh]['plan']
                    get(shift_id+sh+'-takttime').value = updated[sh]['takttime']
                    get(shift_id+sh+'-takttime').setAttribute('minimum', updated[sh]['taktmin'])

                    get(shift_id+sh+'-start-hour').selectedIndex = updated[sh]['start'][0]
                    get(shift_id+sh+'-start-minute').selectedIndex = updated[sh]['start'][1]
                    get(shift_id+sh+'-end-hour').selectedIndex = updated[sh]['end'][0]
                    get(shift_id+sh+'-end-minute').selectedIndex = updated[sh]['end'][1]
                    showIndicatorTag(shift_id+sh+'-start', shift_id+sh+'-end', 10)
                    
                    get(shift_id+sh+'-break-start-hour').selectedIndex = updated[sh]['break-start'][0]
                    get(shift_id+sh+'-break-start-minute').selectedIndex = updated[sh]['break-start'][1]
                    get(shift_id+sh+'-break-end-hour').selectedIndex = updated[sh]['break-end'][0]
                    get(shift_id+sh+'-break-end-minute').selectedIndex = updated[sh]['break-end'][1]
                    showIndicatorTag(shift_id+sh+'-break-start', shift_id+sh+'-break-end', 3)
                }
            }
            if (idleTimeout !== undefined) get(name).addEventListener('scroll', setIdleTimeout)
        }

        function selectChange (e) {
            get(form_stops+'-focus').focus()
            if (e) state.date_current = 0
            Transport.send(urlSecure, { form: { name: form_stops, dates: +get(form_stops+'-year').value + '-' + (get(form_stops+'-month').selectedIndex + 1) } })
        }
        
        function selectDate (e) {
            get(form_stops+'-focus').focus()
            if (e && e.target) {
                state.year_current = +get(form_stops+'-year').value
                state.month_current = get(form_stops+'-month').selectedIndex + 1
                const selected = select_table_handler(e)
                if (state.date_current === selected) return
                state.date_previous = state.date_current = selected
            }
            selectEither()
        }

        function selectDateCursor (e) {
            if (/*e.repeat ||*/ get(form_stops+'-focus') !== document.activeElement) return
            get(form_stops+'-focus').focus()
            const dir = e.key === 'ArrowUp' ? -1 : (e.key === 'ArrowDown' ? 1 : undefined)
            if (!dir) return
            if (!state.date_current) state.date_current = 1
            const pos = state.date_current + dir
            if (dir > 0 ? pos > get(form_stops+'-selector').rows.length - 1 : pos < 1) return
            const tbody = get(form_stops+'-selector').children[0],
                row = tbody.rows[state.date_current]
            if (!row) return
            row.classList.remove('field-select-table-row-on')
            const new_selected = tbody.rows[state.date_current = pos],
                top = tbody.scrollTop,
                bottom = top + get(form_stops+'-selector').offsetHeight,
                height = new_selected.offsetHeight
            new_selected.classList.add('field-select-table-row-on')
            if (new_selected.offsetTop < (top + (height * 2)) || new_selected.offsetTop > (bottom - (height * 2)))
                tbody.scrollTop = Math.max(0, new_selected.offsetTop - (height * 2))
            if (selectDateCursor.timer) clearTimeout(selectDateCursor.timer)
            selectDateCursor.timer = setTimeout(selectEither, 500)
        }

        function selectEither () {
            if (selectDateCursor.timer) {
                clearTimeout(selectDateCursor.timer)
                delete selectDateCursor.timer
            }
            const today = new Date,
                the_year = today.getFullYear(),
                the_month = today.getMonth() + 1,
                the_date = today.getDate(),
                start_of_date = new Date(the_year, the_month - 1, the_date),
                dt = new Date(state.year_current, state.month_current - 1, state.date_current || undefined),
                dow = pdow(dt.getDay())
            get(form_stops+'-stops-subtitle').innerText = `${TEXT.array_weekdays[dow]}, ${state.date_current} ${TEXT.array_months[state.month_current - 1]}, ${state.year_current}`
            if (dt.getTime() >= start_of_date.getTime()) { // TODO: set to > to prevent sameday changes
                Transport.send(urlSecure, [
                    { form: { name: form_stops, dates: state.year_current + '-' + state.month_current + '-' + state.date_current } },
                    { form: { name: form_name, dow: dow } },
                ])
            }
            else {
                get(form_stops+'-status').innerText = TEXT.phrase_cannot_edit
                get(form_stops+'-holidays').style.display = 'none'
                get(form_stops+'-plans').style.display = 'none'
                get(form_stops+'-stops').style.display = 'none'
                get(form_name).style.display = 'none'
            }
        }
        
        function drawDaysOfMonth (year, month, dates) {
            const today = new Date,
                the_year = today.getFullYear(),
                the_month = today.getMonth() + 1,
                the_date = today.getDate(),
                days_this_month = new Date(year + (month === 12 ?  1 : 0), month === 12 ? 0 : month, 0).getDate(),
                tbody = get(form_stops+'-selector').children[0],
                widths = tbody.rows[0],
                scrollTop = tbody.scrollTop
            tbody.innerText = ''
            tbody.appendChild(widths)
            for (var i=1; i<=days_this_month; i++) {
                const each_date = new Date(year, month - 1, i)
                const dow = pdow(each_date.getDay()),
                    a_date = [
                        `${year}-${month}-${i}`,
                        ` <span class="dow-label">${TEXT.array_weekdays[dow].toUpperCase()}</span>`,
                        `<span class="nowrap">
                            ${pad(i)} ${TEXT.array_months[get(form_stops+'-month').selectedIndex]}<br/>
                            <span class="dow-label">${year}</span>
                        </span>`,
                        summarizeShifts(dates[i], each_date.getDate() < the_date)
                    ]
                draw_select_table_option(form_stops+'-selector', a_date, selectDate)
            }
            if (year === the_year && month === the_month) {
                if (state.date_current) tbody.rows[state.date_current].classList.add('field-select-table-row-on')
                tbody.rows[the_date].classList.add('highlight-day-of-month')
            }
            tbody.scrollTop = month === the_month ? Math.max(0, tbody.rows[state.date_current].offsetTop - tbody.rows[0].offsetTop) : scrollTop
        }

        function summarizeShifts (date_fields, historical) {
            var html = ''
            if (date_fields instanceof Object && Object.keys(date_fields).length) {
                if (!date_fields[0]) date_fields[0] = {}
                if (date_fields[0].hi || date_fields[0].h) html = `<span class="holiday-box-${date_fields[0].hi ? 'closed' : 'open'}">${(date_fields[0].h||TEXT.label_holiday).toUpperCase()}</span>`
                if (!date_fields[0].hi) {
                    for (var sh=1; sh<=SHIFTS; sh++) {
                        if (!date_fields[sh]) date_fields[sh] = []
                        const st = date_fields[sh],
                            st0 = st[0]
                        if (!st0 || (!historical && (st.t <= 1 === (st0.on /*|| !st0.off*/)))) continue
                        if (st0.s && st0.e && !(st0.s[0] + st0.s[1] + st0.e[0] + st0.e[1])) continue
                        const t_start = st0.s || st0.ds
                        if (t_start === undefined) continue
                        const t_s_ms = (t_start[0]*60+t_start[1]) * one_minute_ms,
                            t_end = st0.e || st0.de,
                            t_e_orig_ms = (t_end[0]*60+t_end[1]) * one_minute_ms,
                            t_e_ms = t_e_orig_ms + (t_e_orig_ms < t_s_ms ? one_day_ms : 0)
                        html += `<span class="summary-shift"><span class="no-wrap"><span style="display: inline-block;" class="schedule-shift">T${sh}</span><span class="summary-plan">${st0.p||st0.dp||0}</span><span class="summary-times">${pad(t_start[0])}:${pad(t_start[1])}h&rarr;${pad(t_end[0])}:${pad(t_end[1])}h</span></span> `
                        const sorted = st.slice(1).sort(sort_by_start)
                        var s_prev,
                            e_prev
                        for (var i=0; i<sorted.length; i++) {
                            if (sorted[i].on) {
                                const s = sorted[i].s || sorted[i].ds,
                                    s_ms = (s[0]*60+s[1]) * one_minute_ms,
                                    end = sorted[i].e || sorted[i].de,
                                    end_ms = (end[0]*60+end[1]) * one_minute_ms,
                                    e = end_ms < s_ms ? end_ms + one_day_ms : end_ms,
                                    overlap = t_e_ms < s_ms || s_ms < t_s_ms || t_e_ms < e || e < t_s_ms || (s_prev && (s_ms < e_prev || s_ms < s_prev || e < e_prev || e < s_prev))
                                s_prev = s_ms
                                e_prev = e
                                html += `<span style="display: inline-block;" class="summary-breaktime ${overlap ? 'breaktime-overlap' : ''}">${pad(s[0])}:${pad(s[1])}h &raquo; ${pad(end[0]%24)}:${pad(end[1])}h ${sorted[i].n !== null ? sorted[i].n || '' : TEXT.label_break_lunch}</span> `
                            }
                        }
                        html += `</span>`
                    }
                }
            }
            return html
        }

        function sort_by_start (a, b) {
            return ((a.s||a.ds)[0]*60+(a.s||a.ds)[1]) < ((b.s||b.ds)[0]*60+(b.s||b.ds)[1]) ? -1 : 1
        }
        
        get(form_stops+'-year').value = state.year_current = the_year
        get(form_stops+'-month').selectedIndex = (state.month_current = the_month) - 1
        state.date_previous = state.date_current = the_date
        selectChange()
        selectDate()
    }

// ------------------------------------------------------------
    function showScreen_Welcome () {
        const name = 'screen9',
            form_name = 'welcome',
            get_schedule = 'schedule'
        state.currentScreen = name
        
        if (get(name)) {
            get(name).classList.remove('screen-hide')
            get(name).classList.add('screen-show')
        } else {
            document.body.append(Object.assign(get(name, 'div'), {
                classList: 'screen max-width',
                innerHTML: `
                    <div class="screen-inlay-top"><img src="images/perkins-logo-large-blue.png"/></div>
                    <h2>${TEXT.title_welcome} | <span id="schedule-date-masthead"></span></h2>
                    <div id="schedule-container"></div>
                `
            }))
            setTimeout(()=>{ get(name).classList.add('screen-show') }, 30)

            TTEvents.formCallback(get_schedule, form=>{
                const timeline_start = 5,
                    timeline_shift = timeline_start / 24
                if (form.fields instanceof Object) {
                    const a = form.fields.date_array
                    get(get_schedule+'-date-masthead').innerText = `${TEXT.array_weekdays[a[3]]} - ${TEXT.array_months[a[1]-1]} ${a[2]}, ${a[0]}`
                    unget(get(get_schedule+'-container')).innerHTML = `
                        <div id="schedule-arrow" class="schedule-graph-arrow"><img src="images/arrow-icon.svg" width="100%"/></div>
                        <div id="schedule-grid"></div>
                    `
                    clearTimeout(update_schedule_arrow.timer)
                    update_schedule_arrow(a[2])
                    for (var i=timeline_start; i<24+timeline_start; i++) {
                        get(get_schedule+'-container').appendChild(Object.assign(get(get_schedule+'-grid-'+(i%24), 'div'), {
                            className: 'schedule-grid-mark',
                            innerHTML: `${pad(i%24)}:00h`,
                        }))
                        get(get_schedule+'-grid-'+(i%24)).style.top = ((i - timeline_start) / 24) * 100 + '%'
                    }
                    const ffs0 = form.fields.shift[0] || {}
                    if (ffs0.h) {
                        get(get_schedule+'-container').appendChild(get(get_schedule+'-holiday', 'div'))
                        get(get_schedule+'-holiday').outerHTML = `<div class="holiday-box-${ffs0.hi ? 'closed' : 'open'}">${(ffs0.h||TEXT.label_holiday).toUpperCase()}</div>`
                    }
                    if (Object.keys(form.fields.shift).length) {
                        for (var sh=1; sh<=SHIFTS; sh++) {
                            const st = form.fields.shift[sh]
                            if (!st || !st.start || !st.end) continue
                            get(get_schedule+'-container').appendChild(Object.assign(get(get_schedule+'-shift-'+sh, 'div'), {
                                className: 'schedule-shift',
                                innerHTML: `T${sh}`,
                            }))
                            const shift_start = hour_minute(st.start),
                                shift_end_orig = hour_minute(st.end),
                                shift_end = shift_end_orig + (shift_end_orig < shift_start ? one_day_ms : 0),
                                start = ((shift_start / one_day_ms) - (timeline_shift)) * 100,
                                end = ((shift_end / one_day_ms) - (timeline_shift)) * 100
                            Object.assign(get(get_schedule+'-shift-'+sh).style, {
                                position: 'absolute',
                                top: start + '%',
                                height: end - start + '%'
                            })
                            get(get_schedule+'-container').appendChild(Object.assign(get(get_schedule+'-summary-times-'+sh, 'div'), {
                                className: 'summary-times',
                                innerHTML: `${pad(st.start[0])}:${pad(st.start[1])}h&rarr;${pad(st.end[0])}:${pad(st.end[1])}h`,
                            }))
                            Object.assign(get(get_schedule+'-summary-times-'+sh).style, {
                                position: 'absolute',
                                top: start + '%'
                            })
                            var last_element_bottom = (get(get_schedule+'-summary-times-'+sh).offsetTop + get(get_schedule+'-summary-times-'+sh).offsetHeight) / get(get_schedule+'-container').offsetHeight * 100,
                                last_element_right = get(get_schedule+'-summary-times-'+sh).offsetLeft + get(get_schedule+'-summary-times-'+sh).offsetWidth
                            st.stops.sort(sort_by_break_start)
                            for (var i=0; i<st.stops.length; i++) {
                                if (st.stops[i].on) {
                                    const break_start_orig = hour_minute(st.stops[i]['break-start']),
                                        break_end_orig = hour_minute(st.stops[i]['break-end']),
                                        break_start = break_start_orig + (break_start_orig < shift_start ? one_day_ms : 0),
                                        break_end = break_end_orig + ((break_end_orig < break_start_orig || break_start_orig < shift_start) ? one_day_ms : 0)
                                    if (break_end === break_start) continue
                                    get(get_schedule+'-container').appendChild(Object.assign(get(get_schedule+'-stoppage-'+sh+'-'+(i+1), 'div'), {
                                        className: 'summary-breaktime',
                                        innerHTML: `${pad(st.stops[i]['break-start'][0])}:${pad(st.stops[i]['break-start'][1])}h &raquo; ${pad(st.stops[i]['break-end'][0])}:${pad(st.stops[i]['break-end'][1])}h ${st.stops[i].name !== null ? st.stops[i].name || '' : TEXT.label_break_lunch}`,
                                    }))
                                    const break_start_pc = ((break_start / one_day_ms) - (timeline_shift)) * 100,
                                        break_end_pc = ((break_end / one_day_ms) - (timeline_shift)) * 100
                                    Object.assign(get(get_schedule+'-stoppage-'+sh+'-'+(i+1)).style, {
                                        position: 'absolute',
                                        left: (break_start_pc < (last_element_bottom - 0.1) ? last_element_right : 120) + 'px',
                                        top: break_start_pc + '%',
                                        height: (break_end_pc - break_start_pc) + '%',
                                    })
                                    last_element_bottom = (get(get_schedule+'-stoppage-'+sh+'-'+(i+1)).offsetTop + get(get_schedule+'-stoppage-'+sh+'-'+(i+1)).offsetHeight) / get(get_schedule+'-container').offsetHeight * 100
                                    last_element_right = get(get_schedule+'-stoppage-'+sh+'-'+(i+1)).offsetLeft + get(get_schedule+'-stoppage-'+sh+'-'+(i+1)).offsetWidth
                                }
                            }
                        }
                    }
                    else showErrorBox(TEXT.phrase_no_shifts_in_schedule, 'lightgray', 'black')
                }
                return true
            })
            
            Transport.send(urlSecure, { form: { name: form_name } })
            
            function sort_by_break_start (a, b) {
                return (a['break-start'][0]*60+a['break-start'][1]) < (b['break-start'][0]*60+b['break-start'][1]) ? -1 : 1
            }

            function update_schedule_arrow (date_of_month) {
                clearTimeout(update_schedule_arrow.timer)
                update_schedule_arrow.timer = setTimeout(update_schedule_arrow.bind(undefined, date_of_month), 5000)
                if (!get(get_schedule+'-arrow')) return
                const today = new Date(),
                    dom = today.getDate()
                if (dom === date_of_month) {
                    const start_of_date = new Date(today.getFullYear(), today.getMonth(), dom),
                        now_adjusted = today.getTime() - start_of_date.getTime() - (5 * one_hour_ms)
                    get(get_schedule+'-arrow').style.top = Math.min(1, Math.max(0, now_adjusted / one_day_ms)) * 100 + '%'
                    if (get(get_schedule+'-arrow').style.display !== 'block') get(get_schedule+'-arrow').style.display = 'block'
                }
                else if (get(get_schedule+'-arrow').style.display !== 'none') get(get_schedule+'-arrow').style.display = 'none'
            }
            if (idleTimeout !== undefined) get(name).addEventListener('scroll', setIdleTimeout)
        }
        Transport.send(urlSecure, { form: { name: get_schedule } })
    }
//-------------------------------------------------------------------------------------------------------------
    function hideScreens () {
        //get('menu-icon').classList.remove('menu-icon-inset')
        for (var i=0; i<=10; i++) {
            const ele = get('screen'+i)
            if (ele) {
                get('screen'+i).classList.add('screen-hide')
                get('screen'+i).classList.remove('screen-show')
            }
        }
        if (get('menu-item-select-view')) get('menu-item-select-view').selectedIndex = 0
        get('dashboard-paused').style.display = 'none'
        get('menu-container').classList.add('max-width')
        get('menu-container2').classList.add('max-width')
    }

    function get (id, nodeName) {
        if (nodeName) {
            const ele = document.createElement(nodeName.toUpperCase())
            if (id && typeof id === 'string') element[ele.id = id] = ele
            return ele
        }
        if (id) return (element[id] instanceof Object) ? element[id] : (element[id] = document.getElementById(id))
    }

    function unget (node) {
        if (!(node instanceof HTMLElement)) return
        delete element[node.id]
        if (node.children) for (var i=0, k=node.children.length; i<k; i++) unget(node.children[i])
        return node
    }

    async function checkLoginForm (e) {
        var resolve,
            userInfo = new Promise(res=>setTimeout(resolve = res, 8000))
        Transport.set({
            url: urlSecure,
            handler: TTEvents.consume,
            //callback: isSecure,
            callback: resolve,
            error: showErrorBox,
            //refresh,
            //resolve: resolve,
            uuid: get('username').value,
            secret: get('password').value,
        })
        /*function refresh () {
            const forms = []
            if (get('screen1') || get('screen2')) forms.push({ dashboard: true })
            if (get('screen3')) forms.push({ form: { name: 'reports' } })
            if (get('screen5')) forms.push({ form: { name: 'form_message' } })
            if (get('screen6')) forms.push({ form: { name: 'form_events' } })
            if (get('screen7')) forms.push({ form: { name: 'stations_entry' } })
            if (get('screen8')) forms.push({ form: { name: 'shifts_entry' } }, { form: { name: 'line_entry' } })
            if (get('screen9')) forms.push({ form: { name: 'welcome' } })
            Transport.send(urlSecure, forms)
        }*/
        const theUser = await userInfo
        if (!theUser || theUser === null || !theUser.role) loginError(TEXT.phrase_authentication_not_respond)
        else {
            TTEvents.registerCallback(await userInfo)
            get('loginBoxForm').dispatchEvent(new Event('submit'))
        }
    }
    
    async function loginUIResponse (e) {
        e.preventDefault()
        loginError()
        showErrorBox(TEXT.title_establishing_connection, 'orange')
        const start_func = start_page[TTEvents.getUser('role')]
        if (start_func instanceof Function) start_func()
        else showScreen_Welcome()
        showMenuIcon()
        window.addEventListener('mousemove', setIdleTimeout)
        window.addEventListener('click', setIdleTimeout)
        setIdleTimeout()
        get('loginBox').classList.remove('loginBox-show')
        setTimeout(()=>{
            get('loginBoxForm').style.display = 'block'
            get('password').value = ''
            get('loginBox').classList.add('loginBox-hide')
        }, 500)
        await fetch('/empty.html', {method:'POST'})
        e.target.style.display = 'none'
        window.focus()
    }

    function loginError (text) {
        get('loginError').innerText = text || ''
    }

    function isSecure (result) {
        if (result instanceof Object) {
            hideErrorBox()
            return console.log('CONNECTION SECURE')
        }
        console.log('ERROR:', result)
        loginError('An unknown error occurred while logging in. ' + result)
    }

    function isInsecure (error) {
        if (!error) {
            hideErrorBox()
            return console.log('CONNECTION INSECURE')
        }
        console.log('ERROR:', error)
    }

    function submitOnEnter (ele, button) {
        function enter (button, e) { if (e.keyCode === 13) button.click() }
        const element =  typeof ele === 'string' ? get(ele) : ele
        element.addEventListener('keydown', enter.bind(element, typeof button === 'string' ? get(button) : button))
    }

    function ensureNumber (e) {
        if (e.which !== 8 && e.which !== 9 && (e.which < 48 || e.which > 57)) e.preventDefault()
    }

    function ensureNoSpace (e) {
        if (e.which === 32) e.preventDefault()
    }

    function ensureByteRange (e) {
        const val = +e.target.value
        if (val < 0 || val > 255) e.target.value = 0
    }

    function pad (num) {
        return (''+(num || 0)).padStart(2,'0')
    }

    function timerFormat (timestamp, showSeconds, showMilliseconds) {
        if (isNaN(timestamp)) timestamp = +timestamp || 0
        const sign = Math.sign(timestamp),
            secondsOnly = showMilliseconds ? Math.floor(timestamp / 1000) : Math.ceil(timestamp / 1000)
        timestamp = Math.abs(showMilliseconds ? timestamp : secondsOnly * 1000)
        const milliseconds = showMilliseconds ? timestamp % 1000 : undefined,
            seconds = (showSeconds || showMilliseconds)? secondsOnly % 60 : undefined,
            minutes = Math.floor(timestamp / 60000) % 60
        var hours = Math.floor(timestamp / 3600000)
        if (hours > 99) hours = 0
        var str = hours + ':' + (minutes+'').padStart(2,'0') + (seconds !== undefined ? ':' + (seconds+'').padStart(2,'0') : '') + (milliseconds !== undefined ? ':' + (milliseconds+'').padStart(3,'0') : '')
        return (sign < 0 ? '-' : '') + str
    }

    function dateTimeOnly (timestamp, separator) {
        var date
        return !isNaN(+timestamp)
            ? (date = timestamp instanceof Date
                ? timestamp
                : new Date(+timestamp))
                    ? `${date.getFullYear()}-${(date.getMonth()+1+'').padStart(2,'0')}-${(date.getDate()+'').padStart(2,'0')}` +
                        (separator || ' | ') +
                        `${(date.getHours()+'').padStart(2,'0')}:${(date.getMinutes()+'').padStart(2,'0')}:${(date.getSeconds()+'').padStart(2,'0')}`
                    : ''
            : ''
    }
}