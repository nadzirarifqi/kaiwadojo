/**
 * Backup darurat Supabase → folder lokal backups/<timestamp>/
 *
 * Isi backup:
 *  - public/<table>.json     : seluruh baris setiap tabel di schema public
 *  - auth_users.json         : akun login (termasuk hash bcrypt password)
 *  - schema/columns.json     : definisi kolom, tipe, default, nullable
 *  - schema/constraints.json : primary key, foreign key, unique
 *  - schema/indexes.json     : index
 *  - schema/policies.json    : aturan RLS (untuk di-port ke PHP)
 *  - schema/functions.json   : fungsi/RPC/trigger di schema public
 *  - schema/triggers.json
 *  - storage/objects.json    : daftar file storage
 *  - storage/<bucket>/...    : file storage yang diunduh
 *  - summary.json            : jumlah baris per tabel
 *
 * Jalankan:  node --env-file=scripts/.env scripts/backup_supabase.mjs
 */
import pg from 'pg'
import fs from 'node:fs/promises'
import path from 'node:path'

const DB_URL = process.env.SUPABASE_DB_URL
if (!DB_URL || DB_URL.includes('[YOUR-PASSWORD]')) {
  console.error('❌ SUPABASE_DB_URL belum diisi dengan benar di scripts/.env')
  process.exit(1)
}

// Project ref diambil dari username "postgres.<ref>"
const projectRef = new URL(DB_URL).username.split('.')[1]
const SUPABASE_URL = `https://${projectRef}.supabase.co`

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const OUT = path.resolve('backups', stamp)

// Kembalikan bigint/numeric sebagai string supaya presisi tidak hilang
pg.types.setTypeParser(20, v => v) // int8
pg.types.setTypeParser(1700, v => v) // numeric
// DATE/TIME/TIMESTAMP (tanpa zona) dibiarkan string mentah supaya tidak bergeser zona waktu lokal
pg.types.setTypeParser(1082, v => v) // date        → '2026-08-25'
pg.types.setTypeParser(1083, v => v) // time        → '19:30:00'
pg.types.setTypeParser(1114, v => v) // timestamp   → '2026-08-25 10:00:00'
// timestamptz → ISO UTC
pg.types.setTypeParser(1184, v => new Date(v).toISOString())

const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })

async function writeJson(rel, data) {
  const file = path.join(OUT, rel)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8')
}

async function q(sql, params = []) {
  return (await client.query(sql, params)).rows
}

async function main() {
  console.log(`🔌 Menghubungkan ke ${new URL(DB_URL).host} ...`)
  await client.connect()
  await fs.mkdir(OUT, { recursive: true })
  console.log(`📁 Output: ${OUT}\n`)

  const summary = { created_at: new Date().toISOString(), project_ref: projectRef, tables: {}, auth_users: 0, storage: {} }

  // ── 1. Skema ────────────────────────────────────────────────
  console.log('📐 Mengambil definisi skema...')
  await writeJson('schema/columns.json', await q(`
    SELECT table_name, column_name, ordinal_position, data_type, udt_name,
           is_nullable, column_default, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position`))

  await writeJson('schema/constraints.json', await q(`
    SELECT conrelid::regclass::text AS table_name, conname, contype,
           pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
    ORDER BY 1, 2`))

  await writeJson('schema/indexes.json', await q(`
    SELECT tablename, indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' ORDER BY 1, 2`))

  await writeJson('schema/policies.json', await q(`
    SELECT tablename, policyname, cmd, roles, permissive, qual, with_check
    FROM pg_policies WHERE schemaname = 'public' ORDER BY 1, 2`))

  await writeJson('schema/functions.json', await q(`
    SELECT p.proname AS name, pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
    ORDER BY 1`))

  await writeJson('schema/triggers.json', await q(`
    SELECT event_object_schema AS schema, event_object_table AS table_name,
           trigger_name, action_timing, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_schema IN ('public', 'auth')
    ORDER BY 2, 3`))

  // ── 2. Data tabel public ────────────────────────────────────
  const tables = (await q(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name`)).map(r => r.table_name)

  console.log(`\n📦 Backup ${tables.length} tabel public:`)
  for (const t of tables) {
    const rows = await q(`SELECT * FROM public."${t}"`)
    await writeJson(`public/${t}.json`, rows)
    summary.tables[t] = rows.length
    console.log(`   ✔ ${t.padEnd(32)} ${rows.length} baris`)
  }

  // ── 3. Akun auth ────────────────────────────────────────────
  console.log('\n👤 Backup auth.users...')
  const users = await q(`
    SELECT id, email, phone, encrypted_password, email_confirmed_at,
           raw_user_meta_data, raw_app_meta_data, role,
           created_at, updated_at, last_sign_in_at, banned_until, deleted_at
    FROM auth.users ORDER BY created_at`)
  await writeJson('auth_users.json', users)
  summary.auth_users = users.length
  const withHash = users.filter(u => u.encrypted_password).length
  console.log(`   ✔ ${users.length} akun (${withHash} dengan hash password)`)

  // ── 4. Storage ──────────────────────────────────────────────
  console.log('\n🖼️  Backup storage...')
  let buckets = []
  try {
    buckets = await q(`SELECT id, name, public FROM storage.buckets`)
    const objects = await q(`
      SELECT bucket_id, name, metadata, created_at, owner
      FROM storage.objects ORDER BY bucket_id, name`)
    await writeJson('storage/objects.json', { buckets, objects })

    for (const b of buckets) summary.storage[b.id] = { total: 0, downloaded: 0, failed: [] }
    for (const o of objects) {
      const s = summary.storage[o.bucket_id] ??= { total: 0, downloaded: 0, failed: [] }
      s.total++
      const url = `${SUPABASE_URL}/storage/v1/object/public/${o.bucket_id}/${o.name.split('/').map(encodeURIComponent).join('/')}`
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const file = path.join(OUT, 'storage', o.bucket_id, ...o.name.split('/'))
        await fs.mkdir(path.dirname(file), { recursive: true })
        await fs.writeFile(file, Buffer.from(await res.arrayBuffer()))
        s.downloaded++
      } catch (e) {
        s.failed.push({ name: o.name, error: String(e.message || e) })
      }
    }
    for (const [id, s] of Object.entries(summary.storage)) {
      console.log(`   ✔ bucket ${id}: ${s.downloaded}/${s.total} file diunduh${s.failed.length ? ` (${s.failed.length} gagal)` : ''}`)
    }
  } catch (e) {
    console.warn(`   ⚠ Storage tidak bisa dibaca: ${e.message}`)
    summary.storage_error = e.message
  }

  await writeJson('summary.json', summary)
  await client.end()

  const totalRows = Object.values(summary.tables).reduce((a, b) => a + b, 0)
  console.log(`\n✅ Backup selesai: ${tables.length} tabel, ${totalRows} baris, ${users.length} akun.`)
  console.log(`   Lokasi: ${OUT}`)
}

main().catch(async e => {
  console.error('\n❌ Backup gagal:', e.message)
  if (/password authentication failed/i.test(e.message)) {
    console.error('   → Password di scripts/.env salah. Reset lagi di Project Settings → Database.')
  }
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED/i.test(e.message)) {
    console.error('   → Tidak bisa terhubung. Cek koneksi internet / host pooler di scripts/.env.')
  }
  try { await client.end() } catch {}
  process.exit(1)
})
