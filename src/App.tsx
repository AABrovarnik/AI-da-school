import { FormEvent, useEffect, useMemo, useState } from 'react'

type Role = 'admin' | 'client'
type ThreadStatus = 'new' | 'in_progress' | 'closed'

type SafeUser = {
  id: string
  login: string
  role: Role
}

type BusinessData = {
  name: string
  description: string
  programs: string
  ageAudience: string
  prices: string
  timezone: string
  hours: string
  format: string
  contacts: string
  enrollmentLink: string
  faq: string
}

type DraftConfig = {
  businessData: BusinessData
  promptText: string
  greeting: string
  allowedTopics: string
  modelKey: 'gpt-6-sol'
  updatedAt: string
  updatedBy: string
}

type Thread = {
  id: string
  status: ThreadStatus
  needsHuman: boolean
  ownerType: 'user' | 'guest'
  updatedAt: string
  createdAt: string
  preview?: string
}

type Message = {
  id: string
  threadId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  latencyMs: number | null
}

type Version = {
  id: string
  publishedAt: string
  reason: string
  publishedBy: string
  modelKey: 'gpt-6-sol'
}

type Overview = {
  model: string
  providerKeyConfigured: boolean
  published: boolean
  lastPublishedAt: string | null
  totalThreads: number
  newRequests: number
  draftUpdatedAt: string
}

const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  const payload = await response.json()
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error ?? `HTTP ${response.status}`)
  }
  return payload as T
}

const statusLabel: Record<ThreadStatus, string> = {
  new: 'новое',
  in_progress: 'в работе',
  closed: 'закрыто',
}

export default function App() {
  const [activeView, setActiveView] = useState<'public' | 'admin'>('public')
  const [user, setUser] = useState<SafeUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [globalError, setGlobalError] = useState('')

  useEffect(() => {
    api<{ ok: true; user: SafeUser | null }>('/api/auth/me')
      .then((payload) => setUser(payload.user))
      .catch((error: Error) => setGlobalError(error.message))
      .finally(() => setLoading(false))
  }, [])

  const onAuthChanged = (nextUser: SafeUser | null) => {
    setUser(nextUser)
    setGlobalError('')
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI-da-school</p>
          <h1>Школа + админка</h1>
        </div>
        <div className="topbar-actions">
          <button className={activeView === 'public' ? 'tab active' : 'tab'} onClick={() => setActiveView('public')}>
            Публичный чат
          </button>
          <button className={activeView === 'admin' ? 'tab active' : 'tab'} onClick={() => setActiveView('admin')}>
            Админка
          </button>
          <AuthWidget user={user} onAuthChanged={onAuthChanged} />
        </div>
      </header>

      {loading ? <p className="card">Загрузка…</p> : null}
      {globalError ? <p className="card error">{globalError}</p> : null}

      {!loading && activeView === 'public' ? <PublicChat user={user} /> : null}
      {!loading && activeView === 'admin' ? <AdminPanel user={user} onAuthChanged={onAuthChanged} /> : null}
    </main>
  )
}

