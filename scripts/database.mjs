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
    for (const file of [
      '001_initial.sql',
      '002_places.sql',
      '003_food_kind.sql',
      '004_multiple_dogs.sql',
      '005_region_favorites.sql',
      '006_menu.sql',
      '007_kto_pet_tour.sql',
      '008_dog_characters.sql'
    ]) {
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
      INSERT INTO places (id, name, category, food_kind, address, latitude, longitude, phone,
        description, policy, hours, menu, source_url, imported_at, verified_at, source_weight,
        display_order)
      SELECT id, name, category, "foodKind", address, latitude, longitude, phone, description,
        policy, hours, menu, "sourceUrl", "importedAt", "verifiedAt", "sourceWeight", "order"
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS p(
        id text, name text, category text, "foodKind" text, address text, latitude float8,
        longitude float8, phone text, description text, policy text, hours text, menu text,
        "sourceUrl" text, "importedAt" date, "verifiedAt" date, "sourceWeight" numeric,
        "order" integer)
      ON CONFLICT (id) DO NOTHING
    `);
    // 이미 들어 있던 행에는 위 INSERT 가 닿지 않으므로, 스냅샷이 다시 적어 준 칸만 따로 맞춥니다.
    // policy 는 관광공사 원본의 동반 규정을 합칠 때 스냅샷에서 바뀝니다(scripts/merge-kto-pet-tour.mjs).
    // 업체에 직접 확인한 문장을 DB 에서 손으로 고쳤다면 이 UPDATE 가 덮어씁니다.
    // 지금은 verified_at 이 전부 비어 있어 그런 행이 없지만, 확인을 시작하면 조건을 좁혀야 합니다.
    queries.push(sql`
      UPDATE places AS target
      SET food_kind = source."foodKind", menu = source.menu, policy = source.policy
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
        AS source(id text, "foodKind" text, menu text, policy text)
      WHERE target.id = source.id
        AND target.verified_at IS NULL
        AND (target.food_kind IS DISTINCT FROM source."foodKind"
          OR target.menu IS DISTINCT FROM source.menu
          OR target.policy IS DISTINCT FROM source.policy)
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
