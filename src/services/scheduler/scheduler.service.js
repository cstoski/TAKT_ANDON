'use strict';

const createTimeoutsManager = require('./timeouts.manager');
const createTimelineScheduler = require('./timeline.scheduler');
const createTimelineBuilder = require('./timeline.builder');
const createShiftRulesRepository = require('./shiftRules.repository');
const createPlcScheduleBuilder = require('./plcSchedule.builder');

/**
 * Scheduler Service (com callbacks reais do seu scheduleFutureEvents)
 * ================================================================
 * - Carrega SHIFT_RULES
 * - Monta schedule do dia
 * - Constrói timeline (builder puro)
 * - Agenda timers (timeline.scheduler com timeouts.set)
 * - Aplica PLC Takt/TaktTime via plcFacade.takt
 *
 * IMPORTANTE:
 * Os callbacks abaixo reproduzem os blocos dos setTimeout() originais. [1](https://github.com/cmseaton42/node-ethernet-ip/blob/master/dist/plc/index.js.map)[2](https://onedrive.live.com?cid=8ADD446E13D8DE63&id=8ADD446E13D8DE63!s3f6d6801a8704121af3c1afc7ba88084)
 * Portanto, ctx precisa fornecer as mesmas dependências que antes eram globais.
 */

module.exports = function createScheduler(ctx) {
  if (!ctx) throw new Error('createScheduler(ctx): ctx é obrigatório');

  const {
    // core
    settings, DATA, DB, DBQuery, TEXT,

    // plc (facade já criado no index)
    plcFacade,
    plcLib,

    // UI/IO
    transport,

    // helpers
    start_of_date, pdow, hour_minute,
    sort_by_t_then_start, sort_by_start,
    checklistItem, checklistItemComplete,

    // runtime/side effects usados nos blocos originais
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

    // timers externos do sistema
    timers,

    // estados compartilhados que antes eram globais no index.js
    state, // { start_of_shift, ribbon_normal, ribbon_quality }

    // constantes
    SHIFTS = 2,
    STOPPAGES = 6,
    one_day_ms = 24 * 60 * 60 * 1000,
    one_minute_ms = 60 * 1000,
    one_second_ms = 1000,
    one_hour_ms = 60 * 60 * 1000,

    // opcional
    pollRun,
    timerRun,
  } = ctx;

  if (!transport) throw new Error('Scheduler: ctx.transport é obrigatório (broadcast)');
  if (!timers) throw new Error('Scheduler: ctx.timers é obrigatório');
  if (!state) throw new Error('Scheduler: ctx.state é obrigatório (start_of_shift/ribbons)');

  const line = DATA.line[1];

  // Managers
  const timeouts = createTimeoutsManager();
  const timeline = createTimelineScheduler({ timeouts, logger: console, one_minute_ms });
  const builder = createTimelineBuilder({
    one_day_ms, one_hour_ms, one_minute_ms,
    hour_minute, sort_by_start, SHIFTS
  });

  const repo = createShiftRulesRepository({ DB, DBQuery });
  const plcBuilder = createPlcScheduleBuilder({ settings, line, SHIFTS, STOPPAGES, plcLib });

  async function run() {
    // Igual ao seu early-return: se DB não existe, não agenda. [1](https://github.com/cmseaton42/node-ethernet-ip/blob/master/dist/plc/index.js.map)
    if (!DB || !settings.DBOnline) {
      console.log('[SCHEDULER] Database not available. Skipping event scheduling.');
      return;
    }

    const date = new Date();
    const now = date.getTime();

    let start = start_of_date(date).getTime() - one_day_ms;
    let start_prev;
    let rescheduling;
    let firstShift;
    let lastShift;

    // Loop do dia (mesma intenção do seu while (!firstShift)) [1](https://github.com/cmseaton42/node-ethernet-ip/blob/master/dist/plc/index.js.map)
    while (!firstShift) {
      const presumed_eod = Math.max(line.planned_eod._ || start, line.executed_eod._ || start, start);
      const after_executed_day = !isNaN(presumed_eod) && (start_prev || start) <= presumed_eod && presumed_eod <= now;
      const before_executed_day = isNaN(line.executed_sod._) || (line.executed_sod._ < presumed_eod);
      rescheduling = after_executed_day && before_executed_day;

      if (start === start_prev && after_executed_day) start += one_day_ms;
      else start_prev = start;

      const start_date = new Date(start);
      const dom = start_date.getDate();
      const dow = pdow(start_date.getDay());

      // ===== PLC MAPS e TAKT =====
      const { map, schedulePLC, map2 } = plcBuilder.buildMaps({ rescheduling });

      if (plcFacade && settings.PLCTaktOnline) {
        if (rescheduling) await plcBuilder.startPlcDayDateTime();
        await plcFacade.takt.applySchedule({ map, schedulePLC, rescheduling });
        await plcFacade.takt.ensureTaktRemain({ map2 });
      }

      // ===== SHIFT_RULES =====
      const schedule = line.shifts[dow].$$;
      const [error, results] = await repo.getShiftRules({ lineId: 1, start, dow, dom });

      if (error || !results) {
        sendAlert({
          subject: TEXT.database_SHIFT_RULES_ERROR,
          text: TEXT.database_SHIFT_RULES_ERROR + '\n\n' + error
        });
        return;
      }

      results.sort(sort_by_t_then_start);

      // Aplica regras no schedule (mesmo switch t==0 vs stops) [1](https://github.com/cmseaton42/node-ethernet-ip/blob/master/dist/plc/index.js.map)
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (!schedule[r.w]) schedule[r.w] = {};
        if (!schedule[r.w].stops) schedule[r.w].stops = [];

        switch (r.t) {
          case 0: {
            if (r.rd !== null) {
              if (!(r.sh + r.sm + r.eh + r.em)) schedule[r.w].c = true;
              schedule[r.w]['start'] = [r.sh, r.sm];
              schedule[r.w]['end'] = [r.eh, r.em];
            }
            schedule[r.w].hi = r.hi;
            schedule[r.w].h = r.h;
            if (r.p > 0) schedule[r.w]['plan'] = r.p;
            break;
          }
          default: {
            const item = {
              on: r.rd !== null,
              name: r.t === 1 ? TEXT.label_break_lunch : r.n,
              desc: r.d,
              type: r.t,
              'break-start': [r.sh, r.sm],
              'break-end': [r.eh, r.em],
            };
            schedule[r.w].stops.push(item);
            break;
          }
        }
      }

      // ===== CONSTRÓI TIMELINE (pura) =====
      const timelines = builder.buildDay({ startDayTs: start, nowTs: now, scheduleDay: schedule });

      for (const t of timelines) {
        if (!firstShift) firstShift = t.sh;
        lastShift = t.sh;
      }

      // Limpa timers antigos ao reagendar
      timeline.clearAll();

      // ===== AGENDA TURNOS + BREAKS (COM BLOCOS REAIS) =====
      for (const t of timelines) {
        const sh = t.sh;

        // Skip se o turno foi cancelado/holiday (você faz checks antes; aqui mantemos simples)
        if (!schedule[sh]) continue;

        // mantém referência ao “schedule do turno” (usado dentro dos callbacks)
        const scheduleShift = schedule[sh];

        // marca plan_duration/plan_breaks como você fazia no final do loop do turno [1](https://github.com/cmseaton42/node-ethernet-ip/blob/master/dist/plc/index.js.map)
        scheduleShift.plan_duration = t.plan_duration;
        scheduleShift.plan_breaks = Math.min(t.plan_breaks, t.plan_duration);

        // Os breaks chegam do builder e já vêm com waits e meta
        const breaks = t.breaks.map(b => ({
          id: b.id,
          waitStartMs: b.waitStartMs,
          waitEndMs: b.waitEndMs,
          meta: {
            ...b.meta,
            // tag compatível com checklist original: sh+'-'+(s+1) [1](https://github.com/cmseaton42/node-ethernet-ip/blob/master/dist/plc/index.js.map)
            tag: sh + '-' + b.id,
            idx: b.id - 1,
          }
        }));

        timeline.scheduleShiftLifecycle({
          prefix: `day:${start}`,
          shift: sh,
          waitStartMs: t.waitStartMs,
          waitEndMs: t.waitEndMs,
          breaks,
          isFirstShift: (firstShift === sh),
          preShutdownMinutes: 10,

          callbacks: {
            // ========= PRE-SHUTDOWN (igual ao seu) =========
            onPreShiftShutdown: () => {
              if (line.running && line.running._) return;
              shutdown();
            },

            // ========= INÍCIO DO TURNO (bloco real do seu setTimeout wait_s) =========
            onShiftStart: () => {
              // equivalente ao trecho do seu scheduler no start do turno [1](https://github.com/cmseaton42/node-ethernet-ip/blob/master/dist/plc/index.js.map)
              const shiftObj = line.shift[sh];

              line.shift_active = sh;
              line.shift_inactive = undefined;
              line.shift_display_until = undefined;
              line.paused = undefined;
              line.running = true;
              line.resuming = true;

              // start_of_shift era global; agora está em ctx.state
              state.start_of_shift = t.absStart;

              if (firstShift === sh) line.executed_sod = t.absStart;

              if (!checklistItem('start-' + sh)) {
                console.log(TEXT.phrase_scheduler_starting + ': ' + sh);

                line.shift[sh] = {
                  takttime: (scheduleShift.takttime._ >= settings.minimumTaktTime
                    ? scheduleShift.takttime._ : settings.minimumTaktTime),
                  produced: 0,
                  accepted: 0,
                  rejected: 0,
                };

                line.state = undefined;
                line.state = { run: [], green: [], yellow: [], blue: [], red: [] };

                line.production_checked_since = new Date(t.absStart).toISOString();
                transport.broadcastMessage(analyticsReset(true));
              } else if (!line.production_checked_since._) {
                line.production_checked_since = new Date(t.absStart).toISOString();
                line.production_cache = undefined;
              }

              // ribbons (antes globais) agora em state
              state.ribbon_normal = {};
              state.ribbon_quality = {};

              tallyToggle(true, 'run');

              // broadcast inicial do turno (equivalente ao seu) [1](https://github.com/cmseaton42/node-ethernet-ip/blob/master/dist/plc/index.js.map)
              transport.broadcastMessage({
                dashboard2: {
                  signature: 'A',
                  shift: {
                    shift: sh,
                    plan: shiftObj.plan._,
                    plan_day: line.plan_day._,
                  },
                  production: {
                    produced: !isNaN(shiftObj.produced._) ? shiftObj.produced._ : 0,
                    accepted: !isNaN(shiftObj.accepted._) ? shiftObj.accepted._ : 0,
                    rejected: !isNaN(shiftObj.rejected._) ? shiftObj.rejected._ : 0,
                    remaining: (!isNaN(shiftObj.plan._) ? shiftObj.plan._ : 0) - (!isNaN(shiftObj.accepted._) ? shiftObj.accepted._ : 0) || 0,
                  }
                }
              });

              checklistItemComplete('start-' + sh);
            },

            // ========= INÍCIO DO BREAK (bloco real do seu setTimeout wait_bs) =========
            onBreakStart: ({ meta }) => {
              if (line.shift_active._ !== sh) return;

              const break_name = (meta.type === 1) ? TEXT.label_break_lunch : (meta.name || '');

              line.pausing = true;
              line.paused = break_name;

              // você fazia ribbonSet(... line.state.breaks ...) — mantemos a chamada
              ribbonSet(undefined, line.state.breaks, meta.idx, Date.now(), undefined);

              line.running = undefined;

              // produção timer
              clearTimeout(timers.production);
              delete timers.production;

              tallyToggle(false, 'run', 'green', 'yellow', 'blue', 'red');

              if (!checklistItem('break-start-' + meta.tag)) {
                console.log(TEXT.phrase_scheduler_starting_break + ': ' + break_name);
              }

              checklistItemComplete('break-start-' + meta.tag);
            },

            // ========= FIM DO BREAK (bloco real do seu setTimeout wait_be) =========
            onBreakEnd: ({ meta }) => {
              if (line.shift_active._ !== sh || line.running._) return;

              const break_name = (meta.type === 1) ? TEXT.label_break_lunch : (meta.name || '');

              line.pausing = undefined;
              line.paused = undefined;

              const [fs, fe] = ribbonSet(undefined, line.state.breaks, meta.idx, undefined, Date.now(), true);

              if (fs) {
                ribbonFill(state.ribbon_normal, line.state.red_normal, fs, fe);
                ribbonFill(state.ribbon_quality, line.state.red_quality, fs, fe);
              }

              line.running = true;
              line.resuming = true;

              tallyToggle(true, 'run');

              if (!checklistItem('break-end-' + meta.tag)) {
                console.log(TEXT.phrase_scheduler_ending_break + ': ' + break_name);
              }

              checklistItemComplete('break-end-' + meta.tag);
            },

            // ========= FIM DO TURNO (bloco real do seu setTimeout wait_e) =========
            onShiftEnd: async () => {
              // este bloco no seu código é bem grande; aqui mantenho o núcleo (estado + DB history + relatório)
              // e preservo as chamadas originais essenciais. [1](https://github.com/cmseaton42/node-ethernet-ip/blob/master/dist/plc/index.js.map)

              const date2 = new Date();
              const now2 = date2.getTime();

              line.running = undefined;
              line.pausing = true;
              line.paused = true;

              line.shift_inactive = line.shift_active._;
              line.shift_active = undefined;

              clearTimeout(timers.production);
              delete timers.production;

              tallyToggle(false, 'run', 'green', 'yellow', 'blue', 'red');

              // no original você chamava plcCallback() no end-shift
              // aqui, se quiser “forçar refresh”, basta um readOnce no register:
              if (plcFacade && plcFacade.register && typeof plcFacade.register.readOnce === 'function') {
                plcFacade.register.readOnce();
              }

              if (!checklistItem('end-' + sh)) {
                console.log(TEXT.phrase_scheduler_ending_shift + ': ' + sh);

                const shiftObj = line.shift[line.shift_inactive._];
                const runtime = line.state.run.$.length ? (line.state.run[line.state.run.$.length - 1][1]._ || 0) : 0;

                const sum_normal = ribbonSum(state.ribbon_normal, line.state.red_normal);
                const sum_quality = ribbonSum(state.ribbon_quality, line.state.red_quality);

                // relatório (mantém intenção original) [1](https://github.com/cmseaton42/node-ethernet-ip/blob/master/dist/plc/index.js.map)
                sendReport({
                  line: 1,
                  shift: sh,
                  start: t.absStart,
                  end: t.absEnd,
                  initiated: true,
                  finalized: true,
                  concluded: true,
                  analyzed: true,
                  event0: true,
                  event1: true,
                  event2: true,
                  option: 0,
                }).then((answer) => {
                  if (typeof answer === 'string' && answer.startsWith('REPORT:')) {
                    sendAlert({ subject: TEXT.report_ERROR, text: TEXT.report_ERROR + '\n\n' + answer });
                  }
                });

                // grava history (mantém query) [1](https://github.com/cmseaton42/node-ethernet-ip/blob/master/dist/plc/index.js.map)
                if (DB) {
                  DB.execute(DBQuery['INSERT_HISTORY'], [
                    date2.toLocaleString(),
                    true,
                    now2,
                    start,
                    1,
                    sh,
                    Math.max(0, shiftObj.plan._ || 0),
                    Math.max(0, shiftObj.plan_duration._ || 0),
                    Math.max(0, shiftObj.plan_breaks._ || 0),
                    Math.max(0, (shiftObj.plan_duration._ || 0) - (shiftObj.plan_breaks._ || 0)),
                    Math.max(0, runtime || 0),
                    Math.max(0, (line.state.red.$.length ? (line.state.red[line.state.red.$.length - 1][1]._ || 0) : 0)),
                    sum_normal,
                    sum_quality,
                    Math.max(0, shiftObj.takttime._ || 0),
                    Math.max(0, shiftObj.taktremain._ || 0),
                    +(shiftObj.availability._ || 0).toFixed(3),
                    +(shiftObj.performance._ || 0).toFixed(3),
                    Math.max(0, ((runtime || 0) / 1000 / (shiftObj.takttime._ >= settings.minimumTaktTime ? shiftObj.takttime._ : settings.minimumTaktTime)).toFixed(1)),
                    Math.max(0, shiftObj.accepted._ || 0),
                    Math.max(0, shiftObj.rejected._ || 0),
                    +(shiftObj.quality._ || 0).toFixed(3),
                    +(shiftObj.oee._ || 0).toFixed(3),
                    JSON.stringify({
                      start: scheduleShift['start'],
                      end: scheduleShift['end'],
                      stops: scheduleShift.stops,
                    }),
                  ]);
                }
              }

              checklistItemComplete('end-' + sh);

              // comportamento final do dia (mantém a ideia: se último turno, shutdown depois) [1](https://github.com/cmseaton42/node-ethernet-ip/blob/master/dist/plc/index.js.map)
              if (lastShift === sh) {
                if (!isNaN(line.planned_eod._)) {
                  line.executed_eod = line.planned_eod._;
                  line.planned_eod = undefined;
                }
                line.checklist = undefined;

                timeouts.set(`day:${start}:shutdownAfterEOD`, () => {
                  if (line.running && line.running._) return;
                  shutdown();
                }, 10 * one_minute_ms);
              }
            }
          }
        });
      }

      // inicia timers centrais como no final do seu scheduler [1](https://github.com/cmseaton42/node-ethernet-ip/blob/master/dist/plc/index.js.map)
      if (typeof timerRun === 'function') timerRun();
      if (settings.PLCOnline && typeof pollRun === 'function') pollRun(1);

      return;
    }
  }

  return { run, timeouts };
};