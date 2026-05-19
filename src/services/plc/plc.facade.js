'use strict';

const EventEmitter = require('events');

/**
 * PLC Facade
 * ==========
 * Orquestra:
 * - Register (PLC_1): leitura cíclica + callbacks
 * - Takt (PLC_takt): grava agenda (setTakt) quando rescheduling
 * - TaktTime (PLC_takttime): leitura taktremain (getTaktTime)
 *
 * Integração com processor:
 * - register emite {err, results} => chama processor(err, results)
 *
 * Simulação:
 * - quando settings.PLCOnline === false:
 *   chama processor(undefined, undefined) imediatamente + em intervalo fixo
 *   e o processor entra no ramo de simulação (mantém comportamento do plcCallback original). [1](blob:https://www.microsoft365.com/092829dc-1ca6-45b2-adef-0d5252fb34b7)[2](https://onedrive.live.com?cid=8ADD446E13D8DE63&id=8ADD446E13D8DE63!s3f6d6801a8704121af3c1afc7ba88084)
 */
module.exports = function createPLCFacade({
  plcLib,
  settings,
  DATA,
  logger,
  sendAlert,
  processor,
  TEXT,                 // opcional (mensagens)
  simulationIntervalMs, // ✅ NOVO: opcional para customizar taxa de simulação
  simulationJitterMs,   // ✅ NOVO: opcional para jitter (anti “batida” sincronizada)
}) {
  if (!plcLib) throw new Error('plc.facade: plcLib é obrigatório');
  if (!settings) throw new Error('plc.facade: settings é obrigatório');
  if (!DATA) throw new Error('plc.facade: DATA é obrigatório');
  if (typeof processor !== 'function') throw new Error('plc.facade: processor deve ser função');

  const log = logger || console;

  const line = DATA.line && DATA.line[1] ? DATA.line[1] : null;
  if (!line) throw new Error('plc.facade: DATA.line[1] não encontrado');

  // -----------------------------
  // Helpers de alerta (opcional)
  // -----------------------------
  const PLC_ERROR_SUBJECT = (TEXT && TEXT.PLC_ERROR) || 'PLC ERROR';
  function alert(text) {
    if (typeof sendAlert === 'function') {
      try { sendAlert({ subject: PLC_ERROR_SUBJECT, text }); } catch (_) {}
    } else {
      log.warn('[PLC ALERT]', text);
    }
  }

  // =============================
  // Simulação (PLCOnline=false)
  // =============================
  let simulationTimer = null;

  function resolveSimulationIntervalMs() {
    // ✅ Prioridade:
    // 1) simulationIntervalMs (param do facade)
    // 2) settings.PLCsimulateIntervalMs (config)
    // 3) settings.PLCpollIntervalMin * 1000
    // 4) fallback 1000
    const fromParam = Number(simulationIntervalMs);
    if (!Number.isNaN(fromParam) && fromParam > 0) return fromParam;

    const fromSettings = Number(settings.PLCsimulateIntervalMs);
    if (!Number.isNaN(fromSettings) && fromSettings > 0) return fromSettings;

    const fromPoll = Number(settings.PLCpollIntervalMin);
    if (!Number.isNaN(fromPoll) && fromPoll > 0) return fromPoll * 1000;

    return 1000;
  }

  function resolveJitterMs() {
    const j = Number(simulationJitterMs ?? settings.PLCsimulateJitterMs);
    return (!Number.isNaN(j) && j > 0) ? j : 0;
  }

  function runSimulationTick() {
    try {
      // Chamar com results undefined faz o processor cair no fluxo de simulação.
      // No processor: some_results = !!results => false, results = {}, e depois entra em !settings.PLCOnline. [1](blob:https://www.microsoft365.com/092829dc-1ca6-45b2-adef-0d5252fb34b7)
      processor(undefined, undefined);
    } catch (e) {
      log.warn('[PLC_SIM] Erro chamando processor:', e.message);
    }
  }

  function startSimulationLoop() {
    stopSimulationLoop();

    const baseMs = resolveSimulationIntervalMs();
    const jitter = resolveJitterMs();

    log.log(`[PLC_SIM] Simulação ligada (PLCOnline=false): base=${baseMs}ms jitter=${jitter}ms`);

    // ✅ Melhoria 1: dispara imediatamente
    runSimulationTick();

    // ✅ Melhoria 2: intervalo configurável, com jitter opcional
    simulationTimer = setInterval(() => {
      if (!jitter) {
        runSimulationTick();
        return;
      }

      // jitter simples: atrasa a execução dentro do ciclo para evitar “sincronia”
      const delay = Math.floor(Math.random() * jitter);
      setTimeout(runSimulationTick, delay);
    }, baseMs);
  }

  function stopSimulationLoop() {
    if (simulationTimer) clearInterval(simulationTimer);
    simulationTimer = null;
  }

  // =============================
  // 1) REGISTER (PLC_1)
  // =============================
  class PLCRegister extends EventEmitter {
    constructor() {
      super();
      this.client = null;
      this.pollTimer = null;
      this.started = false;
    }

    start() {
      if (this.started) return;
      this.started = true;

      if (!settings.PLCOnline) {
        log.log('[PLC_REGISTER] PLCOnline=false; não abre conexão real (simulação fica no processor).');
        return;
      }

      try {
        this.client = new plcLib.Register(
          line.station,
          settings.PLCRetryInterval,
          (err, results) => this.emit('data', { err, results, ts: Date.now() }),
          (host, port) => this.emit('reconnect', { host, port, ts: Date.now() })
        );
        log.log('[PLC_REGISTER] Register inicializado.');
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
      const ms = Number(intervalMs) || ((settings.PLCpollIntervalMin || 1) * 1000);
      this.stopPolling();
      this.pollTimer = setInterval(() => this.readOnce(), ms);
      log.log(`[PLC_REGISTER] Polling iniciado: ${ms} ms`);
    }

    stopPolling() {
      if (this.pollTimer) clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    stop() {
      this.stopPolling();
      try { this.client && this.client.close && this.client.close(); } catch (_) {}
      this.client = null;
      this.started = false;
      log.log('[PLC_REGISTER] Parado.');
    }
  }

  // =============================
  // 2) TAKT + TAKTTIME (PLC_takt / PLC_takttime)
  // =============================
  class PLCTakt {
    constructor() {
      this.PLC_takt = null;
      this.PLC_takttime = null;
      this.mapSchedule = null;
      this.mapTaktRemain = null;
    }

    _connOptions() {
      return { host: line.plc.host.$$, port: line.plc.port._ };
    }

    async applySchedule({ map, schedulePLC, rescheduling }) {
      if (!settings.PLCTaktOnline) return;
      if (!map || !schedulePLC) return;

      this.mapSchedule = map;
      if (!rescheduling) return;

      try {
        if (this.PLC_takt) {
          try { this.PLC_takt.close(); } catch (_) {}
          this.PLC_takt = null;
        }

        this.PLC_takt = new plcLib.Takt(this._connOptions(), this.mapSchedule);
        await this.PLC_takt.connect();
        this.PLC_takt.addTakt();
        await this.PLC_takt.setTakt(schedulePLC);

        log.log('[PLC_TAKT] Schedule aplicado via setTakt().');
      } catch (e) {
        log.warn('[PLC_TAKT] Falha ao aplicar schedule:', e.message);
        alert((TEXT && TEXT.PLC_CONNECT_ERROR)
          ? `${TEXT.PLC_CONNECT_ERROR}\n\n${e.message}`
          : `Falha na conexão com CLP (TAKT)\n\n${e.message}`);
        try { this.PLC_takt && this.PLC_takt.close && this.PLC_takt.close(); } catch (_) {}
        this.PLC_takt = null;
      }
    }

    async ensureTaktRemain({ map2 }) {
      if (!settings.PLCTaktOnline) return;
      if (!map2) return;

      if (this.PLC_takttime) return;

      try {
        this.mapTaktRemain = map2;
        this.PLC_takttime = new plcLib.Takt(this._connOptions(), this.mapTaktRemain);
        await this.PLC_takttime.connect();
        this.PLC_takttime.addTakt();

        log.log('[PLC_TAKTTIME] Canal taktremain pronto.');
      } catch (e) {
        log.warn('[PLC_TAKTTIME] Falha ao inicializar:', e.message);
        alert((TEXT && TEXT.PLC_CONNECT_ERROR)
          ? `${TEXT.PLC_CONNECT_ERROR}\n\n${e.message}`
          : `Falha na conexão com CLP (TAKTTIME)\n\n${e.message}`);
        try { this.PLC_takttime && this.PLC_takttime.close && this.PLC_takttime.close(); } catch (_) {}
        this.PLC_takttime = null;
      }
    }

    async getTaktRemain() {
      if (!this.PLC_takttime) return null;
      try { return await this.PLC_takttime.getTaktTime(); }
      catch (e) {
        log.warn('[PLC_TAKTTIME] getTaktTime falhou:', e.message);
        return null;
      }
    }

    stop() {
      try { this.PLC_takt && this.PLC_takt.close && this.PLC_takt.close(); } catch (_) {}
      try { this.PLC_takttime && this.PLC_takttime.close && this.PLC_takttime.close(); } catch (_) {}
      this.PLC_takt = null;
      this.PLC_takttime = null;
      log.log('[PLC_TAKT] Parado.');
    }
  }

  // =============================
  // Instâncias
  // =============================
  const register = new PLCRegister();
  const takt = new PLCTakt();

  // =============================
  // PLUG do processor (certo)
  // =============================
  register.on('data', ({ err, results }) => {
    processor(err, results);
  });

  register.on('reconnect', ({ host, port }) => {
    const msg = (TEXT && TEXT.PLC_CONNECT_ERROR)
      ? `${TEXT.PLC_CONNECT_ERROR}\n\naddress: ${host}:${port}`
      : `Falha na conexão com CLP\n\naddress: ${host}:${port}`;
    alert(msg);
  });

  register.on('error', (e) => {
    const msg = (TEXT && TEXT.PLC_CONNECT_ERROR)
      ? `${TEXT.PLC_CONNECT_ERROR}\n\n${e.message}`
      : `Erro no módulo PLC Register\n\n${e.message}`;
    alert(msg);
  });

  // =============================
  // API do Facade
  // =============================
  return {
    register,
    takt,

    start() {
      stopSimulationLoop();

      if (settings.PLCOnline) {
        register.start();
        register.startPolling((settings.PLCpollIntervalMin || 1) * 1000);
      } else {
        startSimulationLoop();
      }
    },

    stop() {
      stopSimulationLoop();
      register.stop();
      takt.stop();
    },
  };
};