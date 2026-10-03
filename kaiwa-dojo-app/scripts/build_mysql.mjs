/**
 * Generator MySQL/MariaDB dari hasil backup Supabase.
 *
 * Input : backups/<terbaru>/  (hasil scripts/backup_supabase.mjs)
 * Output:
 *   database/mysql_schema.sql   – DDL lengkap (MariaDB 10.3+)
 *   database/data_import.sql    – INSERT seluruh data + akun user
 *   api/lib/schema.json         – metadata tabel/kolom untuk backend PHP
 *
 * Jalankan: node scripts/build_mysql.mjs [path-backup-opsional]
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('.')
const backupDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, 'backups', fs.readdirSync(path.join(ROOT, 'backups')).filter(d => !d.startsWith('.')).sort().pop())

const read = rel => JSON.parse(fs.readFileSync(path.join(backupDir, rel), 'utf8'))
console.log(`📂 Backup: ${backupDir}`)

const columns = read('schema/columns.json')
const constraints = read('schema/constraints.json')
const indexes = read('schema/indexes.json')
const authUsers = read('auth_users.json')

// Tabel legacy yang tidak dipakai aplikasi tetap dibuat supaya skema setara
const tables = [...new Set(columns.map(c => c.table_name))].sort()

// ── Helper parsing ───────────────────────────────────────────
const colList = s => s.split(',').map(x => x.trim().replace(/"/g, '').replace(/\s+(ASC|DESC)$/i, ''))
const parseCols = def => colList(def.match(/\(([^)]+)\)/)[1])

const pkOf = {}, uniquesOf = {}, fksOf = {}, indexedCols = {}
const markIndexed = (t, cols) => cols.forEach(c => ((indexedCols[t] ??= new Set()).add(c)))

for (const c of constraints) {
  const t = c.table_name.replace(/^public\./, '')
  if (c.contype === 'p') { pkOf[t] = parseCols(c.definition); markIndexed(t, pkOf[t]) }
  if (c.contype === 'u') { (uniquesOf[t] ??= []).push(parseCols(c.definition)); markIndexed(t, parseCols(c.definition)) }
  if (c.contype === 'f') {
    const m = c.definition.match(/FOREIGN KEY \(([^)]+)\) REFERENCES ([\w.]+)\(([^)]+)\)(.*)/)
    let refTable = m[2].replace(/^public\./, '')
    if (refTable === 'auth.users') refTable = 'users'
    ;(fksOf[t] ??= []).push({ cols: colList(m[1]), refTable, refCols: colList(m[3]), rest: m[4].trim() })
    markIndexed(t, colList(m[1]))
  }
}

const extraIndexes = {}
for (const ix of indexes) {
  if (/_pkey$/.test(ix.indexname)) continue
  const t = ix.tablename
  const cols = parseCols(ix.indexdef.slice(ix.indexdef.indexOf(' ON ')))
  markIndexed(t, cols)
  const unique = /UNIQUE/.test(ix.indexdef)
  // Lewati index yang sudah tercakup oleh constraint UNIQUE
  if (unique && (uniquesOf[t] || []).some(u => u.join() === cols.join())) continue
  ;(extraIndexes[t] ??= []).push({ name: ix.indexname, cols, unique })
}

// ── Mapping tipe ─────────────────────────────────────────────
function logicalType(c) {
  const u = c.udt_name
  if (u === 'uuid') return 'uuid'
  if (u === 'bool') return 'bool'
  if (u === 'int2' || u === 'int4') return 'int'
  if (u === 'int8') return 'bigint'
  if (u === 'numeric' || u === 'float4' || u === 'float8') return 'decimal'
  if (u === 'timestamptz' || u === 'timestamp') return 'datetime'
  if (u === 'date') return 'date'
  if (u === 'time' || u === 'timetz') return 'time'
  if (u === 'json' || u === 'jsonb' || u.startsWith('_')) return 'json'
  return 'text' // text, varchar, enum (USER-DEFINED)
}

function sqlType(c, t) {
  const lt = logicalType(c)
  const indexed = indexedCols[t]?.has(c.column_name)
  switch (lt) {
    case 'uuid': return 'CHAR(36)'
    case 'bool': return 'TINYINT(1)'
    case 'int': return 'INT'
    case 'bigint': return 'BIGINT'
    case 'decimal': return 'DECIMAL(12,2)'
    case 'datetime': return 'DATETIME(3)'
    case 'date': return 'DATE'
    case 'time': return 'TIME'
    case 'json': return 'LONGTEXT'
    default:
      if (c.data_type === 'USER-DEFINED') return 'VARCHAR(32)'
      return indexed ? 'VARCHAR(255)' : 'TEXT'
  }
}

/** Return { sql: 'DEFAULT ...' | '', kind: 'uuid'|'now'|'today'|null, value } */
function mapDefault(c) {
  const d = c.column_default
  if (d == null) return { sql: '', kind: null }
  const lt = logicalType(c)
  if (/uuid_generate_v4|gen_random_uuid/.test(d)) return { sql: '', kind: 'uuid' }
  if (/^now\(\)|CURRENT_TIMESTAMP/i.test(d)) return { sql: 'DEFAULT CURRENT_TIMESTAMP(3)', kind: 'now' }
  if (/CURRENT_DATE/i.test(d)) return { sql: '', kind: 'today' }
  if (lt === 'bool') return { sql: `DEFAULT ${d === 'true' ? 1 : 0}`, kind: null, value: d === 'true' }
  const lit = d.match(/^'(.*)'::/s)
  let v = lit ? lit[1].replace(/''/g, "'") : d
  if (lt === 'json') {
    if (v === '{}' && c.udt_name.startsWith('_')) v = '[]' // array kosong Postgres
    return { sql: '', kind: 'json', value: JSON.parse(v) } // LONGTEXT default diisi PHP
  }
  if (lt === 'int' || lt === 'bigint' || lt === 'decimal') return { sql: `DEFAULT ${Number(v)}`, kind: null, value: Number(v) }
  return { sql: `DEFAULT ${sqlStr(v)}`, kind: null, value: v }
}

