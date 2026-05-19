//SURA - Source Unified Readable Archive
//by Chris Batt <chris@ti3e.com>
'use strict'

const path = require('path'),
    fs = require('fs'),
    log_ext = 'log',
    one_day = 60 * 60 * 24,
    max_length = 99999,
    bytes_delimiter = 1,
    bytes_seek = 5,
    bytes_id = 13,
    bytes_meta = bytes_seek + bytes_id + bytes_seek + bytes_delimiter,
    record_cache = 1024000 //* 256 //1MB read cache
var location,
    name,
    lastID = 0

module.exports = Sura

function Sura (label, folder) {
    if (!folder) throw new Error('Sura log folder not specified, cannot load events database.')
    location = folder
    name = label.replace(/[\<\>\:"\/\\\|\?\*]/g, '-')
}

Object.assign(Sura.prototype, {

    write: function sura_write (event, immediate) {
        var resolve,
            reject
        const promise = new Promise((res, rej)=>{resolve=res;reject=rej}),
            now_date = new Date,
            now = now_date.getTime(),
            event_str = event instanceof Object ? JSON.stringify(event).replace(/\n/g,'\\n') : event
            if (!event_str) return Promise.reject(new Error('Event was empty.'))
        const event_str_length = event_str.length
        if (event_str.length > max_length) return Promise.reject(new Error('Event could not be written to log, greater than '+max_length))
        lastID = now > lastID ? now : lastID + 1
        const seek_meta = bytes_meta + event_str_length + '',
            seek_meta_pad = '~'.repeat(bytes_seek - seek_meta.length) + seek_meta
        _write(today_filename(now_date), `${seek_meta_pad}${lastID}${event_str}${seek_meta_pad}\n`)
        return immediate ? lastID : promise

        function _write (today, data, error) {
            fs.appendFile(today, data, 'utf8', err=>{
                if (!err) return resolve(lastID)
                if (error || err.code !== 'ENOENT') return reject(err)
                return fs.mkdir(path.dirname(today), { recursive: true }, _write.bind(null, today, data, err))
            })
        }
    },

    query: function sura_query (uql) {
        if (!uql) uql = {}
        if (!(uql instanceof Object)) throw new Error('Invalid UQL object passed to Sura Query.')
        var resolve, reject
        const promise = new Promise((res, rej)=>{resolve=res;reject=rej}),
            now_date = new Date
        switch (uql.start) {
            case 'today': uql.start = start_of_day(now_date); break
            default: uql.start = now_date
        }
        switch (uql.end) {
            case 'now': uql.end = now_date; break
            default: uql.end = start_of_day(uql.start, uql.start === now_date ? undefined : one_day) 
        }
        const start_time = uql.start.getTime(),
            end_time = uql.end.getTime(),
            end_page_timestamp = start_of_day(uql.end).getTime(),
            direction = start_time < end_time,
            buffer = Buffer.from(new Uint8Array(record_cache).buffer),
            results = [],
            buffer_empty = Buffer.from('')
        var file,
            filesize,
            today,
            cursor_page = start_of_day(uql.start),
            cursor_rec,
            buffer_remaining,
            buffer_remaining_length = 0
        collect_page()
        return promise

        function collect_page () {
            const cursor_page_timestamp = cursor_page.getTime()
            if (direction ? cursor_page_timestamp > end_time : cursor_page_timestamp < end_page_timestamp) return resolve (results)
            //console.log('Collecting', cursor_page.toISOString())
            if (uql.inclusive) {
                if (direction) {
                    if (end_time < start_of_day(uql.end, one_day).getTime()) return resolve(results)
                } else {
                    if (start_of_day(uql.end, one_day).getTime() < end_time) return resolve(results)
                }
            } else {
                if (direction) {
                    if (end_time < cursor_page_timestamp) return resolve(results)
                } else {
                    if (cursor_page_timestamp + one_day < end_time) return resolve(results)
                }
            }
            today = today_filename(cursor_page)
            cursor_page = new Date(cursor_page_timestamp + (direction ? one_day : -one_day))
            buffer_remaining = buffer_empty
            buffer_remaining_length = 0
            fs.stat(today, (err3, stats)=>{
                if (err3 || !(filesize = stats.size)) return collect_page()
                fs.open(today, 'r', (error, fd)=>{
                    if (error) {
                        if (error.code === '') return collect_page()
                        else return reject(error)
                    }
                    file = fd
                    cursor_rec = direction ? 0 : filesize - record_cache
                    return collect_records()
                })
            })
        }

        function collect_records () {
            if (results.length >= uql.limit) return resolve(results)
            if (direction ? cursor_rec >= filesize : cursor_rec < -record_cache) return collect_page()
            var before = Math.min(bytes_seek, buffer_remaining_length)
            fs.read(file, buffer, 0, record_cache - (cursor_rec < 0 ? -cursor_rec : 0), Math.max(0, cursor_rec), (err, bytesRead, buffer)=>{
                if (err) return collect_page()
                var cursor_buffer = direction ? 0 : bytesRead
                while (1) {
                    const seek_span = +(direction 
                            ? (before ? buffer_remaining.subarray(0, before).toString() : '')
                                + (before < bytes_seek ? buffer.subarray(cursor_buffer, cursor_buffer + (bytes_seek - before)).toString() : '')
                            : (before < bytes_seek ? buffer.subarray(cursor_buffer - (bytes_seek - before), cursor_buffer) : '')
                                + (before ? buffer_remaining.subarray(buffer_remaining_length - before, buffer_remaining_length).toString() : '')
                        ).replace(/~/g, '')
                    if (!seek_span || seek_span > (direction ? bytesRead - cursor_buffer : cursor_buffer)) break
                    const record = (direction
                            ? (buffer_remaining_length > bytes_seek ? buffer_remaining.subarray(bytes_seek, buffer_remaining_length).toString() : '')
                                + buffer.subarray(cursor_buffer + (bytes_seek - before), cursor_buffer - buffer_remaining_length + seek_span - bytes_seek - bytes_delimiter).toString()
                            : buffer.subarray(cursor_buffer - seek_span + buffer_remaining_length + bytes_seek, cursor_buffer - ((buffer_remaining_length > bytes_seek + bytes_delimiter) ? 0 : bytes_seek + bytes_delimiter)).toString()
                                + ((buffer_remaining_length > bytes_seek + bytes_delimiter) ? buffer_remaining.subarray(0, buffer_remaining_length - bytes_seek - bytes_delimiter).toString() : '')
                        )
                    if (direction) results.push(record); else results.unshift(record)
                    cursor_buffer += (direction ? 1 : -1) * (seek_span - buffer_remaining_length)
                    buffer_remaining = buffer_empty
                    buffer_remaining_length = 0
                    before = 0
                }
                buffer_remaining = Buffer.from(direction ? buffer.subarray(cursor_buffer, bytesRead) : buffer.subarray(0, cursor_buffer))
                buffer_remaining_length = buffer_remaining.length
                cursor_rec += direction ? bytesRead : -record_cache
                return collect_records()
            })
        }
    },

})

function start_of_day (the_date, shift) {
    var timestamp
    if (!(the_date instanceof Date)) {
        timestamp = the_date
        if (!shift) the_date = new Date(the_date)
    } else timestamp = the_date.getTime()
    if (shift) {
        timestamp += shift
        the_date = new Date(timestamp)
    }
    const year = the_date.getFullYear(),
        month = the_date.getMonth() + 1,
        date = the_date.getDate(),
        date_of = new Date(`${year}/${month}/${date}`)
    return date_of
}

function today_filename (the_date) {
    if (!the_date instanceof Date) the_date = new Date
    const year = the_date.getFullYear(),
        month = the_date.getMonth() + 1,
        month_pad = (''+month).padStart(2,'0'),
        date_pad = (''+the_date.getDate()).padStart(2,'0')
        return path.join(location, ''+year, month_pad, /*date_pad,*/ `${year}-${month_pad}-${date_pad}-${name}.${log_ext}`)
}
