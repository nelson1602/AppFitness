import express from 'express'
import http from 'http'
import path from 'path'
import { Server as SocketServer } from 'socket.io'
import jwt from 'jsonwebtoken'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'

import { env } from '@/config/env'
import { setSocketServer } from '@/config/socket'
import { startReevaluationJob } from '@/jobs/reevaluation.job'
import { apiLimiter } from '@/middlewares/rateLimiter'
import { errorHandler, notFound } from '@/middlewares/error.middleware'
import routes from '@/routes/index'

const app = express()
const httpServer = http.createServer(app)

// ─── Socket.io ───────────────────────────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: { origin: env.CLIENT_URL, credentials: true },
})
setSocketServer(io)

// Authenticate socket connections with JWT
io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined
  if (!token) return next(new Error('Unauthorized'))
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { userId: string }
    socket.data.userId = payload.userId
    next()
  } catch {
    next(new Error('Unauthorized'))
  }
})

io.on('connection', (socket) => {
  void socket.join(`user:${socket.data.userId as string}`)

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

// ─── Production: serve client build ──────────────────────────────────────────
if (env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist')
  app.use(express.static(clientDist))
  // SPA fallback — serve index.html for all non-API GET requests
  app.get(/^(?!\/api).*$/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

// ─── Start ────────────────────────────────────────────────────────────────────
httpServer.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`)
  startReevaluationJob()
})
