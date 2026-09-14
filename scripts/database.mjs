import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

const command = process.argv[2];
if (!['check', 'setup'].includes(command)) {
  console.error('Use npm run db:check or npm run db:setup.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Set it in the local .env file.');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

try {
  if (command === 'setup') {
    const queries = [];
    for (const file of ['001_initial.sql', '002_places.sql']) {
      const source = await readFile(new URL(`../db/${file}`, import.meta.url), 'utf8');
      // These checked-in migrations contain no functions or semicolons in literals.
      const statements = source
        .replace(/--[^\n]*/g, '')
        .split(';')
        .map((s) => s.trim());
      for (const statement of statements) {
        if (statement && !/^(BEGIN|COMMIT)$/i.test(statement)) queries.push(sql.query(statement));
      }
    }
    const snapshot = JSON.parse(
      await readFile(new URL('../src/lib/server/data/gangneung.json', import.meta.url), 'utf8')
    );
    const rows = snapshot.map((place, order) => ({ ...place, order }));
    queries.push(sql`
      INSERT INTO places (id, name, category, address, latitude, longitude, phone,
        description, policy, hours, source_url, imported_at, verified_at, source_weight, display_order)
      SELECT id, name, category, address, latitude, longitude, phone, description,
        policy, hours, "sourceUrl", "importedAt", "verifiedAt", "sourceWeight", "order"
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS p(
        id text, name text, category text, address text, latitude float8, longitude float8,
        phone text, description text, policy text, hours text, "sourceUrl" text,
        "importedAt" date, "verifiedAt" date, "sourceWeight" numeric, "order" integer)
      ON CONFLICT (id) DO NOTHING
    `);
    await sql.transaction(queries);
    console.log('Schema and initial Gangneung data are ready. Existing records were preserved.');
  }
  const [tables] = await sql`SELECT to_regclass('public.places') IS NOT NULL AS places_ready,
    to_regclass('public.app_users') IS NOT NULL AS users_ready,
    to_regclass('public.app_sessions') IS NOT NULL AS sessions_ready,
    to_regclass('public.dog_profiles') IS NOT NULL AS profiles_ready,
    to_regclass('public.favorites') IS NOT NULL AS favorites_ready`;
  console.log('Neon connection: OK');
  console.log('Tables:', tables);
  if (tables.places_ready) {
    const [counts] = await sql`SELECT count(*)::int AS places FROM places`;
    console.log('Place count:', counts.places);
  } else {
    console.log('Run npm run db:setup after selecting a dedicated DangveryWhere database.');
  }
} catch (failure) {
  // Driver errors can contain connection details: never print the raw exception.
  const code =
    typeof failure?.code === 'string' && /^[A-Z0-9]{5}$/.test(failure.code)
      ? failure.code
      : 'CONNECTION_OR_QUERY_FAILED';
  console.error(
    `Database operation failed (${code}). Check the connection and database permissions.`
  );
  process.exitCode = 1;
}
