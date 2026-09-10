import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
const port = Number(process.env.PORT ?? 3001)

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'ai-da-school-api',
    message: 'Node.js API работает',
  })
})

app.post('/api/ai/chat', async (_req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      ok: false,
      error: 'GEMINI_API_KEY is not configured',
    })
  }

  return res.status(501).json({
    ok: false,
    error: 'Gemini integration is reserved for the next implementation step',
  })
})

app.listen(port, () => {
  console.log(`AI-da-school API: http://localhost:${port}`)
})
