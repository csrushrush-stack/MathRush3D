import 'dotenv/config'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { pool } from './pool'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const migrationsDirectory = path.join(currentDirectory, 'migrations')

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const existing = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file])
      if (existing.rowCount) continue
      const sql = await readFile(path.join(migrationsDirectory, file), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
        console.log(`[database] applied ${file}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((error) => {
  console.error('[database] migration failed', error)
  process.exitCode = 1
})
