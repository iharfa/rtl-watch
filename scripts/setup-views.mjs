// One-off: create the analyst trend views in Neon and sanity-check uploads.
// Usage: node scripts/setup-views.mjs  (reads .env.local)
import fs from 'node:fs';
import { neon } from '@neondatabase/serverless';

const env = fs.readFileSync('.env.local', 'utf8');
const m = env.match(/^DATABASE_URL="?([^"\r\n]+)/m) ?? env.match(/^POSTGRES_URL="?([^"\r\n]+)/m);
if (!m) throw new Error('no DATABASE_URL/POSTGRES_URL in .env.local');
const sql = neon(m[1]);

const views = fs
  .readFileSync('db/schema.sql', 'utf8')
  .split(/;\s*(?:\r?\n|$)/)
  .filter((s) => s.includes('create or replace view'));
for (const v of views) await sql.query(v);

const trips = await sql.query('select count(*)::int as trips, coalesce(sum(fix_count),0)::int as fixes from trips');
const rates = await sql.query('select * from segment_rates');
console.log(JSON.stringify({ viewsCreated: views.length, ...trips[0], segment_rates: rates }, null, 1));