function sqlStr(v) {
  return "'" + String(v)
    .replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\x1a/g, '\\Z') + "'"
}

// ── DDL ──────────────────────────────────────────────────────
const meta = { generated_at: new Date().toISOString(), tables: {} }
let ddl = `-- Kaiwa Dojo — skema MariaDB 10.3+ (hasil konversi otomatis dari Supabase)
-- Dibuat: ${meta.generated_at}
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── Pengganti auth.users ─────────────────────────────────────
DROP TABLE IF EXISTS \`users\`;
CREATE TABLE \`users\` (
  \`id\` CHAR(36) NOT NULL,
  \`email\` VARCHAR(255) NOT NULL,
  \`password_hash\` VARCHAR(255) NULL,
  \`raw_user_meta_data\` LONGTEXT NULL,
  \`email_confirmed_at\` DATETIME(3) NULL,
  \`last_sign_in_at\` DATETIME(3) NULL,
  \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`users_email_key\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Sesi login (refresh token) ───────────────────────────────
DROP TABLE IF EXISTS \`auth_sessions\`;
CREATE TABLE \`auth_sessions\` (
  \`id\` CHAR(36) NOT NULL,
  \`user_id\` CHAR(36) NOT NULL,
  \`refresh_token_hash\` CHAR(64) NOT NULL,
  \`user_agent\` VARCHAR(255) NULL,
  \`ip\` VARCHAR(64) NULL,
  \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`expires_at\` DATETIME(3) NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`auth_sessions_token\` (\`refresh_token_hash\`),
  KEY \`auth_sessions_user\` (\`user_id\`),
  CONSTRAINT \`auth_sessions_user_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Rate limit login ─────────────────────────────────────────
DROP TABLE IF EXISTS \`login_attempts\`;
CREATE TABLE \`login_attempts\` (
  \`id\` BIGINT NOT NULL AUTO_INCREMENT,
  \`identifier\` VARCHAR(255) NOT NULL,
  \`ip\` VARCHAR(64) NOT NULL,
  \`attempted_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  KEY \`login_attempts_lookup\` (\`identifier\`, \`attempted_at\`),
  KEY \`login_attempts_ip\` (\`ip\`, \`attempted_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Log perubahan untuk realtime (polling) ───────────────────
DROP TABLE IF EXISTS \`change_log\`;
CREATE TABLE \`change_log\` (
  \`id\` BIGINT NOT NULL AUTO_INCREMENT,
  \`table_name\` VARCHAR(64) NOT NULL,
  \`event\` VARCHAR(10) NOT NULL,
  \`new_row\` LONGTEXT NULL,
  \`old_row\` LONGTEXT NULL,
  \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  KEY \`change_log_created\` (\`created_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`

