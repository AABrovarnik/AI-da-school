import { useEffect, useState } from 'react'

type Health = {
  ok: boolean
  service: string
  message: string
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then(setHealth)
      .catch((err: Error) => setError(err.message))
  }, [])

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">AI-da-school</p>
        <h1>Web-школа вайбкодинга для детей 10–14 лет</h1>
        <p className="lead">
          Стартовый каркас React + TypeScript + Node.js готов. Следующий этап —
          реализовать уроки, проекты, прогресс и AI-наставника по материалам из
          <code> dev-package/</code>.
        </p>
        <div className="status-card">
          <strong>Frontend:</strong> работает
          <br />
          <strong>Backend:</strong>{' '}
          {health ? `${health.message}` : error ? `ошибка: ${error}` : 'проверяю…'}
        </div>
      </section>
    </main>
  )
}
