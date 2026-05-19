'use strict';

module.exports = function createTimeoutsManager() {
  const timers = new Map();

  function set(name, fn, delayMs) {
    clear(name);
    const id = setTimeout(fn, Math.max(0, delayMs || 0));
    timers.set(name, id);
    return id;
  }

  function clear(name) {
    const id = timers.get(name);
    if (id) clearTimeout(id);
    timers.delete(name);
  }

  function clearAll() {
    for (const [name, id] of timers.entries()) {
      clearTimeout(id);
      timers.delete(name);
    }
  }

  return { set, clear, clearAll };
};