function AuthWidget({ user, onAuthChanged }: { user: SafeUser | null; onAuthChanged: (user: SafeUser | null) => void }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload = await api<{ ok: true; user: SafeUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      })
      setPassword('')
      onAuthChanged(payload.user)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    setBusy(true)
    try {
      await api('/api/auth/logout', { method: 'POST' })
      onAuthChanged(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (user) {
    return (
      <div className="auth-pill">
        <span>{user.login} ({user.role})</span>
        <button onClick={logout} disabled={busy}>Выйти</button>
      </div>
    )
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <input value={login} onChange={(event) => setLogin(event.target.value)} placeholder="логин" />
      <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="пароль" type="password" />
      <button disabled={busy}>{busy ? '...' : 'Войти'}</button>
      {error ? <span className="inline-error">{error}</span> : null}
    </form>
  )
}

function PublicChat({ user }: { user: SafeUser | null }) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const activeThread = useMemo(() => threads.find((thread) => thread.id === activeThreadId) ?? null, [threads, activeThreadId])

  const loadThreads = async () => {
    try {
      const payload = await api<{ ok: true; threads: Thread[] }>('/api/chat/threads')
      setThreads(payload.threads)
      if (!activeThreadId && payload.threads[0]) setActiveThreadId(payload.threads[0].id)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const loadMessages = async (threadId: string) => {
    try {
      const payload = await api<{ ok: true; messages: Message[] }>(`/api/chat/threads/${threadId}/messages`)
      setMessages(payload.messages)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  useEffect(() => {
    void loadThreads()
  }, [])

  useEffect(() => {
    if (!activeThreadId) return
    void loadMessages(activeThreadId)
  }, [activeThreadId])

  const createThread = async () => {
    setBusy(true)
    setError('')
    try {
      const payload = await api<{ ok: true; thread: Thread }>('/api/chat/threads', { method: 'POST', body: JSON.stringify({}) })
      setThreads((current) => [payload.thread, ...current])
      setActiveThreadId(payload.thread.id)
      setMessages([])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault()
    if (!activeThreadId || !input.trim()) return
    setBusy(true)
    setError('')
    const userMessage: Message = {
      id: `tmp-${Date.now()}`,
      threadId: activeThreadId,
      role: 'user',
      content: input.trim(),
      createdAt: new Date().toISOString(),
      latencyMs: null,
    }
    setMessages((current) => [...current, userMessage])
    const prompt = input
    setInput('')

    try {
      const payload = await api<{ ok: true; message: Message; thread: Thread }>(`/api/chat/threads/${activeThreadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: prompt }),
      })
      setMessages((current) => [...current.filter((item) => !item.id.startsWith('tmp-')), payload.message])
      setThreads((current) => current.map((item) => (item.id === payload.thread.id ? payload.thread : item)))
    } catch (err) {
      setError((err as Error).message)
      setMessages((current) => current.filter((item) => item.id !== userMessage.id))
      setInput(prompt)
    } finally {
      setBusy(false)
      void loadMessages(activeThreadId)
      void loadThreads()
    }
  }

  return (
    <section className="layout-two">
      <aside className="card sidebar">
        <h2>Диалоги</h2>
        <p className="muted">{user ? `Вы вошли как ${user.login}` : 'Гостевой режим включен'}</p>
        <button onClick={createThread} disabled={busy}>Новый диалог</button>
        <div className="list">
          {threads.map((thread) => (
            <button key={thread.id} className={thread.id === activeThreadId ? 'list-item active' : 'list-item'} onClick={() => setActiveThreadId(thread.id)}>
              <strong>{statusLabel[thread.status]}</strong>
              <span>{new Date(thread.updatedAt).toLocaleString('ru-RU')}</span>
            </button>
          ))}
          {threads.length === 0 ? <p className="muted">Диалогов пока нет.</p> : null}
        </div>
      </aside>

      <article className="card chat-panel">
        <h2>Публичный чат</h2>
        {!activeThread ? <p className="muted">Создайте диалог, чтобы начать.</p> : null}
        <div className="messages">
          {messages.map((message) => (
            <div key={message.id} className={message.role === 'assistant' ? 'bubble ai' : 'bubble user'}>
              <p>{message.content}</p>
              <small>{new Date(message.createdAt).toLocaleTimeString('ru-RU')}</small>
            </div>
          ))}
        </div>
        <form onSubmit={sendMessage} className="composer">
          <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Введите вопрос о программах, ценах или формате" rows={3} />
          <button disabled={busy || !activeThreadId}>{busy ? 'Отправляю…' : 'Отправить'}</button>
        </form>
        {error ? <p className="inline-error">{error}</p> : null}
      </article>
    </section>
  )
}

function AdminPanel({ user, onAuthChanged }: { user: SafeUser | null; onAuthChanged: (user: SafeUser | null) => void }) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [draft, setDraft] = useState<DraftConfig | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [providerStatus, setProviderStatus] = useState<{ configured: boolean; updatedAt: string | null } | null>(null)
  const [testMessage, setTestMessage] = useState('Какая программа подойдёт ребёнку 11 лет?')
  const [testUseDraft, setTestUseDraft] = useState(true)
  const [testAnswer, setTestAnswer] = useState('')
  const [adminChats, setAdminChats] = useState<Thread[]>([])
  const [activeChatId, setActiveChatId] = useState('')
  const [activeChatMessages, setActiveChatMessages] = useState<Message[]>([])
  const [keyForm, setKeyForm] = useState({ apiKey: '', adminPassword: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isAdmin = user?.role === 'admin'

  const refresh = async () => {
    if (!isAdmin) return
    try {
      const [overviewRes, draftRes, versionRes, keyRes, chatRes] = await Promise.all([
        api<{ ok: true; data: Overview }>('/api/admin/overview'),
        api<{ ok: true; draft: DraftConfig }>('/api/admin/config/draft'),
        api<{ ok: true; versions: Version[] }>('/api/admin/config/versions'),
        api<{ ok: true; status: { configured: boolean; updatedAt: string | null } }>('/api/admin/provider-key/status'),
        api<{ ok: true; chats: Thread[] }>('/api/admin/chats'),
      ])
      setOverview(overviewRes.data)
      setDraft(draftRes.draft)
      setVersions(versionRes.versions)
      setProviderStatus(keyRes.status)
      setAdminChats(chatRes.chats)
      if (!activeChatId && chatRes.chats[0]) setActiveChatId(chatRes.chats[0].id)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  useEffect(() => {
    void refresh()
  }, [isAdmin])

  useEffect(() => {
    if (!activeChatId || !isAdmin) return
    api<{ ok: true; messages: Message[] }>(`/api/admin/chats/${activeChatId}`)
      .then((payload) => setActiveChatMessages(payload.messages))
      .catch((err: Error) => setError(err.message))
  }, [activeChatId, isAdmin])

  if (!user) {
    return <section className="card"><p>Для админки войдите под админ-аккаунтом.</p></section>
  }

  if (!isAdmin) {
    return (
      <section className="card">
        <p>Аккаунт {user.login} не имеет доступа к админке.</p>
        <button onClick={() => onAuthChanged(null)}>Выйти</button>
      </section>
    )
  }

  const updateDraftField = (field: keyof DraftConfig, value: string) => {
    if (!draft) return
    setDraft({ ...draft, [field]: value })
  }

  const updateBusinessField = (field: keyof BusinessData, value: string) => {
    if (!draft) return
    setDraft({ ...draft, businessData: { ...draft.businessData, [field]: value } })
  }

  const saveDraft = async () => {
    if (!draft) return
    setBusy(true)
    setError('')
    try {
      const payload = await api<{ ok: true; draft: DraftConfig }>('/api/admin/config/draft', {
        method: 'PATCH',
        body: JSON.stringify(draft),
      })
      setDraft(payload.draft)
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const publishDraft = async () => {
    setBusy(true)
    setError('')
    try {
      await api('/api/admin/config/publish', {
        method: 'POST',
        body: JSON.stringify({ reason: 'Публикация через админ-панель' }),
      })
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const runTest = async () => {
    setBusy(true)
    setError('')
    try {
      const payload = await api<{ ok: true; result: { text: string; latencyMs: number; source: string } }>('/api/admin/config/test', {
        method: 'POST',
        body: JSON.stringify({ message: testMessage, useDraft: testUseDraft }),
      })
      setTestAnswer(`${payload.result.text}\n\n(${payload.result.source}, ${payload.result.latencyMs}ms)`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const saveProviderKey = async () => {
    setBusy(true)
    setError('')
    try {
      await api('/api/admin/provider-key', {
        method: 'PUT',
        body: JSON.stringify(keyForm),
      })
      setKeyForm({ apiKey: '', adminPassword: '' })
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const deleteProviderKey = async () => {
    setBusy(true)
    setError('')
    try {
      await api('/api/admin/provider-key', {
        method: 'DELETE',
        body: JSON.stringify({ adminPassword: keyForm.adminPassword }),
      })
      setKeyForm((prev) => ({ ...prev, apiKey: '' }))
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const updateThreadStatus = async (id: string, status: ThreadStatus) => {
    setBusy(true)
    setError('')
    try {
      await api(`/api/admin/chats/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-grid">
      <article className="card">
        <h2>Обзор</h2>
        <p className="muted">Модель: <strong>gpt-6-sol</strong></p>
        <ul className="stats">
          <li>Ключ настроен: {overview?.providerKeyConfigured ? 'да' : 'нет'}</li>
          <li>Публикация: {overview?.published ? 'есть' : 'нет'}</li>
          <li>Последняя публикация: {overview?.lastPublishedAt ? new Date(overview.lastPublishedAt).toLocaleString('ru-RU') : '—'}</li>
          <li>Всего диалогов: {overview?.totalThreads ?? 0}</li>
          <li>Новых обращений: {overview?.newRequests ?? 0}</li>
        </ul>
      </article>

      <article className="card">
        <h2>Данные школы и поведение AI</h2>
        {draft ? (
          <>
            <div className="form-grid">
              <label>Название<input value={draft.businessData.name} onChange={(event) => updateBusinessField('name', event.target.value)} /></label>
              <label>Возраст<input value={draft.businessData.ageAudience} onChange={(event) => updateBusinessField('ageAudience', event.target.value)} /></label>
              <label>Контакты<input value={draft.businessData.contacts} onChange={(event) => updateBusinessField('contacts', event.target.value)} /></label>
              <label>Ссылка на запись<input value={draft.businessData.enrollmentLink} onChange={(event) => updateBusinessField('enrollmentLink', event.target.value)} /></label>
              <label className="full">Описание<textarea rows={3} value={draft.businessData.description} onChange={(event) => updateBusinessField('description', event.target.value)} /></label>
              <label className="full">Программы<textarea rows={3} value={draft.businessData.programs} onChange={(event) => updateBusinessField('programs', event.target.value)} /></label>
              <label className="full">Цены<textarea rows={3} value={draft.businessData.prices} onChange={(event) => updateBusinessField('prices', event.target.value)} /></label>
              <label className="full">Часы<textarea rows={2} value={draft.businessData.hours} onChange={(event) => updateBusinessField('hours', event.target.value)} /></label>
              <label className="full">Системный промпт<textarea rows={6} value={draft.promptText} onChange={(event) => updateDraftField('promptText', event.target.value)} /></label>
              <label className="full">Приветствие<textarea rows={2} value={draft.greeting} onChange={(event) => updateDraftField('greeting', event.target.value)} /></label>
              <label className="full">Разрешённые темы<textarea rows={2} value={draft.allowedTopics} onChange={(event) => updateDraftField('allowedTopics', event.target.value)} /></label>
            </div>
            <div className="row-actions">
              <button onClick={saveDraft} disabled={busy}>Сохранить черновик</button>
              <button onClick={publishDraft} disabled={busy}>Опубликовать</button>
            </div>
          </>
        ) : <p>Загружаю черновик…</p>}
      </article>

      <article className="card">
        <h2>Тест ответа</h2>
        <textarea rows={3} value={testMessage} onChange={(event) => setTestMessage(event.target.value)} />
        <label className="checkbox"><input type="checkbox" checked={testUseDraft} onChange={(event) => setTestUseDraft(event.target.checked)} /> Использовать черновик</label>
        <button onClick={runTest} disabled={busy}>Проверить</button>
        {testAnswer ? <pre className="result">{testAnswer}</pre> : null}
        <h3>История публикаций</h3>
        <ul className="list">
          {versions.slice(0, 5).map((version) => <li key={version.id}>{new Date(version.publishedAt).toLocaleString('ru-RU')} · {version.reason}</li>)}
        </ul>
      </article>

      <article className="card">
        <h2>Технические настройки</h2>
        <p>Статус ключа: {providerStatus?.configured ? 'настроен' : 'не настроен'}</p>
        <p className="muted">Дата обновления: {providerStatus?.updatedAt ? new Date(providerStatus.updatedAt).toLocaleString('ru-RU') : '—'}</p>
        <label>Новый OpenAI API key<input type="password" value={keyForm.apiKey} onChange={(event) => setKeyForm((prev) => ({ ...prev, apiKey: event.target.value }))} /></label>
        <label>Подтвердите пароль<input type="password" value={keyForm.adminPassword} onChange={(event) => setKeyForm((prev) => ({ ...prev, adminPassword: event.target.value }))} /></label>
        <div className="row-actions">
          <button onClick={saveProviderKey} disabled={busy}>Сохранить ключ</button>
          <button onClick={deleteProviderKey} disabled={busy}>Удалить ключ</button>
        </div>
      </article>

      <article className="card full-width">
        <h2>Диалоги и обращения</h2>
        <div className="layout-two">
          <div className="list">
            {adminChats.map((thread) => (
              <button key={thread.id} className={thread.id === activeChatId ? 'list-item active' : 'list-item'} onClick={() => setActiveChatId(thread.id)}>
                <strong>{statusLabel[thread.status]}</strong>
                <span>{thread.preview ?? ''}</span>
                <small>{thread.needsHuman ? 'требует куратора' : 'автоответ'}</small>
              </button>
            ))}
          </div>
          <div>
            <div className="row-actions">
              <button onClick={() => activeChatId && updateThreadStatus(activeChatId, 'new')} disabled={!activeChatId || busy}>новое</button>
              <button onClick={() => activeChatId && updateThreadStatus(activeChatId, 'in_progress')} disabled={!activeChatId || busy}>в работе</button>
              <button onClick={() => activeChatId && updateThreadStatus(activeChatId, 'closed')} disabled={!activeChatId || busy}>закрыто</button>
            </div>
            <div className="messages admin-messages">
              {activeChatMessages.map((message) => (
                <div key={message.id} className={message.role === 'assistant' ? 'bubble ai' : 'bubble user'}>
                  <p>{message.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </article>

      {error ? <p className="card error full-width">{error}</p> : null}
    </section>
  )
}
