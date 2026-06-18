import express from 'express'
import http from 'http'
import { Server as SocketServer } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'

import { env } from '@/config/env'
import { apiLimiter } from '@/middlewares/rateLimiter'
import { errorHandler, notFound } from '@/middlewares/error.middleware'
import routes from '@/routes/index'

const app = express()
const httpServer = http.createServer(app)

// ─── Socket.io ───────────────────────────────────────────────────────────────
export const io = new SocketServer(httpServer, {
  cors: { origin: env.CLIENT_URL, credentials: true },
})

io.on('connection', (socket) => {
  socket.on('rest:start', ({ duration }: { duration: number }) => {
    setTimeout(() => socket.emit('rest:done'), duration * 1000)
  })
})

// ─── Global middleware ────────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({ origin: env.CLIENT_URL, credentials: true }))
app.use(compression())
app.use(express.json({ limit: '10kb' }))
app.use('/api', apiLimiter)

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api', routes)

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

// ─── Start ────────────────────────────────────────────────────────────────────
httpServer.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`)
})
