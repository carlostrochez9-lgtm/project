import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const localStub = path.join(root, 'supabase', 'local_auth_stub.sql');
const logPath = path.join(root, 'supabase', 'migrations_execution_log.txt');

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:admin123@localhost:5432/postgres';

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
    // Execute whole file content. Postgres supports multiple statements in a single query.
    const res = await client.query(sql);
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

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  // Ensure log file exists / truncate
  await fs.writeFile(logPath, `Migration run started: ${new Date().toISOString()}\n`);
  try {
    await client.connect();
    // Run local stub if present
    try {
      await fs.access(localStub);
      await runFile(client, localStub);
    } catch (_) {
      // no local stub present, continue
    }

    // Read migration files sorted by name
    const entries = await fs.readdir(migrationsDir);
    const sqlFiles = entries.filter(f => f.endsWith('.sql')).sort();
    for (const f of sqlFiles) {
      const p = path.join(migrationsDir, f);
      await runFile(client, p);
    }

    const finish = `\nMigration run finished successfully: ${new Date().toISOString()}\n`;
    process.stdout.write(finish);
    await appendLog(finish);
  } catch (err) {
    const fail = `\nMigration run failed: ${new Date().toISOString()}\n`;
    process.stderr.write(fail);
    await appendLog(fail);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
