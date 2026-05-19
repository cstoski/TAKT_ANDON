function handleException (e) { const errormsg = e instanceof Object ? JSON.stringify(e.message) : e; console.error(errormsg); process.send('REPORT: ' + errormsg); process.exit(1) }
function handleExceptionMessage(error) { handleException(JSON.stringify({ message: error.message, stack: error.stack }, null, 2)) }
process.on('uncaughtException', handleException)
process.on('unhandledRejection', handleException)

const fs = require('fs'),
    nodemailer = require('nodemailer'),
    sharkpool = require('./sharkpool'),
    xlsx = require('xlsx-populate'),
    one_min_ms = 60000,
    //SELECT_EVENTS = `SELECT * FROM events WHERE t=? AND ((r>? AND r<?) OR (id>? AND id<?)) GROUP BY r ORDER BY id DESC`,
    //SELECT_EVENTS = `SELECT a.id, a.r, t, v, st, l, w, b, s, j, u FROM events a INNER JOIN (SELECT r, MAX(id) id FROM events WHERE t=3 AND ((r>=? AND r<?) OR (id>=? AND id<?)) GROUP BY r ORDER BY r ASC) b ON a.id=b.id`,
    //SELECT_EVENTS_REPORT = `SELECT a.id, a.r, t, v, st, l, w, b, s, j, u FROM events a INNER JOIN (SELECT r, MAX(id) id FROM events WHERE t=? AND ((r>=? AND r<?) OR (id>=? AND id<?)) GROUP BY r) b ON a.id=b.id LIMIT ${message.database.eventQueryLimit + 1}`
    //SELECT_EVENTS_REPORT = `SELECT a.id, a.r, t, v, st, l, w, b, s, j, u FROM events a INNER JOIN (SELECT r, MAX(id) id FROM events WHERE t=? AND ((r>=? AND r<?) OR (id>=? AND id<?)) GROUP BY r) b ON a.id=b.id`
    SELECT_EVENTS_REPORT = `SELECT a.id, a.r, t, v, st, l, w, b, s, j, u FROM events a INNER JOIN (SELECT r, MAX(id) id FROM events WHERE t=? AND r>=? AND r<? GROUP BY r) b ON a.id=b.id`
    SELECT_HISTORY = `SELECT * FROM history WHERE timestamp>=? AND timestamp<? ORDER BY timestamp ASC`,
    SELECT_PIECES = `SELECT * FROM pieces WHERE timestamp_produced>=? AND timestamp_produced<? AND accepted>0 ORDER BY timestamp_produced ASC`

