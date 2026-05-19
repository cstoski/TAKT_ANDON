'use strict';

class PLCTaktService {
  constructor({ plcLib, settings, linePlcConfig, logger }) {
    this.plcLib = plcLib;
    this.settings = settings;
    this.linePlcConfig = linePlcConfig; // DATA.line[1].plc
    this.log = logger || console.log;

    this.PLC_takt = null;      // agenda (setTakt)
    this.PLC_takttime = null;  // leitura taktremain (getTaktTime)
    this.mapSchedule = null;
    this.mapTaktremain = null;
  }

  _connOptions() {
    return { host: this.linePlcConfig.host.$$, port: this.linePlcConfig.port._ };
  }

  /**
   * Configura/agrega o mapa de schedule (map) e aplica schedulePLC via setTakt
   * Equivalente ao que você faz em startPLCTakt() quando "rescheduling". [1](https://onedrive.live.com?cid=8ADD446E13D8DE63&id=8ADD446E13D8DE63!s3f6d6801a8704121af3c1afc7ba88084)
   */
  async applySchedule({ map, schedulePLC, rescheduling }) {
    if (!this.settings?.PLCTaktOnline) return;

    this.mapSchedule = map;

    // só recria PLC_takt quando precisa "regravar agenda" (seu rescheduling) [1](https://onedrive.live.com?cid=8ADD446E13D8DE63&id=8ADD446E13D8DE63!s3f6d6801a8704121af3c1afc7ba88084)
    if (rescheduling) {
      try { this.PLC_takt?.close?.(); } catch (_) {}
      this.PLC_takt = new this.plcLib.Takt(this._connOptions(), this.mapSchedule);

      await this.PLC_takt.connect();
      this.PLC_takt.addTakt();
      await this.PLC_takt.setTakt(schedulePLC);

      this.log('[PLC_TAKT] schedule aplicado (setTakt).');
    }
  }

  /**
   * Inicializa o canal de leitura de taktremain (map2 + PLC_takttime)
   * Equivalente ao seu bloco: if (!PLC_takttime) { ... connect; addTakt } [1](https://onedrive.live.com?cid=8ADD446E13D8DE63&id=8ADD446E13D8DE63!s3f6d6801a8704121af3c1afc7ba88084)
   */
  async ensureTaktRemain({ map2 }) {
    if (!this.settings?.PLCTaktOnline) return;

    if (!this.PLC_takttime) {
      this.mapTaktremain = map2;
      this.PLC_takttime = new this.plcLib.Takt(this._connOptions(), this.mapTaktremain);

      await this.PLC_takttime.connect();
      this.PLC_takttime.addTakt();

      this.log('[PLC_TAKTTIME] canal taktremain pronto.');
    }
  }

  /**
   * Lê taktremain (usa getTaktTime do PLC_takttime).
   * Seu timerRun faz isso: PLC_takttime.getTaktTime() e pega [shift+'-taktremain'] [1](https://onedrive.live.com?cid=8ADD446E13D8DE63&id=8ADD446E13D8DE63!s3f6d6801a8704121af3c1afc7ba88084)
   */
  async getTaktRemain() {
    if (!this.PLC_takttime) return null;
    try {
      return await this.PLC_takttime.getTaktTime();
    } catch (e) {
      this.log('[PLC_TAKTTIME] erro no getTaktTime:', e.message);
      return null;
    }
  }

  stop() {
    try { this.PLC_takt?.close?.(); } catch (_) {}
    try { this.PLC_takttime?.close?.(); } catch (_) {}
    this.PLC_takt = null;
    this.PLC_takttime = null;
    this.log('[PLC_TAKT] parado.');
  }
}

module.exports = PLCTaktService;