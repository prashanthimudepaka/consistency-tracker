// Single source of truth for the tracker: one row in Neon Postgres.
//
//   GET  /api/state            -> { version, updated, state }   (version 0 = nothing stored yet)
//   PUT  /api/state            -> { baseVersion, state }
//                                 200 { version }               saved
//                                 409 { version, state }        someone else saved first; here is theirs
//
// Every request must carry the passcode in an `x-passcode` header, checked against
// the APP_PASSCODE environment variable. Without both env vars set the API refuses
// to do anything rather than exposing the data.

import { neon } from '@neondatabase/serverless';

const CONNECTION =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  '';

const ROW_ID = 'default';
let schemaReady = false;

async function db() {
  const sql = neon(CONNECTION);
  if (!schemaReady) {
    await sql`create table if not exists tracker_state (
      id      text primary key,
      version integer      not null default 1,
      updated timestamptz  not null default now(),
      data    jsonb        not null
    )`;
    schemaReady = true;
  }
  return sql;
}

// length-independent comparison so the passcode can't be guessed a character at a time
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const passcode = process.env.APP_PASSCODE || '';
  if (!passcode) {
    return res.status(503).json({
      error: 'setup',
      message: 'APP_PASSCODE is not set on this deployment. Add it in Vercel → Settings → Environment Variables, then redeploy.'
    });
  }
  if (!CONNECTION) {
    return res.status(503).json({
      error: 'setup',
      message: 'No database URL found. Connect a Neon database in Vercel → Storage (it sets DATABASE_URL), then redeploy.'
    });
  }
  if (!sameSecret(String(req.headers['x-passcode'] || ''), passcode)) {
    return res.status(401).json({ error: 'passcode', message: 'Wrong or missing passcode.' });
  }

  try {
    const sql = await db();

    if (req.method === 'GET') {
      const rows = await sql`select version, updated, data from tracker_state where id = ${ROW_ID}`;
      if (!rows.length) return res.status(200).json({ version: 0, updated: null, state: null });
      return res.status(200).json({
        version: rows[0].version,
        updated: rows[0].updated,
        state: rows[0].data
      });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const state = body.state;
      const baseVersion = Number(body.baseVersion || 0);
      if (!state || typeof state !== 'object') {
        return res.status(400).json({ error: 'bad-body', message: 'Expected { baseVersion, state }.' });
      }

      // Insert when there is no row yet; otherwise only overwrite if nobody else has
      // saved since the version this client last read.
      const saved = await sql`
        insert into tracker_state (id, version, updated, data)
        values (${ROW_ID}, 1, now(), ${JSON.stringify(state)}::jsonb)
        on conflict (id) do update
          set version = tracker_state.version + 1,
              updated = now(),
              data    = excluded.data
          where tracker_state.version = ${baseVersion}
        returning version`;

      if (saved.length) return res.status(200).json({ version: saved[0].version });

      const current = await sql`select version, data from tracker_state where id = ${ROW_ID}`;
      return res.status(409).json({
        error: 'conflict',
        version: current[0].version,
        state: current[0].data
      });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method', message: 'Use GET or PUT.' });
  } catch (err) {
    return res.status(500).json({ error: 'server', message: String((err && err.message) || err) });
  }
}
