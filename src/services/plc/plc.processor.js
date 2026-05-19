'use strict';

/**
 * PLC Processor (negócio)
 * =======================
 * Migrado do antigo `plcCallback` do index.js.
 * Agora este módulo recebe tudo via injeção de dependências (ctx), evitando globais.
 *
 * Assinatura retornada: async (error_plc, results) => void
 */

module.exports = function createPlcProcessor(ctx) {
  if (!ctx) throw new Error('createPlcProcessor(ctx): ctx é obrigatório');

  const {
    settings,
    DATA,
    TEXT,
    users = {},
    trylist,
    logDir,
    sendAlert,
    loadDB,
    getDB,
    // Permite sobrescrever códigos do PLC (mantém defaults do seu projeto)
    CALLING = 2,
    ATTENDING = 3,
    CLEAR = 1,
    // logger opcional
    logger = console,
  } = ctx;

  if (!settings) throw new Error('PLC Processor: ctx.settings é obrigatório');
  if (!DATA) throw new Error('PLC Processor: ctx.DATA é obrigatório');
  if (!TEXT) throw new Error('PLC Processor: ctx.TEXT é obrigatório');
  if (!trylist) throw new Error('PLC Processor: ctx.trylist é obrigatório');
  if (!logDir) throw new Error('PLC Processor: ctx.logDir é obrigatório');
  if (typeof sendAlert !== 'function') throw new Error('PLC Processor: ctx.sendAlert deve ser função');
  if (typeof loadDB !== 'function') throw new Error('PLC Processor: ctx.loadDB deve ser função');
  if (typeof getDB !== 'function') throw new Error('PLC Processor: ctx.getDB deve ser função');

  // Estado interno que antes era global no index.js
  let firstRun = true;

  // Helper para garantir DB (mantém a mesma intenção do seu código original)
  function ensureDB() {
    let DB = getDB();
    if (!DB) {
      try { loadDB(); } catch (_) {}
      DB = getDB();
    }
    return DB;
  }

  return async function plcCallback(error_plc, results) {
    // DB pode ser recriado em runtime, então re-hidrata sempre
    let DB = ensureDB();

 
    const flag = {},
        station = {},
        line = DATA.line[1],
        stations = line.station,
        refresh = firstRun,
        timestamp = Date.now()

    firstRun = false

    var bad_flags = '',
        some_results = !!results
    if (!some_results) {
        bad_flags = 'GERAL'
        results = {}
    }
    if (error_plc) {
        for (var s in line.station.$) for (var b=0; b<=2; b++) {
            const bad_result = typeof results[`S${s}B${b}`] === 'string'
            if (!some_results || bad_result) results[`S${s}B${b}`] = 0
            if (some_results && bad_result) bad_flags += `${stations[s].name._}[${TEXT.button_colors[b]}], `
        }
        if (some_results && bad_flags) {
            if (settings.logging) console.log('A *PLC error occured', error_plc)
            sendAlert({ subject: TEXT.PLC_ERROR, text: `${TEXT.PLC_READ_ERROR}\n\nstations: ${bad_flags}` })
        }
    }
    else if (!settings.PLCOnline) {
        if (refresh) for (var s in line.station.$) for (var b=0; b<=2; b++) {
            results[`S${s}B${b}`] = 1
            stations[s]['#button'][b].last_good_read = timestamp
        }
        else {
            const which_s = Math.ceil(Math.random() * 14),
                which_b = Math.floor(Math.random() * (line.station[which_s].button[2].value._ > 1 ? 3 : 2.03)),
                inc = +stations[which_s].button[which_b].value._ + 1
            results[`S${which_s}B${which_b}`] = (inc > ATTENDING) ? CLEAR : inc
            stations[which_s]['#button'][which_b].last_good_read = timestamp
        }
    }
    else if (!some_results) {
        for (var s in line.station.$) for (var b=0; b<=2; b++) results[`S${s}B${b}`] = 1
    }

    for (var label in results) {
        if (!DB) { loadDB(); DB = getDB(); }
        if (!DB) break
        const match = label.match(/\S([0-9]+)B([0-9]+)/)
        if (!match) continue
        match[1] = +match[1]
        match[2] = +match[2]
        const station = stations[match[1]]
        const button = station && station.button[match[2]]
        const current_value = button && button.value._
        const new_value = results[label]
        const has_changed = new_value !== current_value
        if (has_changed) {
            const now = Date.now()
            const diff_time = now - (station['#button'][match[2]].last_good_read || 0)
            if (diff_time > (settings.PLCCallbackDebounce || 5000)) {
                flag[label] = [current_value, new_value]
                station['#button'][match[2]].last_good_read = now
            }
        }
    }

    if (Object.keys(flag).length > 0) {
        const user = users[global.current_user] || {}
        for (var label in flag) {
            const match = label.match(/\S([0-9]+)B([0-9]+)/)
            const station = stations[match[1]]
            const button = station.button[match[2]]
            const [from, to] = flag[label]
            button.value._ = to
            const data = { button: match[2], station: match[1], from, to, user: global.current_user }
            const obj = { line: 1, type: 1, version: 1, status: button.value._, station: match[1], button: match[2], line_station: `${match[1]}_${match[2]}` }
            trylist.updateOrCreate('perkins-plc-events', logDir, obj, data, () => {})
        }
    }

  };
};
