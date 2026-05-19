'use strict';

// ===============================
// IMPORTS
// ===============================
const path = require('path');
const fs = require('fs');

const transport = require('./infrastructure/transport/transport3');
const trylist = require('../trylist/trylist');
const plc = require('./infrastructure/plc');

// PLC modular
const createPlcProcessor = require('./services/plc/plc.processor');
const createPlcFacade = require('./services/plc/plc.facade');

// Scheduler modular
const createScheduler = require('./services/scheduler');

// ===============================
// CONSTANTES
// ===============================
const one_second_ms = 1000;
const one_minute_ms = 60000;
const one_hour_ms = 3600000;
const one_day_ms = 86400000;

const SHIFTS = 2;
const STOPPAGES = 6;

// ===============================
// ESTADO GLOBAL CONTROLADO
// ===============================
let settings;
let DATA;
let DB;

// ⚠️ estados que antes eram globais espalhados
const state = {
  start_of_shift: Date.now(),
  ribbon_normal: {},
  ribbon_quality: {}
};

const timers = {};

// ===============================
// BOOTSTRAP
// ===============================
init().catch(console.error);

async function init() {

  // 1. LOAD SETTINGS
  settings = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'settings.json'))
  );

  // 2. LOAD DATA
  DATA = await trylist('perkins', path.join(__dirname, 'logs'));

  if (!DATA.line) DATA.line = { 1: {} };
  if (!DATA.line[1]) DATA.line[1] = {};

  const line = DATA.line[1];

  // garante estrutura mínima
  line.shift = line.shift || {};
  line.shifts = line.shifts || {};

  // 3. TRANSPORT
  transport(settings);

  // ===============================
  // PLC SETUP
  // ===============================
  const plcProcessor = createPlcProcessor({
    settings,
    DATA,
    users: {},
    trylist,
    logDir: path.join(__dirname, 'logs'),
    sendAlert,
    loadDB,
    getDB: () => DB
  });

  const plcFacade = createPlcFacade({
    plcLib: plc,
    settings,
    DATA,
    logger: console,
    sendAlert,
    processor: plcProcessor,
    TEXT: {},

    simulationIntervalMs: settings.PLCsimulateIntervalMs,
    simulationJitterMs: settings.PLCsimulateJitterMs
  });

  plcFacade.start();

  // ===============================
  // SCHEDULER
  // ===============================
  const scheduler = createScheduler({

    settings,
    DATA,
    DB,
    DBQuery: {},
    TEXT: {},

    plcFacade,
    plcLib: plc,

    // transporte
    transport,

    // helpers
    start_of_date,
    pdow,
    hour_minute,
    sort_by_t_then_start,
    sort_by_start,
    checklistItem,
    checklistItemComplete,

    // runtime
    shutdown,
    sendAlert,
    sendReport,
    analyticsReset,
    tallyToggle,
    tallyTime,
    ribbonSet,
    ribbonFill,
    ribbonSum,
    productionRun,

    timers,
    state,

    // constants
    SHIFTS,
    STOPPAGES,
    one_day_ms,
    one_minute_ms,
    one_second_ms,
    one_hour_ms,

    pollRun,
    timerRun,
  });

  scheduler.run();
}

//
// ===============================
// TIMER (PLC TAKT + DASHBOARD)
// ===============================
async function timerRun() {

  clearTimeout(timers.run);
  timers.run = setTimeout(timerRun, one_second_ms / 2);

  const line = DATA.line[1];

  if (!line || !line.shift_active) return;

  const shift = line.shift[line.shift_active];

  transport.broadcastMessage({
    dashboard2: {
      signature: 'E',
      shift: {
        shift: line.shift_active,
        taktremain: shift?.taktremain || 0
      }
    }
  });
}

//
// ===============================
// DB (placeholder)
// ===============================
function loadDB() {
  console.log('[DB] load (placeholder)');
}

//
// ===============================
// ALERT
// ===============================
function sendAlert(obj) {
  console.log('[ALERT]', obj);
}

//
// ===============================
// SHUTDOWN
// ===============================
function shutdown() {

  console.log('SHUTDOWN');

  process.exit(0);
}

//
// ===============================
// HELPERS (os mesmos do seu projeto)
// ===============================
function start_of_date(ts) {
  const d = new Date(ts || Date.now());
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function pdow(day) {
  return day ? day - 1 : 6;
}

function hour_minute(t) {
  if (!t) return 0;
  return (t[0] * 60 + t[1]) * 60000;
}

function sort_by_t_then_start(a, b) {
  return a.t - b.t;
}

function sort_by_start(a, b) {
  return 0;
}

function checklistItem() { return false; }
function checklistItemComplete() {}

function sendReport() {}

// ===============================
// PLACEHOLDERS (mantidos)
// ===============================
function analyticsReset() {}
function tallyToggle() {}
function tallyTime() {}
function ribbonSet() {}
function ribbonFill() {}
function ribbonSum() {}
function productionRun() {}
function pollRun() {}