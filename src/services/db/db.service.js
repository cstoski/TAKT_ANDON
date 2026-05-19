const sharkpool = require('../sharkpool');

class DBService {
  constructor(settings, databaseConfig) {
    this.settings = settings;
    this.config = databaseConfig;
    this.pool = null;
  }

  connect() {
    try {
      this.pool = sharkpool.createPool({
        executeTimeout: this.settings.DBexecuteTimeout,
        maxConnections: this.settings.DBmaxConnections,
        warmConnections: this.settings.DBwarmConnections,
        server: {
          host: this.config.address,
          port: +this.config.port || 3306,
          database: this.config.database,
          user: this.config.username,
          password: this.config.password,
        }
      });

      console.log('[DB] Connected');
    } catch (err) {
      console.log('[DB ERROR] Failed to initialize:', err.message);
      this.pool = null;
    }
  }

  async execute(query, params = []) {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const start = process.hrtime();

    try {
      const result = await this.pool.execute(query, params);

      const diff = process.hrtime(start);
      const duration = diff[0] + diff[1] / 1e9;

      if (result && result.rows) {
        Object.defineProperty(result.rows, 'queryDuration', {
          enumerable: false,
          value: duration
        });
      }

      return result;

    } catch (err) {
      return { error: err };
    }
  }

  destroy() {
    if (this.pool) {
      this.pool.destroy();
      this.pool = null;
    }
  }
}

module.exports = DBService;
