import express from 'express'
import dotenv from 'dotenv'
import { router as agentRouter } from './routes/agent.js'

dotenv.config()

const app = express()

// Core middlewares
app.use(express.json({ limit: '5mb' }))

// Request logging (method, url, status, duration)
app.use((req, res, next) => {
  const start = Date.now()
  const method = req.method
  const url = req.originalUrl
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || ''

  res.on('finish', () => {
    const duration = Date.now() - start
    const status = res.statusCode
    // eslint-disable-next-line no-console
    console.log(`[${new Date().toISOString()}] ${method} ${url} ${status} ${duration}ms ${ip}`)
  })

  next()
})

// Health and status endpoints
app.get('/healthz', (_req, res) => {
  res.status(200).send('ok')
})

app.get('/status', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

// Routes
app.use('/agent', agentRouter)

// Start server if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 3001)
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Stagehand server listening on :${port}`)
  })
}

export default app
