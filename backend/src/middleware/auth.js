const { verify } = require('../utils/jwt');

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Missing Bearer token' } });
  }
  try {
    req.auth = verify(m[1]);
    next();
  } catch (e) {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Token invalid or expired' } });
  }
}

module.exports = { authRequired };
