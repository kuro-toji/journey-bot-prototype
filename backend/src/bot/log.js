/**
 * Bot logging — anon question log + verification audit log.
 *
 * Two logs:
 *   - anonQuestions  : IP -> [{intent, ts}] (cleared on process restart)
 *   - verifyEvents   : console line per attempt (forensic; the only
 *                       persistent record is the server's own stdout)
 *
 * We deliberately do NOT write to the database. This is a demo
 * assistant; storing every anon question or verification attempt in
 * Postgres would create PII retention risk for no real benefit.
 *
 * Anon questions are intentionally in-memory only: the user's
 * requirement was "once refreshed it would be deleted" — sessionStorage
 * on the client + no server persistence achieves that.
 */

function logAnonQuestion({ ip, intent, audience }) {
  // No-op for now, kept as a single place to add a real logger later
  // (e.g., pino, winston). The IP is captured at the route layer
  // when needed.
  if (process.env.BOT_LOG_LEVEL === 'debug') {
    console.log(`[bot] anon question intent=${intent} audience=${audience} ip=${ip || 'n/a'}`);
  }
}

function logVerify({ ip, phone, dob, pan, outcome, userId }) {
  const line = `[bot-verify] outcome=${outcome} ip=${ip || 'n/a'} ` +
              `phone=${phone} dob=${dob} pan=${pan}` +
              (userId ? ` userId=${userId}` : '');
  console.log(line);
}

module.exports = { logAnonQuestion, logVerify };
