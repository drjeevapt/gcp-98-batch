const app = require('../server/server');
const db = require('../server/db');

module.exports = async (req, res) => {
  await db.ensureDbReady();
  return app(req, res);
};
