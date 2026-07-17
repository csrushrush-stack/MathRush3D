import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { ZodError } from 'zod'
import { pool } from './db/pool'
import { leaderboardRouter } from './routes/leaderboard'
import { playersRouter } from './routes/players'
import { runsRouter } from './routes/runs'
import { authRouter } from './routes/auth'

const app = express()
const port = Number(process.env.PORT ?? 3001)
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())

app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json({ limit: '256kb' }))

app.get('/api/health', async (_request, response) => {
  const result = await pool.query('SELECT now() AS database_time')
  response.json({ status: 'ok', databaseTime: result.rows[0].database_time })
})
app.use('/api/auth', authRouter)
app.use('/api/players', playersRouter)
app.use('/api/runs', runsRouter)
app.use('/api/leaderboard', leaderboardRouter)

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    response.status(400).json({ error: 'Invalid request', issues: error.issues })
    return
  }
  console.error('[api] unhandled error', error)
  response.status(500).json({ error: 'Internal server error' })
})

const server = app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`)
})

const shutdown = (signal: string) => {
  console.log(`[api] received ${signal}; shutting down`)
  server.close(() => {
    pool.end().finally(() => process.exit(0))
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
