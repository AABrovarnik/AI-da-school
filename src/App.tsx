import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'

type Role = 'admin' | 'client'
type ThreadStatus = 'new' | 'in_progress' | 'closed'
type AdminTab = 'settings' | 'chats' | 'students'

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
  students: number
}

type ProgramItem = {
  id: string
  title: string
  description: string
}

type ModuleProgressItem = {
  programId: string
  completed: boolean
}

type StudentProfile = {
  id: string
  userId: string
  nickname: string
  fullName: string
  legalRepresentative: string
  email: string
  contacts: string
  progressPercent: number
  progressNote: string
  attentionNote: string
  updatedAt: string
  moduleProgress: ModuleProgressItem[]
  login?: string
}

type StudentHistoryItem = {
  id: string
  studentId: string
  actorLogin: string
  action: string
  createdAt: string
}

type RouteState = {
  view: 'school' | 'admin'
  adminTab: AdminTab
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

const tabLabel: Record<AdminTab, string> = {
  settings: 'Настройки',
  chats: 'Чаты',
  students: 'Ученики',
}

const parseRoute = (pathname: string): RouteState => {
  if (pathname.startsWith('/admin/chats')) return { view: 'admin', adminTab: 'chats' }
  if (pathname.startsWith('/admin/students')) return { view: 'admin', adminTab: 'students' }
  if (pathname.startsWith('/admin')) return { view: 'admin', adminTab: 'settings' }
  return { view: 'school', adminTab: 'settings' }
}

const routeToPath = (route: RouteState): string => {
  if (route.view === 'school') return '/school'
  if (route.adminTab === 'chats') return '/admin/chats'
  if (route.adminTab === 'students') return '/admin/students'
  return '/admin/settings'
}

export default function App() {
  const [route, setRoute] = useState<RouteState>(() => parseRoute(window.location.pathname))
  const [user, setUser] = useState<SafeUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [globalError, setGlobalError] = useState('')

  useEffect(() => {
    api<{ ok: true; user: SafeUser | null }>('/api/auth/me')
      .then((payload) => setUser(payload.user))
      .catch((error: Error) => setGlobalError(error.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseRoute(window.location.pathname))
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (window.location.pathname === '/') {
      const target = '/school'
      window.history.replaceState({}, '', target)
      setRoute(parseRoute(target))
    }
  }, [])

  const onAuthChanged = (nextUser: SafeUser | null) => {
    setUser(nextUser)
    setGlobalError('')
  }

  const navigate = (next: RouteState) => {
    const nextPath = routeToPath(next)
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    setRoute(next)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI-da-school</p>
          <h1>Школа и админка</h1>
        </div>
        <div className="topbar-actions">
          <button className={route.view === 'school' ? 'tab active' : 'tab'} onClick={() => navigate({ view: 'school', adminTab: route.adminTab })}>
            Чат школы
          </button>
          <button className={route.view === 'admin' ? 'tab active' : 'tab'} onClick={() => navigate({ view: 'admin', adminTab: route.adminTab })}>
            Админка ({tabLabel[route.adminTab]})
          </button>
          <AuthWidget user={user} onAuthChanged={onAuthChanged} />
        </div>
      </header>

      {loading ? <p className="card">Загрузка…</p> : null}
      {globalError ? <p className="card error">{globalError}</p> : null}

      {!loading && route.view === 'school' ? <SchoolPage user={user} /> : null}
      {!loading && route.view === 'admin' ? (
        <AdminPanel
          user={user}
          onAuthChanged={onAuthChanged}
          activeTab={route.adminTab}
          onNavigateTab={(tab) => navigate({ view: 'admin', adminTab: tab })}
        />
      ) : null}
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

function SchoolPage({ user }: { user: SafeUser | null }) {
  return (
    <section className="school-grid school-spotlight">
      <PublicChat user={user} />
      <StudentDashboard user={user} />
    </section>
  )
}

function PublicChat({ user }: { user: SafeUser | null }) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const messageEndRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)

  const activeThread = useMemo(() => threads.find((thread) => thread.id === activeThreadId) ?? null, [threads, activeThreadId])

  const quickPrompts = [
    'Какая программа подойдёт ребёнку 11 лет?',
    'Как проходят занятия и сколько длятся?',
    'Что нужно для первого бесплатного урока?',
  ]

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }

  const applyQuickPrompt = (text: string) => {
    setInput(text)
    composerRef.current?.focus()
  }

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
      setTimeout(scrollToBottom, 0)
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

  useEffect(() => {
    scrollToBottom()
  }, [messages.length])

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

    const prompt = input.trim()
    setInput('')

    try {
      await api<{ ok: true; message: Message; thread: Thread }>(`/api/chat/threads/${activeThreadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: prompt }),
      })
      await loadMessages(activeThreadId)
      await loadThreads()
    } catch (err) {
      setError((err as Error).message)
      setInput(prompt)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="card">
      <div className="row-between">
        <div>
          <h2>Чат школы</h2>
          <p className="muted">Поможем разобраться с программами, форматом и записью.</p>
        </div>
        <button onClick={createThread} disabled={busy}>Новый диалог</button>
      </div>

      <div className="quick-prompts">
        {quickPrompts.map((item) => (
          <button key={item} type="button" className="secondary" onClick={() => applyQuickPrompt(item)}>{item}</button>
        ))}
      </div>

      <section className="layout-two">
        <aside className="card sidebar embedded">
          <h3>Диалоги</h3>
          <p className="muted">{user ? `Вы вошли как ${user.login}` : 'Гостевой режим'}</p>
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

        <div className="chat-panel">
          {!activeThread ? <p className="muted">Создайте диалог, чтобы начать.</p> : null}
          <div className="messages">
            {messages.map((message) => (
              <div key={message.id} className={message.role === 'assistant' ? 'bubble ai' : 'bubble user'}>
                <p>{message.content}</p>
                <small>{new Date(message.createdAt).toLocaleTimeString('ru-RU')}</small>
              </div>
            ))}
            <div ref={messageEndRef} />
          </div>

          <div className="row-actions compact">
            <button type="button" className="secondary" onClick={scrollToBottom}>К последней реплике</button>
          </div>

          <form onSubmit={sendMessage} className="composer">
            <textarea ref={composerRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Задайте свой вопрос" rows={3} />
            <button disabled={busy || !activeThreadId}>{busy ? 'Отправляю…' : 'Отправить'}</button>
          </form>
          {error ? <p className="inline-error">{error}</p> : null}
        </div>
      </section>
    </article>
  )
}

function StudentDashboard({ user }: { user: SafeUser | null }) {
  const [programs, setPrograms] = useState<ProgramItem[]>([])
  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [highlights, setHighlights] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ ok: true; programs: ProgramItem[] }>('/api/catalog/programs')
      .then((payload) => setPrograms(payload.programs))
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(() => {
    if (user?.role !== 'client') {
      setStudent(null)
      return
    }

    api<{ ok: true; student: StudentProfile; highlights: string[] }>('/api/student/me')
      .then((payload) => {
        setStudent(payload.student)
        setHighlights(payload.highlights)
      })
      .catch((err: Error) => setError(err.message))
  }, [user?.id, user?.role])

  const moduleMap = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const item of student?.moduleProgress ?? []) {
      map.set(item.programId, item.completed)
    }
    return map
  }, [student])

  return (
    <article className="card">
      <h2>Страница ученика</h2>
      <p className="muted">Программа обучения, прогресс и важные подсказки.</p>

      {user?.role !== 'client' ? <p className="muted">Войдите под учеником, чтобы увидеть персональные данные.</p> : null}

      {student ? (
        <div className="student-grid">
          <div className="card embedded">
            <h3>Профиль</h3>
            <p><strong>Ник:</strong> {student.nickname}</p>
            <p><strong>Имя:</strong> {student.fullName}</p>
            <p><strong>Представитель:</strong> {student.legalRepresentative}</p>
            <p><strong>Почта:</strong> {student.email}</p>
            <p><strong>Контакты:</strong> {student.contacts}</p>
          </div>

          <div className="card embedded">
            <h3>Прогресс</h3>
            <p><strong>{student.progressPercent}%</strong> выполнено</p>
            <progress max={100} value={student.progressPercent} />
            <p>{student.progressNote}</p>
          </div>

          <div className="card embedded">
            <h3>Обрати внимание</h3>
            <p>{student.attentionNote}</p>
          </div>

          <div className="card embedded">
            <h3>Последнее обновление</h3>
            <p>{new Date(student.updatedAt).toLocaleString('ru-RU')}</p>
          </div>

          <div className="card embedded full-width">
            <h3>Фокус недели</h3>
            <ul className="list clean">
              {highlights.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>

          <div className="card embedded full-width">
            <h3>Прогресс по модулям</h3>
            <ul className="module-list">
              {programs.map((program) => (
                <li key={program.id} className={moduleMap.get(program.id) ? 'module-item done' : 'module-item'}>
                  <span>{moduleMap.get(program.id) ? '✅' : '⬜'}</span>
                  <div>
                    <strong>{program.title}</strong>
                    <p className="muted">{program.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {error ? <p className="inline-error">{error}</p> : null}
    </article>
  )
}

function AdminPanel({
  user,
  onAuthChanged,
  activeTab,
  onNavigateTab,
}: {
  user: SafeUser | null
  onAuthChanged: (user: SafeUser | null) => void
  activeTab: AdminTab
  onNavigateTab: (tab: AdminTab) => void
}) {
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
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [programs, setPrograms] = useState<ProgramItem[]>([])
  const [activeStudentId, setActiveStudentId] = useState('')
  const [studentDraft, setStudentDraft] = useState<Partial<StudentProfile> & { login?: string; newPassword?: string }>({})
  const [studentHistory, setStudentHistory] = useState<StudentHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [newStudent, setNewStudent] = useState({ login: '', password: '', fullName: '', legalRepresentative: '', email: '', contacts: '' })
  const [keyForm, setKeyForm] = useState({ apiKey: '', adminPassword: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isAdmin = user?.role === 'admin'

  const refresh = async () => {
    if (!isAdmin) return
    try {
      const [overviewRes, draftRes, versionRes, keyRes, chatRes, studentsRes, programsRes] = await Promise.all([
        api<{ ok: true; data: Overview }>('/api/admin/overview'),
        api<{ ok: true; draft: DraftConfig }>('/api/admin/config/draft'),
        api<{ ok: true; versions: Version[] }>('/api/admin/config/versions'),
        api<{ ok: true; status: { configured: boolean; updatedAt: string | null } }>('/api/admin/provider-key/status'),
        api<{ ok: true; chats: Thread[] }>('/api/admin/chats'),
        api<{ ok: true; students: StudentProfile[] }>('/api/admin/students'),
        api<{ ok: true; programs: ProgramItem[] }>('/api/catalog/programs'),
      ])
      setOverview(overviewRes.data)
      setDraft(draftRes.draft)
      setVersions(versionRes.versions)
      setProviderStatus(keyRes.status)
      setAdminChats(chatRes.chats)
      setStudents(studentsRes.students)
      setPrograms(programsRes.programs)
      if (!activeChatId && chatRes.chats[0]) setActiveChatId(chatRes.chats[0].id)
      if (!activeStudentId && studentsRes.students[0]) {
        setActiveStudentId(studentsRes.students[0].id)
        setStudentDraft(studentsRes.students[0])
      }
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

  useEffect(() => {
    const found = students.find((item) => item.id === activeStudentId)
    if (found) setStudentDraft(found)
  }, [activeStudentId, students])

  useEffect(() => {
    if (!isAdmin || !activeStudentId) {
      setStudentHistory([])
      return
    }

    setHistoryLoading(true)
    api<{ ok: true; history: StudentHistoryItem[] }>(`/api/admin/students/${activeStudentId}/history`)
      .then((payload) => setStudentHistory(payload.history))
      .catch((err: Error) => setError(err.message))
      .finally(() => setHistoryLoading(false))
  }, [activeStudentId, isAdmin])

  if (!user) return <section className="card"><p>Для админки войдите под админ-аккаунтом.</p></section>
  if (!isAdmin) return <section className="card"><p>Аккаунт {user.login} не имеет доступа к админке.</p><button onClick={() => onAuthChanged(null)}>Выйти</button></section>

  const updateDraftField = (field: keyof DraftConfig, value: string) => draft && setDraft({ ...draft, [field]: value })
  const updateBusinessField = (field: keyof BusinessData, value: string) => draft && setDraft({ ...draft, businessData: { ...draft.businessData, [field]: value } })

  const saveDraft = async () => {
    if (!draft) return
    setBusy(true)
    setError('')
    try {
      const payload = await api<{ ok: true; draft: DraftConfig }>('/api/admin/config/draft', { method: 'PATCH', body: JSON.stringify(draft) })
      setDraft(payload.draft)
      await refresh()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  const publishDraft = async () => {
    setBusy(true)
    setError('')
    try {
      await api('/api/admin/config/publish', { method: 'POST', body: JSON.stringify({ reason: 'Публикация через админ-панель' }) })
      await refresh()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  const runTest = async () => {
    setBusy(true)
    setError('')
    try {
      const payload = await api<{ ok: true; result: { text: string; latencyMs: number; source: string } }>('/api/admin/config/test', {
        method: 'POST',
        body: JSON.stringify({ message: testMessage, useDraft: testUseDraft }),
      })
      setTestAnswer(`${payload.result.text}

(${payload.result.source}, ${payload.result.latencyMs}ms)`)
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  const saveProviderKey = async () => {
    setBusy(true)
    setError('')
    try {
      await api('/api/admin/provider-key', { method: 'PUT', body: JSON.stringify(keyForm) })
      setKeyForm({ apiKey: '', adminPassword: '' })
      await refresh()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  const deleteProviderKey = async () => {
    setBusy(true)
    setError('')
    try {
      await api('/api/admin/provider-key', { method: 'DELETE', body: JSON.stringify({ adminPassword: keyForm.adminPassword }) })
      await refresh()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  const updateThreadStatus = async (id: string, status: ThreadStatus) => {
    setBusy(true)
    setError('')
    try {
      await api(`/api/admin/chats/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      await refresh()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  const createStudent = async () => {
    setBusy(true)
    setError('')
    try {
      await api('/api/admin/students', { method: 'POST', body: JSON.stringify(newStudent) })
      setNewStudent({ login: '', password: '', fullName: '', legalRepresentative: '', email: '', contacts: '' })
      await refresh()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  const toggleModuleProgress = (programId: string) => {
    const current = studentDraft.moduleProgress ?? []
    const next = current.map((item) => item.programId === programId ? { ...item, completed: !item.completed } : item)
    const completedCount = next.filter((item) => item.completed).length
    const total = next.length || 1
    const percent = Math.round((completedCount / total) * 100)

    setStudentDraft((prev) => ({
      ...prev,
      moduleProgress: next,
      progressPercent: percent,
      progressNote: `Пройдено ${completedCount} из ${total} модулей.`,
    }))
  }

  const saveStudent = async () => {
    if (!activeStudentId) return
    setBusy(true)
    setError('')
    try {
      await api(`/api/admin/students/${activeStudentId}`, { method: 'PATCH', body: JSON.stringify(studentDraft) })
      await refresh()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <section className="card">
      <div className="row-between">
        <div>
          <h2>Админка</h2>
          <p className="muted">Разделы вынесены по отдельным адресам.</p>
        </div>
        <div className="row-actions compact">
          <button className={activeTab === 'settings' ? 'tab active' : 'tab'} onClick={() => onNavigateTab('settings')}>Настройки</button>
          <button className={activeTab === 'chats' ? 'tab active' : 'tab'} onClick={() => onNavigateTab('chats')}>Чаты</button>
          <button className={activeTab === 'students' ? 'tab active' : 'tab'} onClick={() => onNavigateTab('students')}>Ученики</button>
        </div>
      </div>

      {activeTab === 'settings' ? (
        <div className="admin-grid">
          <article className="card embedded">
            <h3>Обзор</h3>
            <p className="muted">Модель: <strong>gpt-6-sol</strong></p>
            <ul className="stats">
              <li>Ключ настроен: {overview?.providerKeyConfigured ? 'да' : 'нет'}</li>
              <li>Последнее обновление ключа: {providerStatus?.updatedAt ? new Date(providerStatus.updatedAt).toLocaleString('ru-RU') : '—'}</li>
              <li>Публикация: {overview?.published ? 'есть' : 'нет'}</li>
              <li>Последняя публикация: {overview?.lastPublishedAt ? new Date(overview.lastPublishedAt).toLocaleString('ru-RU') : '—'}</li>
              <li>Диалогов: {overview?.totalThreads ?? 0}</li>
              <li>Новых обращений: {overview?.newRequests ?? 0}</li>
              <li>Учеников: {overview?.students ?? 0}</li>
            </ul>
          </article>

          <article className="card embedded">
            <h3>Ключ провайдера</h3>
            <div className="form-grid">
              <label className="full">API ключ<input type="password" value={keyForm.apiKey} onChange={(event) => setKeyForm((prev) => ({ ...prev, apiKey: event.target.value }))} /></label>
              <label className="full">Подтвердите пароль<input type="password" value={keyForm.adminPassword} onChange={(event) => setKeyForm((prev) => ({ ...prev, adminPassword: event.target.value }))} /></label>
            </div>
            <div className="row-actions">
              <button onClick={saveProviderKey} disabled={busy}>Сохранить ключ</button>
              <button className="secondary" onClick={deleteProviderKey} disabled={busy}>Удалить ключ</button>
            </div>
          </article>

          <article className="card embedded full-width">
            <h3>Данные школы</h3>
            <div className="form-grid">
              <label>Название<input value={draft?.businessData.name ?? ''} onChange={(event) => updateBusinessField('name', event.target.value)} /></label>
              <label>Возраст<input value={draft?.businessData.ageAudience ?? ''} onChange={(event) => updateBusinessField('ageAudience', event.target.value)} /></label>
              <label className="full">Описание<textarea rows={2} value={draft?.businessData.description ?? ''} onChange={(event) => updateBusinessField('description', event.target.value)} /></label>
              <label className="full">Программы<textarea rows={2} value={draft?.businessData.programs ?? ''} onChange={(event) => updateBusinessField('programs', event.target.value)} /></label>
              <label className="full">Цены<textarea rows={2} value={draft?.businessData.prices ?? ''} onChange={(event) => updateBusinessField('prices', event.target.value)} /></label>
              <label>Часы<input value={draft?.businessData.hours ?? ''} onChange={(event) => updateBusinessField('hours', event.target.value)} /></label>
              <label>Формат<input value={draft?.businessData.format ?? ''} onChange={(event) => updateBusinessField('format', event.target.value)} /></label>
              <label className="full">Контакты<input value={draft?.businessData.contacts ?? ''} onChange={(event) => updateBusinessField('contacts', event.target.value)} /></label>
              <label className="full">Ссылка на запись<input value={draft?.businessData.enrollmentLink ?? ''} onChange={(event) => updateBusinessField('enrollmentLink', event.target.value)} /></label>
              <label className="full">FAQ<textarea rows={2} value={draft?.businessData.faq ?? ''} onChange={(event) => updateBusinessField('faq', event.target.value)} /></label>
              <label className="full">Приветствие<textarea rows={2} value={draft?.greeting ?? ''} onChange={(event) => updateDraftField('greeting', event.target.value)} /></label>
              <label className="full">Промпт<textarea rows={4} value={draft?.promptText ?? ''} onChange={(event) => updateDraftField('promptText', event.target.value)} /></label>
              <label className="full">Разрешённые темы<input value={draft?.allowedTopics ?? ''} onChange={(event) => updateDraftField('allowedTopics', event.target.value)} /></label>
            </div>
            <div className="row-actions">
              <button onClick={saveDraft} disabled={busy}>Сохранить черновик</button>
              <button onClick={publishDraft} disabled={busy}>Опубликовать</button>
            </div>
          </article>

          <article className="card embedded full-width">
            <h3>Тест ответа</h3>
            <label>Сообщение
              <textarea rows={2} value={testMessage} onChange={(event) => setTestMessage(event.target.value)} />
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={testUseDraft} onChange={(event) => setTestUseDraft(event.target.checked)} />
              Использовать черновик
            </label>
            <button onClick={runTest} disabled={busy}>Запустить тест</button>
            {testAnswer ? <pre className="result">{testAnswer}</pre> : null}
          </article>

          <article className="card embedded full-width">
            <h3>История публикаций</h3>
            <div className="list">
              {versions.length === 0 ? <p className="muted">Публикаций пока нет.</p> : null}
              {versions.map((version) => (
                <div key={version.id} className="list-item">
                  <strong>{new Date(version.publishedAt).toLocaleString('ru-RU')}</strong>
                  <span>{version.reason}</span>
                  <small>{version.modelKey}</small>
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      {activeTab === 'chats' ? (
        <article className="card embedded">
          <div className="layout-two">
            <div className="list">
              {adminChats.map((thread) => (
                <div key={thread.id} className={thread.id === activeChatId ? 'list-item active' : 'list-item'}>
                  <button className="secondary" onClick={() => setActiveChatId(thread.id)}>Открыть</button>
                  <strong>{statusLabel[thread.status]}</strong>
                  <span>{thread.preview ?? 'Без превью'}</span>
                  <small>{new Date(thread.updatedAt).toLocaleString('ru-RU')}</small>
                  <div className="row-actions">
                    <button className="secondary" onClick={() => updateThreadStatus(thread.id, 'in_progress')} disabled={busy}>В работу</button>
                    <button className="secondary" onClick={() => updateThreadStatus(thread.id, 'closed')} disabled={busy}>Закрыть</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="messages admin-messages">
              {activeChatMessages.map((message) => (
                <div key={message.id} className={message.role === 'assistant' ? 'bubble ai' : 'bubble user'}>
                  <p>{message.content}</p>
                </div>
              ))}
              {activeChatMessages.length === 0 ? <p className="muted">Выберите диалог слева.</p> : null}
            </div>
          </div>
        </article>
      ) : null}

      {activeTab === 'students' ? (
        <div className="admin-grid">
          <article className="card embedded">
            <h3>Регистрация ученика</h3>
            <div className="form-grid">
              <label>Логин<input value={newStudent.login} onChange={(e) => setNewStudent({ ...newStudent, login: e.target.value })} /></label>
              <label>Пароль<input value={newStudent.password} onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })} type="password" /></label>
              <label className="full">Имя<input value={newStudent.fullName} onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })} /></label>
              <label>Законный представитель<input value={newStudent.legalRepresentative} onChange={(e) => setNewStudent({ ...newStudent, legalRepresentative: e.target.value })} /></label>
              <label>Почта<input value={newStudent.email} onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })} /></label>
              <label className="full">Другие контакты<input value={newStudent.contacts} onChange={(e) => setNewStudent({ ...newStudent, contacts: e.target.value })} /></label>
            </div>
            <button onClick={createStudent} disabled={busy}>Создать ученика</button>
          </article>

          <article className="card embedded full-width">
            <h3>Редактирование ученика</h3>
            <div className="layout-two">
              <div className="list">
                {students.map((student) => (
                  <button key={student.id} className={student.id === activeStudentId ? 'list-item active' : 'list-item'} onClick={() => setActiveStudentId(student.id)}>
                    <strong>{student.fullName}</strong>
                    <span>{student.login ?? student.nickname}</span>
                    <small>{student.progressPercent}%</small>
                  </button>
                ))}
              </div>
              <div className="form-grid">
                <label>Логин<input value={studentDraft.login ?? ''} onChange={(e) => setStudentDraft((prev) => ({ ...prev, login: e.target.value }))} /></label>
                <label>Новый пароль<input type="password" value={studentDraft.newPassword ?? ''} onChange={(e) => setStudentDraft((prev) => ({ ...prev, newPassword: e.target.value }))} /></label>
                <label>Ник<input value={studentDraft.nickname ?? ''} onChange={(e) => setStudentDraft((prev) => ({ ...prev, nickname: e.target.value }))} /></label>
                <label>Имя<input value={studentDraft.fullName ?? ''} onChange={(e) => setStudentDraft((prev) => ({ ...prev, fullName: e.target.value }))} /></label>
                <label>Законный представитель<input value={studentDraft.legalRepresentative ?? ''} onChange={(e) => setStudentDraft((prev) => ({ ...prev, legalRepresentative: e.target.value }))} /></label>
                <label>Почта<input value={studentDraft.email ?? ''} onChange={(e) => setStudentDraft((prev) => ({ ...prev, email: e.target.value }))} /></label>
                <label className="full">Другие контакты<input value={studentDraft.contacts ?? ''} onChange={(e) => setStudentDraft((prev) => ({ ...prev, contacts: e.target.value }))} /></label>
                <label>Прогресс %<input type="number" min={0} max={100} value={studentDraft.progressPercent ?? 0} onChange={(e) => setStudentDraft((prev) => ({ ...prev, progressPercent: Number(e.target.value) }))} /></label>
                <label className="full">Прогресс в учебе<textarea rows={2} value={studentDraft.progressNote ?? ''} onChange={(e) => setStudentDraft((prev) => ({ ...prev, progressNote: e.target.value }))} /></label>
                <label className="full">Обрати внимание<textarea rows={2} value={studentDraft.attentionNote ?? ''} onChange={(e) => setStudentDraft((prev) => ({ ...prev, attentionNote: e.target.value }))} /></label>

                <div className="full card embedded">
                  <h4>Прогресс по модулям</h4>
                  <div className="module-checklist">
                    {programs.map((program) => {
                      const checked = studentDraft.moduleProgress?.find((item) => item.programId === program.id)?.completed ?? false
                      return (
                        <label key={program.id} className="checkbox">
                          <input type="checkbox" checked={checked} onChange={() => toggleModuleProgress(program.id)} />
                          {program.title}
                        </label>
                      )
                    })}
                  </div>
                </div>

                <button onClick={saveStudent} disabled={!activeStudentId || busy}>Сохранить изменения</button>
              </div>
            </div>
          </article>

          <article className="card embedded full-width">
            <h3>История изменений ученика</h3>
            {historyLoading ? <p className="muted">Загрузка истории…</p> : null}
            {!historyLoading && studentHistory.length === 0 ? <p className="muted">Изменений пока нет.</p> : null}
            <ul className="list clean">
              {studentHistory.map((item) => (
                <li key={item.id}><strong>{new Date(item.createdAt).toLocaleString('ru-RU')}</strong> — {item.actorLogin}: {item.action}</li>
              ))}
            </ul>
          </article>
        </div>
      ) : null}

      {error ? <p className="card error">{error}</p> : null}
    </section>
  )
}