process.on('message', async message => {

    var REPORTS
    try { REPORTS = JSON.parse(fs.readFileSync('report.json', 'utf8')) } catch (e) {}
    if (!(REPORTS instanceof Object)) handleException('COULD NOT LOAD REPORT SETTINGS from report.json')

    const DB = sharkpool.createPool({
            "executeTimeout": message.database.executeTimeout,
            "maxConnections": 2,
            "warmConnections": true,
            "server": {
                host: message.database.server.host,
                port:message.database.server.port,
                database: message.database.server.database,
                user: message.database.server.user,
                password: message.database.server.password,
            }
        })
    if (!(DB instanceof Object)) handleException('COULD NOT CONNECT TO DATABASE: '+message.database.server.database+':'+(message.database.server.port||'3306'))

    const dps = new Date(message.params.start),
        dpe = new Date(message.params.end),
        report_datestring = `${dps.getFullYear()}/${(''+(dps.getMonth()+1)).padStart(2,'0')}/${(''+dps.getDate()).padStart(2,'0')} [${(''+dps.getHours()).padStart(2,'0')}_${(''+dps.getMinutes()).padStart(2,'0')}] - ${dpe.getFullYear()}/${(''+(dpe.getMonth()+1)).padStart(2,'0')}/${(''+dpe.getDate()).padStart(2,'0')} [${(''+dpe.getHours()).padStart(2,'0')}_${(''+dpe.getMinutes()).padStart(2,'0')}]`,
        filename_datestring = `${dps.getFullYear()}-${(''+(dps.getMonth()+1)).padStart(2,'0')}-${(''+dps.getDate()).padStart(2,'0')}_${(''+dps.getHours()).padStart(2,'0')}-${(''+dps.getMinutes()).padStart(2,'0')}-${dpe.getFullYear()}-${(''+(dpe.getMonth()+1)).padStart(2,'0')}-${(''+dpe.getDate()).padStart(2,'0')}_${(''+dpe.getHours()).padStart(2,'0')}-${(''+dpe.getMinutes()).padStart(2,'0')}`,
        filename_tag = Buffer.from(''+Math.random()).toString('base64'),
        filename = `${filename_datestring}-${Date.now()}`,
        //filename = ''+Date.now(),
        link_url = `${message.settings.serverAddress}/reports/${filename}.xlsm?${filename_tag}`,
        //file_location = `./reports/archive/${filename}-${filename_tag}.xlsm`
        file_location = `./reports/archive/${filename}-${filename_tag}.xlsm`
			
    //process.send('OPENING TEMPLATE WORKBOOK...')
    xlsx.fromFileAsync('./reports/' + REPORTS.template)
    .then(async (workbook) => {
        workbook.sheet(REPORTS.DATESTAMP.sheet).cell(REPORTS.DATESTAMP['column'] + (REPORTS.DATESTAMP['row']))
            .value('Período: ' + report_datestring)
        //process.send('DONE')
        const [error, events_results, info] = await DB.execute(SELECT_EVENTS_REPORT, [3, message.params.start, message.params.end])
        //console.log('EVENTS_REPORT: ', events_results.queueDuration, events_results.queryDuration)
        if (error) handleException('SELECT_EVENTS_REPORT - '+JSON.stringify({ message: error.message, stack: error.stack }, null, 2))
        else {
            //console.log('Events results count:' + events_results.length)
            for (var i=0, j=events_results.length; i<j; i++) {
                const j = JSON.parse(events_results[i].j),
                    datetime_start = new Date(events_results[i].r),
                    datetime_start_formatted = `${datetime_start.getFullYear()}/${(datetime_start.getMonth()+1+'').padStart(2,'0')}/${(datetime_start.getDate()+'').padStart(2,'0')} ${(datetime_start.getHours()+'').padStart(2,'0')}:${(datetime_start.getMinutes()+'').padStart(2,'0')}:${(datetime_start.getSeconds()+'').padStart(2,'0')}`,
                    datetime_end = j.end ? new Date(j.end) : undefined,
                    datetime_end_formatted = datetime_end ? `${datetime_end.getFullYear()}/${(datetime_end.getMonth()+1+'').padStart(2,'0')}/${(datetime_end.getDate()+'').padStart(2,'0')} ${(datetime_end.getHours()+'').padStart(2,'0')}:${(datetime_end.getMinutes()+'').padStart(2,'0')}:${(datetime_end.getSeconds()+'').padStart(2,'0')}` : ''
                if (!j.code) {
                    console.log('NO CODE')
                    continue
                }
                workbook.sheet(REPORTS.RANGE.events.sheet).cell(REPORTS.RANGE.events['column-start'] + (REPORTS.RANGE.events['row-start'] + i))
                .value([[
                    j.code,
                    datetime_start_formatted,
                    datetime_end_formatted,
                    j.line,
                    j.shift,
                    message.stations[j.station],
                    j.code[0],
                    j.zwait ? +(j.zwait / one_min_ms).toFixed(1) : '-',
                    j.hold ? +(j.hold / one_min_ms).toFixed(1) : '-',
                    j.end ? +((j.end - events_results[i].r) / one_min_ms).toFixed(1) : '-',
                    j.desc,
                    j.q,
                    j.grp,
                    j.purp,
                    REPORTS.status_code[events_results[i].st],
                    j.act,
                    j.obs,
                ]])
            }
            //process.send("Processed Workbook: EVENTS")
        }

        //SELECT_HISTORY = `SELECT * FROM history WHERE timestamp>=? AND timestamp<? ORDER BY timestamp ASC`,
        const [error2, history_results, info2] = await DB.execute(SELECT_HISTORY, [message.params.start, message.params.end])
        //console.log('HISTORY_REPORT: ', history_results.queueDuration, history_results.queryDuration)
        if (error2) handleException('SELECT_HISTORY - '+JSON.stringify({ message: error2.message, stack: error2.stack }, null, 2))
        else {
            for (var i=0, j=history_results.length; i<j; i++) {
                const datetime = new Date(history_results[i].timestamp),
                    datetime_formatted = `${datetime.getFullYear()}/${(datetime.getMonth()+1+'').padStart(2,'0')}/${(datetime.getDate()+'').padStart(2,'0')} ${(datetime.getHours()+'').padStart(2,'0')}:${(datetime.getMinutes()+'').padStart(2,'0')}:${(datetime.getSeconds()+'').padStart(2,'0')}`
                workbook.sheet(REPORTS.RANGE.history.sheet).cell(REPORTS.RANGE.history['column-start'] + (REPORTS.RANGE.history['row-start'] + i))
                .value([[
                    datetime_formatted,
                    history_results[i].line,
                    history_results[i].shift,
                    Math.floor(history_results[i].plan_duration / one_min_ms),
                    Math.floor(history_results[i].plan_breaks / one_min_ms),
                    Math.floor(history_results[i].plan_runtime / one_min_ms),
                    +(history_results[i].stoptime / one_min_ms).toFixed(1),
                    +(history_results[i].runtime / one_min_ms).toFixed(1),
                    history_results[i].plan,
                    history_results[i].produced,
                    +(history_results[i].ideal).toFixed(1),
                    history_results[i].rejected,
                    +(history_results[i].performance * 100).toFixed(1),
                    +(history_results[i].availability * 100).toFixed(1),
                    +(history_results[i].quality * 100).toFixed(1),
                    +(history_results[i].oee * 100).toFixed(1),
                    +(history_results[i].stoptime_quality / one_min_ms).toFixed(1),
                    +(history_results[i].stoptime_normal / one_min_ms).toFixed(1),
                ]])
            }
            //process.send("Processed Workbook: HISTORY")
        }

        //SELECT_PIECES = `SELECT * FROM pieces WHERE timestamp_produced>=? AND timestamp_produced<? AND accepted>0 ORDER BY timestamp_produced ASC`
        const [error3, pieces_results, info3] = await DB.execute(SELECT_PIECES, [message.params.start, message.params.end])
        //console.log('PIECES_REPORT: ', pieces_results.queueDuration, pieces_results.queryDuration)
        if (error3) handleException('SELECT_PIECES - '+JSON.stringify({ message: error3.message, stack: error3.stack }, null, 2))
        else {
            for (var i=0, j=pieces_results.length; i<j; i++) {
                const datetime = new Date(pieces_results[i].timestamp),
                    datetime_formatted = `${datetime.getFullYear()}/${(datetime.getMonth()+1+'').padStart(2,'0')}/${(datetime.getDate()+'').padStart(2,'0')} ${(datetime.getHours()+'').padStart(2,'0')}:${(datetime.getMinutes()+'').padStart(2,'0')}:${(datetime.getSeconds()+'').padStart(2,'0')}`
                
                workbook.sheet(REPORTS.RANGE.pieces.sheet).cell(REPORTS.RANGE.pieces['column-start'] + (REPORTS.RANGE.pieces['row-start'] + i))
                .value([[
                    datetime_formatted,
                    pieces_results[i].serial,
                    pieces_results[i].model,
                    pieces_results[i].rejected||0,
                ]])
            }
            //process.send("Processed Workbook: PIECES")
        }

        workbook.outputAsync()
        .then(async data => {
            const error = fs.writeFileSync(file_location, data, { encoding: 'binary' })
            if (error) handleException('Could not write Report file to archive')

            const SMTP = nodemailer.createTransport({
                    pool: false,
                    host: message.smtp.host,
                    port: message.smtp.port,
                    secure: message.smtp.secure,
                    auth: {
                        user: message.smtp.auth.user,
                        pass: message.smtp.auth.pass,
                    },
                    tls: {
                        rejectUnauthorized: false
                    }
                },
                message.mail
                )
            if (!(SMTP instanceof Object)) handleException('COULD NOT CONNECT TO SMTP SERVER (MAILER): '+message.smtp.host+':'+message.smtp.port)
        
            SMTP.sendPromise = (obj)=>{
                var resolve
                const promise = new Promise((res,rej)=>{ resolve = res })
                setTimeout(()=>{ resolve('SMTP TIMEOUT') }, message.settings.SMTPTimeout)
                SMTP.sendMail(obj, resolve)
                return promise
            }
            const error2 = await SMTP.sendPromise({
                    from: message.mail.from,
                    replyTo: message.mail.replyTo,
                    to: message.mail.to,
                    subject: `[TaktTime] Relatório de Produção - Linha LMF - ${report_datestring}`,
                    text: `
                        RELATÓRIO ANDON
                        Linha: 1 - LMF
                        Turno: ${message.params.shift}
                        Data/Hora Inicio: ${new Date(message.params.start).toLocaleString()}
                        Data/Hora Fim: ${new Date(message.params.end).toLocaleString()}
                    `,
                    attachments: [{
                        filename: filename + '.xlsm',
                        path: file_location,
                    }],
                })
            if (error2) handleException('ERROR SENDING REPORT EMAILS: ' + error2.toString())
            else process.send({ status: 'COMPLETE' })
            
            process.send({
                final: true,
                download: message.params.download,
                events: events_results.length,
                history: history_results.length,
                pieces: pieces_results.length,
                filename: message.params.download ? file_location : undefined,
                link: link_url,
            })
        })
        .catch(handleExceptionMessage)
    })
    .catch(handleExceptionMessage)
})

process.send({ status: 'LOADED' })
