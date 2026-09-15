// The signed-in user's tracker data: one row per account in Neon Postgres.
//
//   GET  /api/state            -> { version, updated, state }   (version 0 = nothing stored yet)
//   PUT  /api/state            -> { baseVersion, state }
//                                 200 { version }               saved
//                                 409 { version, state }        another device saved first; here is its version
//
// Requests are authenticated by the session cookie set by /api/auth.

import { db, notConfigured, currentUser } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (notConfigured(res)) return;

  try {
    const sql = await db();

    const user = await currentUser(sql, req);
    if (!user) return res.status(401).json({ error: 'auth', message: 'Not signed in.' });
    const rowId = user.id;

    if (req.method === 'GET') {
      const rows = await sql`select version, updated, data from tracker_state where id = ${rowId}`;
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
        values (${rowId}, 1, now(), ${JSON.stringify(state)}::jsonb)
        on conflict (id) do update
          set version = tracker_state.version + 1,
              updated = now(),
              data    = excluded.data
          where tracker_state.version = ${baseVersion}
        returning version`;

      if (saved.length) return res.status(200).json({ version: saved[0].version });

      const current = await sql`select version, data from tracker_state where id = ${rowId}`;
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
