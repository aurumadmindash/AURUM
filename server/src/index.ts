import app from './app'

const PORT = process.env.PORT || 5000

// Local development listener. Vercel imports src/app.ts directly and runs
// scheduled notifications through /api/cron/overdue in vercel.json.

app.listen(PORT, () => {
  console.log(`Aurum Project Controls API - port ${PORT}`)
})

export default app
