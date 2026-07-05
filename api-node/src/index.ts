import './config/env.js'  // load ENV first
import { ENV } from './config/env.js'
import app from './app.js'

/* ── Start ────────────────────────────────────────────────── */
app.listen(ENV.PORT, () => {
  console.log(`[Server] Running on http://localhost:${ENV.PORT}`)
  console.log(`[Server] Env: ${ENV.NODE_ENV}`)
})

export default app