for (const t of tables) {
  const cols = columns.filter(c => c.table_name === t).sort((a, b) => a.ordinal_position - b.ordinal_position)
  const lines = []
  const tmeta = { pk: pkOf[t] || [], unique: uniquesOf[t] || [], columns: {} }

  for (const c of cols) {
    const def = mapDefault(c)
    const nullable = c.is_nullable === 'YES'
    lines.push(`  \`${c.column_name}\` ${sqlType(c, t)} ${nullable ? 'NULL' : 'NOT NULL'}${def.sql ? ' ' + def.sql : ''}`)
    tmeta.columns[c.column_name] = {
      type: logicalType(c),
      nullable,
      ...(def.kind ? { default: def.kind } : {}),
      ...(def.value !== undefined ? { default_value: def.value } : {}),
    }
    if (def.kind === 'json') tmeta.columns[c.column_name].default = 'value'
  }
  if (pkOf[t]) lines.push(`  PRIMARY KEY (${pkOf[t].map(c => `\`${c}\``).join(', ')})`)
  for (const u of uniquesOf[t] || []) lines.push(`  UNIQUE KEY \`${t}_${u.join('_')}_key\` (${u.map(c => `\`${c}\``).join(', ')})`)
  for (const ix of extraIndexes[t] || []) lines.push(`  ${ix.unique ? 'UNIQUE ' : ''}KEY \`${ix.name}\` (${ix.cols.map(c => `\`${c}\``).join(', ')})`)
  for (const [i, fk] of (fksOf[t] || []).entries()) {
    lines.push(`  CONSTRAINT \`${t}_fk${i + 1}\` FOREIGN KEY (${fk.cols.map(c => `\`${c}\``).join(', ')}) REFERENCES \`${fk.refTable}\` (${fk.refCols.map(c => `\`${c}\``).join(', ')}) ${fk.rest}`.trimEnd())
  }

  ddl += `\n-- ── ${t} ${'─'.repeat(Math.max(0, 52 - t.length))}\nDROP TABLE IF EXISTS \`${t}\`;\nCREATE TABLE \`${t}\` (\n${lines.join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`
  meta.tables[t] = tmeta
}
ddl += '\nSET FOREIGN_KEY_CHECKS = 1;\n'

// ── Data ─────────────────────────────────────────────────────
function toSqlValue(v, type) {
  if (v === null || v === undefined) return 'NULL'
  switch (type) {
    case 'bool': return v ? '1' : '0'
    case 'int': case 'bigint': case 'decimal': return String(Number(v))
    case 'json': return sqlStr(JSON.stringify(v))
    case 'datetime': {
      const d = new Date(v)
      if (isNaN(d)) return 'NULL'
      return sqlStr(d.toISOString().replace('T', ' ').replace('Z', ''))
    }
    case 'date': return sqlStr(String(v).slice(0, 10))
    default: return sqlStr(v)
  }
}

let data = `-- Kaiwa Dojo — data hasil migrasi dari Supabase
-- Sumber backup: ${path.basename(backupDir)}
SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;
START TRANSACTION;
`
const counts = {}

// Users (auth)
const userCols = ['id', 'email', 'password_hash', 'raw_user_meta_data', 'email_confirmed_at', 'last_sign_in_at', 'created_at', 'updated_at']
const userTypes = ['uuid', 'text', 'text', 'json', 'datetime', 'datetime', 'datetime', 'datetime']
if (authUsers.length) {
  data += `\nDELETE FROM \`users\`;\n`
  const rows = authUsers.map(u => [u.id, (u.email || `${u.id}@no-email.local`).toLowerCase(), u.encrypted_password || null, u.raw_user_meta_data || {}, u.email_confirmed_at, u.last_sign_in_at, u.created_at, u.updated_at || u.created_at])
  data += `INSERT INTO \`users\` (${userCols.map(c => `\`${c}\``).join(', ')}) VALUES\n` +
    rows.map(r => '(' + r.map((v, i) => toSqlValue(v, userTypes[i])).join(', ') + ')').join(',\n') + ';\n'
  counts.users = rows.length
}

for (const t of tables) {
  const file = path.join(backupDir, 'public', `${t}.json`)
  if (!fs.existsSync(file)) continue
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'))
  counts[t] = rows.length
  data += `\nDELETE FROM \`${t}\`;\n`
  if (!rows.length) continue
  const cols = Object.keys(meta.tables[t].columns)
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    data += `INSERT INTO \`${t}\` (${cols.map(c => `\`${c}\``).join(', ')}) VALUES\n` +
      chunk.map(r => '(' + cols.map(c => toSqlValue(r[c], meta.tables[t].columns[c].type)).join(', ') + ')').join(',\n') + ';\n'
  }
}
data += '\nCOMMIT;\nSET FOREIGN_KEY_CHECKS = 1;\n'

// ── Tulis output ─────────────────────────────────────────────
fs.mkdirSync(path.join(ROOT, 'database'), { recursive: true })
fs.mkdirSync(path.join(ROOT, 'api', 'lib'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'database', 'mysql_schema.sql'), ddl, 'utf8')
fs.writeFileSync(path.join(ROOT, 'database', 'data_import.sql'), data, 'utf8')
fs.writeFileSync(path.join(ROOT, 'api', 'lib', 'schema.json'), JSON.stringify(meta, null, 2), 'utf8')

console.log(`✅ database/mysql_schema.sql  (${tables.length} tabel + 4 tabel sistem)`)
console.log(`✅ database/data_import.sql   (${Object.values(counts).reduce((a, b) => a + b, 0)} baris)`)
console.log(`✅ api/lib/schema.json`)
console.table(counts)
