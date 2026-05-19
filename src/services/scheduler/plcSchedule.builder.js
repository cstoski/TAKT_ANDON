'use strict';

module.exports = function createPlcScheduleBuilder({ settings, line, SHIFTS, STOPPAGES, plcLib }) {
  if (!settings) throw new Error('PlcScheduleBuilder: settings é obrigatório');
  if (!line) throw new Error('PlcScheduleBuilder: line é obrigatório');
  if (!plcLib) throw new Error('PlcScheduleBuilder: plcLib é obrigatório');

  function buildMaps({ rescheduling }) {
    const options = line.plc.$$;
    const schedulePLC = {};
    const map = {};
    const map2 = {};

    // map2: leitura de taktremain (antes criado dentro do startPLCTakt) [1](https://onedrive.live.com?cid=8ADD446E13D8DE63&id=8ADD446E13D8DE63!s3f6d6801a8704121af3c1afc7ba88084)
    if (options.addresses instanceof Object) {
      for (let sh = 1; sh <= SHIFTS; sh++) {
        if (options.addresses[sh + '-taktremain-address']) {
          map2[sh + '-taktremain'] =
            `${options.addresses[sh + '-taktremain-address']},WORD${options.addresses[sh + '-taktremain-offset']}`;
        }
      }
    }

    // map + schedulePLC só precisa quando rescheduling e PLCTaktOnline [1](https://onedrive.live.com?cid=8ADD446E13D8DE63&id=8ADD446E13D8DE63!s3f6d6801a8704121af3c1afc7ba88084)
    if (rescheduling && settings.PLCTaktOnline && (options.addresses instanceof Object)) {
      for (let sh = 1; sh <= SHIFTS; sh++) {
        if (options.addresses[sh + '-takt-trigger-address']) {
          if (options.addresses[sh + '-shift-address']) {
            if (parseFloat(options.addresses[sh + '-shift-start-offset'])) {
              map[sh + '-shift-start-hour'] =
                `${options.addresses[sh + '-shift-address']},WORD${+options.addresses[sh + '-shift-start-offset']}`;
              schedulePLC[sh + '-shift-start-hour'] = 0;

              map[sh + '-shift-start-minute'] =
                `${options.addresses[sh + '-shift-address']},WORD${+options.addresses[sh + '-shift-start-offset'] + 2}`;
              schedulePLC[sh + '-shift-start-minute'] = 0;
            }
            if (parseFloat(options.addresses[sh + '-shift-end-offset'])) {
              map[sh + '-shift-end-hour'] =
                `${options.addresses[sh + '-shift-address']},WORD${+options.addresses[sh + '-shift-end-offset']}`;
              schedulePLC[sh + '-shift-end-hour'] = 0;

              map[sh + '-shift-end-minute'] =
                `${options.addresses[sh + '-shift-address']},WORD${+options.addresses[sh + '-shift-end-offset'] + 2}`;
              schedulePLC[sh + '-shift-end-minute'] = 0;
            }
          }

          if (options.addresses[sh + '-takttime-address']) {
            map[sh + '-takttime'] =
              `${options.addresses[sh + '-takttime-address']},WORD${options.addresses[sh + '-takttime-offset']}`;
            schedulePLC[sh + '-takttime'] = 0;

            map[sh + '-takt-trigger'] =
              `${options.addresses[sh + '-takt-trigger-address']},X${options.addresses[sh + '-takt-trigger-offset']}`;
            schedulePLC[sh + '-takt-trigger'] = true;
          }
        }

        if (options.addresses[sh + '-stoppage-trigger-address']) {
          for (let s = 0; s < STOPPAGES; s++) {
            const tag = sh + '-' + (s + 1);
            if (options.addresses[tag + '-stoppage-address']) {
              if (parseFloat(options.addresses[tag + '-stoppage-start-offset'])) {
                map[tag + '-stoppage-start-hour'] =
                  `${options.addresses[tag + '-stoppage-address']},WORD${+options.addresses[tag + '-stoppage-start-offset']}`;
                schedulePLC[tag + '-stoppage-start-hour'] = 0;

                map[tag + '-stoppage-start-minute'] =
                  `${options.addresses[tag + '-stoppage-address']},WORD${+options.addresses[tag + '-stoppage-start-offset'] + 2}`;
                schedulePLC[tag + '-stoppage-start-minute'] = 0;
              }
              if (parseFloat(options.addresses[tag + '-stoppage-end-offset'])) {
                map[tag + '-stoppage-end-hour'] =
                  `${options.addresses[tag + '-stoppage-address']},WORD${+options.addresses[tag + '-stoppage-end-offset']}`;
                schedulePLC[tag + '-stoppage-end-hour'] = 0;

                map[tag + '-stoppage-end-minute'] =
                  `${options.addresses[tag + '-stoppage-address']},WORD${+options.addresses[tag + '-stoppage-end-offset'] + 2}`;
                schedulePLC[tag + '-stoppage-end-minute'] = 0;
              }
            }
          }

          map[sh + '-stoppage-trigger'] =
            `${options.addresses[sh + '-stoppage-trigger-address']},X${options.addresses[sh + '-stoppage-trigger-offset']}`;
          schedulePLC[sh + '-stoppage-trigger'] = true;
        }
      }
    }

    return { options, map, schedulePLC, map2 };
  }

  async function startPlcDayDateTime() {
    const address = line.plc.address._;
    if (!address) return;

    const date = new Date();
    const offset = line.plc.offset._;

    const datetime_map = {
      trigger: `${line.plc.trigger_address._},X${line.plc.trigger_offset._}`,
      year: `${address},WORD${offset + 0}`,
      month: `${address},BYTE${offset + 2}`,
      date: `${address},BYTE${offset + 3}`,
      day: `${address},BYTE${offset + 4}`,
      hour: `${address},BYTE${offset + 5}`,
      minute: `${address},BYTE${offset + 6}`,
      second: `${address},BYTE${offset + 7}`,
    };

    const initPLC = {
      trigger: true,
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      date: date.getDate(),
      day: date.getDay() + 1,
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };

    // No seu código isso é feito com new plc.Takt(...).connect().addTakt().setTakt(initPLC).close() [1](https://onedrive.live.com?cid=8ADD446E13D8DE63&id=8ADD446E13D8DE63!s3f6d6801a8704121af3c1afc7ba88084)
    const PLC_datetime = new plcLib.Takt({ host: line.plc.host.$$, port: line.plc.port._ }, datetime_map);
    await PLC_datetime.connect();
    PLC_datetime.addTakt();
    await PLC_datetime.setTakt(initPLC);
    PLC_datetime.close();
  }

  return { buildMaps, startPlcDayDateTime };
};
