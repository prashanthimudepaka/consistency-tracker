// Shared helpers for the auth and state functions.
// The leading underscore keeps Vercel from exposing this file as its own endpoint.

import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

export const CONNECTION =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  '';

const COOKIE = 'ct365_session';
const YEAR = 365 * 24 * 60 * 60;

let schemaReady = false;

export async function db() {
  const sql = neon(CONNECTION);
  if (!schemaReady) {
    await sql`create table if not exists tracker_users (
      id        text        primary key,
      username  text        not null unique,
      pass_hash text        not null,
      created   timestamptz not null default now()
    )`;
    await sql`create table if not exists tracker_sessions (
      token   text        primary key,
      user_id text        not null,
      created timestamptz not null default now()
    )`;
    await sql`create table if not exists tracker_state (
      id      text        primary key,
      version integer     not null default 1,
      updated timestamptz not null default now(),
      data    jsonb       not null
    )`;
    schemaReady = true;
  }
  return sql;
}

export function notConfigured(res) {
  if (CONNECTION) return false;
  res.status(503).json({
    error: 'setup',
    message: 'No database URL found. Connect a Neon database in Vercel → Storage (it sets DATABASE_URL), then redeploy.'
  });
  return true;
}

// ---- passwords: scrypt with a per-user salt ----

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return salt + ':' + hash;
}

export function verifyPassword(password, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 2) return false;
  const test = crypto.scryptSync(password, parts[0], 32);
  const good = Buffer.from(parts[1], 'hex');
  return test.length === good.length && crypto.timingSafeEqual(test, good);
}

// ---- sessions: a random token in an httpOnly cookie, stored in the database ----

export function readToken(req) {
  const m = String(req.headers.cookie || '').match(
    new RegExp('(?:^|;\\s*)' + COOKIE + '=([A-Za-z0-9]+)')
  );
  return m ? m[1] : '';
}

export function setSession(res, token) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${YEAR}`);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export async function newSession(sql, res, userId) {
  const token = crypto.randomBytes(32).toString('base64url').replace(/[^A-Za-z0-9]/g, '');
  await sql`insert into tracker_sessions (token, user_id) values (${token}, ${userId})`;
  setSession(res, token);
}

export async function currentUser(sql, req) {
  const token = readToken(req);
  if (!token) return null;
  const rows = await sql`
    select u.id, u.username
    from tracker_sessions s join tracker_users u on u.id = s.user_id
    where s.token = ${token}`;
  return rows.length ? rows[0] : null;
}
