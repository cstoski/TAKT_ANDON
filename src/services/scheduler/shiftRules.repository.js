'use strict';

module.exports = function createShiftRulesRepository({ DB, DBQuery }) {
  if (!DB) throw new Error('ShiftRulesRepository: DB é obrigatório');
  if (!DBQuery) throw new Error('ShiftRulesRepository: DBQuery é obrigatório');

  async function getShiftRules({ lineId, start, dow, dom }) {
    // mesmo shape que você usa hoje: [1, start, start, start, dow, dom] [1](https://onedrive.live.com?cid=8ADD446E13D8DE63&id=8ADD446E13D8DE63!s3f6d6801a8704121af3c1afc7ba88084)
    return await DB.execute(DBQuery['SHIFT_RULES'], [lineId, start, start, start, dow, dom]);
  }

  return { getShiftRules };
};