import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const localStub = path.join(root, 'supabase', 'local_auth_stub.sql');
const logPath = path.join(root, 'supabase', 'migrations_clean_run_log.txt');

const ADMIN_DB = process.env.DATABASE_ADMIN_URL || 'postgres://postgres:admin123@localhost:5432/postgres';
const TARGET_DB = process.env.TARGET_DB_NAME || 'migrations_test';

async function appendLog(line) {
  await fs.appendFile(logPath, line + '\n');
}

async function runFile(client, filePath) {
  const rel = path.relative(root, filePath);
  const header = `\n==== RUNNING ${rel} ====\n`;
  process.stdout.write(header);
  await appendLog(header);
  const sql = await fs.readFile(filePath, 'utf8');
  try {
    await client.query(sql);
    const ok = `-- OK: ${rel}`;
    process.stdout.write(ok + '\n');
    await appendLog(ok);
  } catch (err) {
    const errMsg = `-- ERROR in ${rel}: ${err && err.message ? err.message : err}`;
    process.stderr.write(errMsg + '\n');
    await appendLog(errMsg);
    throw err;
  }
}

async function createFreshDatabase() {
  const admin = new Client({ connectionString: ADMIN_DB });
  await admin.connect();
  try {
    // Terminate connections to target DB if any
    await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [TARGET_DB]);
    await admin.query(`DROP DATABASE IF EXISTS ${TARGET_DB}`);
    await admin.query(`CREATE DATABASE ${TARGET_DB}`);
    await appendLog(`Created fresh database ${TARGET_DB}`);
  } finally {
    await admin.end();
  }
}

async function run() {
  await fs.writeFile(logPath, `Clean migration run started: ${new Date().toISOString()}\n`);
  try {
    await createFreshDatabase();
    // Build target DB connection URL from admin URL reliably
    const adminUrl = new URL(ADMIN_DB);
    adminUrl.pathname = `/${TARGET_DB}`;
    const targetConn = adminUrl.toString();
    const client = new Client({ connectionString: targetConn });
    await client.connect();
    try {
      // Run local stub if present
      try { await fs.access(localStub); await runFile(client, localStub); } catch (_) {}

      const entries = await fs.readdir(migrationsDir);
      const sqlFiles = entries.filter(f => f.endsWith('.sql')).sort();
      for (const f of sqlFiles) {
        const p = path.join(migrationsDir, f);
        await runFile(client, p);
      }

      const finish = `\nClean migration run finished successfully: ${new Date().toISOString()}\n`;
      process.stdout.write(finish);
      await appendLog(finish);
    } finally {
      await client.end();
    }
  } catch (err) {
    const fail = `\nClean migration run failed: ${new Date().toISOString()}\n`;
    process.stderr.write(fail);
    await appendLog(fail);
    await appendLog(err && err.stack ? err.stack : String(err));
    process.exitCode = 1;
  }
}

run();
