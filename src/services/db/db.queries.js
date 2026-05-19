'use strict';

/**
 * Centralização de todas as queries SQL usadas no sistema
 * Facilita manutenção, padronização e refatoração futura
 */

module.exports = {

  // ============================
  // EVENTS
  // ============================

  INSERT_EVENT: `
    INSERT INTO events
    SET id=?, r=?, t=?, v=?, st=?, l=?, w=?, b=?, s=?, j=?, u=?
  `,

  END_EVENT: `
    UPDATE events
    SET id=?, e=?
    WHERE r=?
  `,

  SELECT_EVENT: `
    SELECT *
    FROM events
    WHERE r=?
    ORDER BY id DESC
    LIMIT 1
  `,

  SELECT_EVENT_VERSION: `
    SELECT *
    FROM events
    WHERE r=? AND v=?
    ORDER BY id DESC
    LIMIT 1
  `,

  SELECT_EVENT_HIGHEST_VERSION: `
    SELECT MAX(v) AS vv
    FROM events
    WHERE r=?
  `,

  // ============================
  // SHIFT / SCHEDULE
  // ============================

  SHIFT_RULES: `
    SELECT *
    FROM shifts
    WHERE l=?
      AND (dd IS NULL OR sd <> dd)
      AND sd <= ?
      AND (dd IS NULL OR dd > ?)
      AND (
        ((rd IS NULL OR rd=0) AND rw IS NULL AND rm IS NULL AND sd=?)
        OR rd=1
        OR rw=?
        OR rm=?
      )
    ORDER BY w ASC
  `,

  UPSERT_BREAK: `
    INSERT INTO shifts
      SET l=?, w=?, t=?, k=?, n=?, d=?, rd=?, rw=?, rm=?, sd=?, dd=?, sh=?, sm=?, eh=?, em=?
    ON DUPLICATE KEY UPDATE
      n=?, d=?, rd=?, rw=?, rm=?, dd=?, sh=?, sm=?, eh=?, em=?
  `,

  DELETE_BREAK: `
    UPDATE shifts
    SET dd=?
    WHERE k=?
  `,

  UPSERT_PLAN: `
    INSERT INTO shifts
      SET k=?, t=0, sd=?, p=?, l=?, w=?
    ON DUPLICATE KEY UPDATE
      p=?
  `,

  UPSERT_HOLIDAY: `
    INSERT INTO shifts
      SET k=?, t=?, sd=?, hi=?, h=?, l=?, w=?
    ON DUPLICATE KEY UPDATE
      hi=?, h=?
  `,

  // ============================
  // PRODUCTION (Oracle)
  // ============================

  PRODUCTION_SINCE: `
    SELECT 
      r.check_result_pk,
      l.engine_serial_number,
      e.arrangement_number,
      e.engine_description_full,
      e.engine_description,
      e.engine_status,
      r.check_end_tstamp,
      r.check_sequence,
      r.check_id,
      r.check_result
    FROM qg_check_list l
    JOIN qg_check_result r
      ON r.check_list_number = l.check_list_number
    JOIN engines e
      ON e.engine_serial_number = l.engine_serial_number
    WHERE l.checked_station_number = :station_code
      AND l.checked_work_area_code = :work_area_code
      AND r.check_end_tstamp >= TO_DATE(:since_date,'DD/MM/YY hh24:mi:ss')
    ORDER BY r.check_end_tstamp ASC, r.check_result ASC
  `,

  // ============================
  // HISTORY
  // ============================

  INSERT_HISTORY: `
    INSERT INTO history
    SET datetime=?, final=?, timestamp=?, start_of_date=?, line=?, shift=?,
        plan=?, plan_duration=?, plan_breaks=?, plan_runtime=?,
        runtime=?, stoptime=?, stoptime_normal=?, stoptime_quality=?,
        takttime=?, taktremain=?, availability=?, performance=?,
        ideal=?, produced=?, rejected=?, quality=?, oee=?, json=?
  `,

  SELECT_HISTORY_FINAL_ONCE: `
    SELECT 
      final,
      a.timestamp,
      a.line,
      a.shift,
      a.start_of_date,
      plan,
      plan_duration,
      plan_breaks,
      plan_runtime,
      runtime,
      stoptime,
      takttime,
      taktremain,
      availability,
      performance,
      ideal,
      produced,
      rejected,
      quality,
      oee,
      json
    FROM history a
    INNER JOIN (
      SELECT 
        MAX(timestamp) timestamp,
        line,
        shift,
        start_of_date
      FROM history
      WHERE line=?
        AND final=1
        AND start_of_date>=?
        AND start_of_date<?
      GROUP BY line, shift, start_of_date
    ) b 
    ON a.timestamp=b.timestamp
      AND a.line=b.line
      AND a.shift=b.shift
      AND a.start_of_date=b.start_of_date
    ORDER BY a.timestamp ASC
  `,

  // ============================
  // PRODUCTION PIECES
  // ============================

  UPSERT_PIECE: `
    INSERT INTO pieces
      SET timestamp=?, timestamp_produced=?, serial=?, model=?, accepted=?, rejected=?
    ON DUPLICATE KEY UPDATE
      timestamp=?, accepted=?, rejected=?
  `

};
