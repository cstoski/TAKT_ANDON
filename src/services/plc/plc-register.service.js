'use strict';

const EventEmitter = require('events');

class PLCRegisterService extends EventEmitter {
  constructor({ plcLib, settings, stationState, logger }) {
    super();
    this.plcLib = plcLib;
    this.settings = settings;
    this.stationState = stationState;
    this.log = logger || console.log;

    this.client = null;
    this.timer = null;
  }

  start() {
    if (!this.settings?.PLCOnline) {
      this.log('[PLC_REGISTER] PLCOnline=false; não conecta no PLC real.');
      return;
    }
    if (this.client) return;

    try {
      this.client = new this.plcLib.Register(
        this.stationState,
        this.settings.PLCRetryInterval,
        (err, results) => this.emit('data', { err, results, ts: Date.now() }),
        (host, port) => this.emit('reconnect', { host, port, ts: Date.now() })
      );
      this.log('[PLC_REGISTER] inicializado.');
    } catch (e) {
      this.client = null;
      this.emit('error', e);
    }
  }

  readOnce() {
    if (!this.client) return;
    try { this.client.read(); }
    catch (e) { this.emit('error', e); }
  }

  startPolling(intervalMs) {
    const ms = Number(intervalMs) || (this.settings?.PLCpollIntervalMin ? this.settings.PLCpollIntervalMin * 1000 : 1000);

    this.stopPolling();
    this.timer = setInterval(() => this.readOnce(), ms);
    this.log(`[PLC_REGISTER] polling ${ms}ms`);
  }

  stopPolling() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  stop() {
    this.stopPolling();
    try { this.client?.close?.(); } catch (_) {}
    this.client = null;
    this.log('[PLC_REGISTER] parado.');
  }
}

module.exports = PLCRegisterService;
``