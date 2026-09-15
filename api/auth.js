// Accounts for the tracker: username + password, session kept in an httpOnly cookie.
//
//   GET  /api/auth                                  -> 200 { user }  or  401
//   POST /api/auth { action:'signup', username, password }
//   POST /api/auth { action:'login',  username, password }
//   POST /api/auth { action:'logout' }

import {
  db, notConfigured, hashPassword, verifyPassword,
  newSession, currentUser, readToken, clearSession
} from './_db.js';
import crypto from 'node:crypto';

const NAME_RE = /^[a-z0-9._-]{3,32}$/;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (notConfigured(res)) return;

  try {
    const sql = await db();

    if (req.method === 'GET') {
      const user = await currentUser(sql, req);
      if (!user) return res.status(401).json({ error: 'auth', message: 'Not signed in.' });
      return res.status(200).json({ user: user.username });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'method', message: 'Use GET or POST.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = String(body.action || '');

    if (action === 'logout') {
      const token = readToken(req);
      if (token) await sql`delete from sessions where token = ${token}`;
      clearSession(res);
      return res.status(200).json({ ok: true });
    }

    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (action === 'signup') {
      if (!NAME_RE.test(username)) {
        return res.status(400).json({ error: 'username',
          message: 'Username: 3–32 characters, letters, numbers, dots, dashes or underscores.' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'password', message: 'Password needs at least 6 characters.' });
      }
      const taken = await sql`select 1 from users where username = ${username}`;
      if (taken.length) {
        return res.status(409).json({ error: 'taken', message: 'That username is already taken — sign in instead?' });
      }
      const id = 'u_' + crypto.randomBytes(12).toString('hex');
      await sql`insert into users (id, username, pass_hash) values (${id}, ${username}, ${hashPassword(password)})`;
      await newSession(sql, res, id);
      return res.status(200).json({ user: username, fresh: true });
    }

    if (action === 'login') {
      const rows = await sql`select id, pass_hash from users where username = ${username}`;
      if (!rows.length || !verifyPassword(password, rows[0].pass_hash)) {
        return res.status(401).json({ error: 'auth', message: 'Wrong username or password.' });
      }
      await newSession(sql, res, rows[0].id);
      return res.status(200).json({ user: username });
    }

    return res.status(400).json({ error: 'action', message: 'Unknown action.' });
  } catch (err) {
    return res.status(500).json({ error: 'server', message: String((err && err.message) || err) });
  }
}
