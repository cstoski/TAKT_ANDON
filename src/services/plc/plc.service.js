'use strict';

const EventEmitter = require('events');

class PLCService extends EventEmitter {
  /**
   * @param {object} options
   * @param {object} options.plcLib - require('./plc') (seu módulo atual)
   * @param {object} options.settings - settings.json carregado
   * @param {object} options.stationState - DATA.line[1].station (mapa de estações usado pelo plc.Register)
   * @param {function} [options.logger] - console.log ou seu log
   */
  constructor({ plcLib, settings, stationState, logger }) {
    super();

    this.plcLib = plcLib;
    this.settings = settings;
    this.stationState = stationState;

    this.log = logger || console.log;

    this.client = null;
    this.pollTimer = null;

    // defaults
    this.pollIntervalMs = (settings && settings.PLCpollIntervalMin ? settings.PLCpollIntervalMin * 1000 : 1000);
    this.retryInterval = (settings && settings.PLCRetryInterval) || undefined;
  }

  start() {
    if (!this.settings || !this.settings.PLCOnline) {
      // No seu código atual, quando PLCOnline é false, você pode simular no plcCallback. [1](https://onedrive.live.com?cid=8ADD446E13D8DE63&id=8ADD446E13D8DE63!s3f6d6801a8704121af3c1afc7ba88084)
      this.log('[PLC] PLCOnline=false; PLCService não iniciará conexão real.');
      return;
    }

    if (this.client) return;

    try {
      // No seu index.js atual:
      // PLC_1 = new plc.Register(DATA.line[1].station, settings.PLCRetryInterval, plcCallback, plcReconnectCallback) [1](https://onedrive.live.com?cid=8ADD446E13D8DE63&id=8ADD446E13D8DE63!s3f6d6801a8704121af3c1afc7ba88084)
      this.client = new this.plcLib.Register(
        this.stationState,
        this.retryInterval,
        (err, results) => this.emit('data', { err, results, ts: Date.now() }),
        (host, port) => this.emit('reconnect', { host, port, ts: Date.now() })
      );

      this.log('[PLC] Register inicializado.');
    } catch (err) {
      this.client = null;
      this.emit('error', err);
    }
  }

  /**
   * Faz 1 leitura (read) se houver client
   */
  readOnce() {
    if (!this.client) return;
    try {
      this.client.read();
    } catch (err) {
      this.emit('error', err);
    }
  }

  /**
   * Inicia o polling
   */
  startPolling(intervalMs) {
    const ms = +intervalMs || this.pollIntervalMs;

    this.stopPolling();
    this.pollTimer = setInterval(() => {
      // no seu código atual: PLC_1.read() dentro do pollRun [1](https://onedrive.live.com?cid=8ADD446E13D8DE63&id=8ADD446E13D8DE63!s3f6d6801a8704121af3c1afc7ba88084)
      this.readOnce();
    }, ms);

    this.log(`[PLC] Polling iniciado: ${ms}ms`);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  stop() {
    this.stopPolling();

    if (this.client && typeof this.client.close === 'function') {
      try {
        this.client.close();
      } catch (err) {
        // ignora close crash
      }
    }
    this.client = null;

    this.log('[PLC] Encerrado.');
  }
}

module.exports = PLCService;