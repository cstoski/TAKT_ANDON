'use strict';

/**
 * Timeline Builder (puro)
 * =======================
 * Constrói a timeline (turnos + breaks) SEM agendar timers.
 *
 * Entrada: schedule do dia (já montado a partir do DB/Defaults)
 * Saída: objetos prontos para o timeline.scheduler agendar.
 *
 * Este módulo é o “corte cirúrgico” do scheduleFutureEvents():
 * - calcula shiftStart/shiftEnd (inclui overnight)
 * - normaliza/parsa breaks (inclui overnight, recorte no turno, resolve overlaps)
 * - calcula waitStartMs/waitEndMs e waits de breaks
 */

module.exports = function createTimelineBuilder({
  one_day_ms,
  one_hour_ms,
  one_minute_ms,
  hour_minute,
  sort_by_start,
  SHIFTS = 2,
}) {
  if (!one_day_ms) one_day_ms = 24 * 60 * 60 * 1000;
  if (!one_hour_ms) one_hour_ms = 60 * 60 * 1000;
  if (!one_minute_ms) one_minute_ms = 60 * 1000;
  if (typeof hour_minute !== 'function') throw new Error('timeline.builder: hour_minute é obrigatório');
  if (typeof sort_by_start !== 'function') throw new Error('timeline.builder: sort_by_start é obrigatório');

  function toHM(ms) {
    const h = Math.floor(ms / one_hour_ms) % 24;
    const m = Math.floor((ms % one_hour_ms) / one_minute_ms);
    return [h, m];
  }

  /**
   * Normaliza e recorta breaks para dentro do turno, resolvendo overlaps.
   * Mantém lógica semelhante à do seu scheduler atual.
   */
  function normalizeBreaks({ startDayTs, nowTs, shiftStartMs, shiftEndMs, stops }) {
    const breaks = [];

    // garante array
    const list = Array.isArray(stops) ? stops.slice() : [];

    // ordena por horário de início
    list.sort(sort_by_start);

    let prevBreakEnd = shiftStartMs;

    for (let i = 0; i < list.length; i++) {
      const st = list[i] || {};

      const bsOrig = hour_minute(st['break-start']);
      const beOrig = hour_minute(st['break-end']);

      // overnight do próprio break
      const beSpanned = beOrig + (beOrig < bsOrig ? one_day_ms : 0);

      // se o break começa antes do turno e já estamos além do 1º break, considera overnight
      const bsAdj = bsOrig + ((i && bsOrig < shiftStartMs) ? one_day_ms : 0);

      // start recortado + não pode voltar no tempo (overlap)
      const breakStart = Math.max(
        shiftStartMs,
        Math.min(
          Math.max(prevBreakEnd, bsAdj),
          shiftEndMs
        )
      );

      const breakEnd = Math.max(
        breakStart,
        Math.min(beSpanned, shiftEndMs)
      );

      const duration = breakEnd - breakStart;

      // se duration==0, ignora (ou mantém como off)
      if (!duration) {
        prevBreakEnd = Math.max(prevBreakEnd, breakEnd);
        continue;
      }

      const waitStartMs = Math.max(0, (startDayTs + breakStart) - nowTs);
      const waitEndMs = Math.max(0, (startDayTs + breakEnd) - nowTs);

      breaks.push({
        id: i + 1,
        waitStartMs,
        waitEndMs,
        absStart: startDayTs + breakStart,
        absEnd: startDayTs + breakEnd,
        meta: {
          type: st.type,
          name: st.name,
          desc: st.desc || '',
          'break-start': toHM(breakStart),
          'break-end': toHM(breakEnd),
        }
      });

      prevBreakEnd = breakEnd;
    }

    return breaks;
  }

  /**
   * Constrói timeline de UM turno.
   */
  function buildShift({ startDayTs, nowTs, sh, scheduleShift }) {
    if (!scheduleShift) return null;

    // coordenadas do turno
    const shiftStartMs = hour_minute(scheduleShift['start']);
    const shiftEndOrig = hour_minute(scheduleShift['end']);

    // overnight de turno
    const shiftEndMs = shiftEndOrig + (shiftEndOrig < shiftStartMs ? one_day_ms : 0);

    const absStart = startDayTs + shiftStartMs;
    const absEnd = startDayTs + shiftEndMs;

    const waitStartMs = Math.max(0, absStart - nowTs);
    const waitEndMs = Math.max(0, absEnd - nowTs);

    // breaks
    const breaks = normalizeBreaks({
      startDayTs,
      nowTs,
      shiftStartMs,
      shiftEndMs,
      stops: scheduleShift.stops
    });

    // métricas para uso externo
    const plan_duration = shiftEndMs - shiftStartMs;
    const plan_breaks = breaks.reduce((acc, b) => acc + Math.max(0, (b.absEnd - b.absStart)), 0);

    return {
      sh,
      absStart,
      absEnd,
      waitStartMs,
      waitEndMs,
      plan_duration,
      plan_breaks,
      breaks,
    };
  }

  /**
   * Constrói timeline do DIA inteiro.
   * scheduleDay deve ser o objeto do dia (ex: schedule[dow]).
   */
  function buildDay({ startDayTs, nowTs, scheduleDay }) {
    const out = [];
    for (let sh = 1; sh <= SHIFTS; sh++) {
      const t = buildShift({ startDayTs, nowTs, sh, scheduleShift: scheduleDay[sh] });
      if (t) out.push(t);
    }
    return out;
  }

  return { buildDay, buildShift, normalizeBreaks };
};