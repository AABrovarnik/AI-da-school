import 'dotenv/config'
import cors from 'cors'
import crypto from 'crypto'
import express from 'express'
import fs from 'fs'
import path from 'path'

type Role = 'admin' | 'client'
type ThreadStatus = 'new' | 'in_progress' | 'closed'
type ChatRole = 'user' | 'assistant'

type User = {
  id: string
  login: string
  passwordHash: string
  role: Role
  isTestAccount: boolean
  createdAt: string
}

type Session = {
  token: string
  userId: string
  createdAt: string
}

type LearningProgramItem = {
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
  moduleProgress: ModuleProgressItem[]
  updatedAt: string
}

type StudentHistoryItem = {
  id: string
  studentId: string
  actorLogin: string
  action: string
  createdAt: string
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

type ConfigDraft = {
  businessData: BusinessData
  promptText: string
  greeting: string
  allowedTopics: string
  modelKey: 'gpt-6-sol'
  updatedAt: string
  updatedBy: string
}

type PublishedConfigVersion = {
  id: string
  businessData: BusinessData
  promptText: string
  greeting: string
  allowedTopics: string
  modelKey: 'gpt-6-sol'
  publishedAt: string
  publishedBy: string
  reason: string
}

type ChatThread = {
  id: string
  ownerType: 'user' | 'guest'
  ownerId: string
  status: ThreadStatus
  needsHuman: boolean
  createdAt: string
  updatedAt: string
}

type ChatMessage = {
  id: string
  threadId: string
  role: ChatRole
  content: string
  createdAt: string
  configVersionId: string | null
  latencyMs: number | null
}

type AuditEvent = {
  id: string
  actorId: string
  action: string
  objectId: string
  createdAt: string
}

type AppStore = {
  users: User[]
  sessions: Session[]
  draft: ConfigDraft
  publishedVersions: PublishedConfigVersion[]
  threads: ChatThread[]
  messages: ChatMessage[]
  audit: AuditEvent[]
}

type ProviderSecret = {
  encryptedValue: string
  iv: string
  authTag: string
  keyVersion: number
  updatedAt: string
  updatedBy: string
}

type SafeUser = {
  id: string
  login: string
  role: Role
}

type AuthedRequest = express.Request & {
  user?: User
}

const app = express()
const port = Number(process.env.PORT ?? 3001)
const dataDir = path.resolve(process.cwd(), 'server', 'data')
const storePath = path.join(dataDir, 'store.json')
const providerSecretPath = path.join(dataDir, 'provider-secret.json')
const studentProfilesPath = path.join(dataDir, 'student-profiles.json')
const cookieName = 'school_sid'
const guestCookieName = 'school_gid'

app.use(cors({ credentials: true, origin: true }))
app.use(express.json({ limit: '1mb' }))

const nowIso = () => new Date().toISOString()
const randomId = (size = 16) => crypto.randomBytes(size).toString('hex')
const messagePreview = (content: string) => content.replace(/\s+/g, ' ').trim().slice(0, 120)

const defaultBusinessData = (): BusinessData => ({
  name: 'Кодовая мастерская',
  description:
    'Онлайн-школа вайб-кодинга для детей 10–14 лет. Учим через проекты и дружелюбную поддержку.',
  programs:
    'Scratch: 6 900 ₽ за 4 занятия; Веб-лаборатория: 7 900 ₽ за 4 занятия. Демоданные, требуется уточнение.',
  ageAudience: '10–14 лет',
  prices: 'См. блок программ. Если данных недостаточно — передать вопрос куратору.',
  timezone: 'Europe/Moscow',
  hours: 'Пн–пт 12:00–20:00, сб 11:00–17:00, вс выходной',
  format: 'Онлайн, видеосвязь',
  contacts: 'hello@kodovaya-masterskaya.example (демо)',
  enrollmentLink: '',
  faq: 'Можно начать без опыта; для записи нужен родитель или законный представитель.',
})

const defaultPrompt =
  'Ты — AI-администратор школы вайб-кодинга для детей 10–14 лет. Отвечай по-русски ясно и дружелюбно. Используй только опубликованные сведения школы. Если данных нет или вопрос требует решения сотрудника, прямо скажи об этом и предложи связаться с администратором. Не выдумывай цены, дату старта, скидки и обещания мест. Не запрашивай у ребёнка домашний адрес, телефон, документы или платёжные данные.'

const defaultDraft = (): ConfigDraft => ({
  businessData: defaultBusinessData(),
  promptText: defaultPrompt,
  greeting:
    'Привет! Я AI-администратор школы. Подскажу по программам, формату и ценам по опубликованным данным.',
  allowedTopics: 'Программы, цены, формат, расписание, контакты, запись через родителя.',
  modelKey: 'gpt-6-sol',
  updatedAt: nowIso(),
  updatedBy: 'system',
})

const parseCookies = (cookieHeader?: string): Record<string, string> => {
  if (!cookieHeader) return {}
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, item) => {
      const index = item.indexOf('=')
      if (index > -1) {
        const key = item.slice(0, index).trim()
        const value = decodeURIComponent(item.slice(index + 1).trim())
        acc[key] = value
      }
      return acc
    }, {})
}

const setCookie = (res: express.Response, name: string, value: string, maxAgeMs: number) => {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}${secureFlag}`)
}

const clearCookie = (res: express.Response, name: string) => {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`)
}

const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 120_000, 32, 'sha256').toString('hex')
  return `${salt}:${hash}`
}

const verifyPassword = (password: string, hashRecord: string): boolean => {
  const [salt, hash] = hashRecord.split(':')
  if (!salt || !hash) return false
  const candidate = crypto.pbkdf2Sync(password, salt, 120_000, 32, 'sha256').toString('hex')
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'))
}

const encryptionKey = (): Buffer => {
  const secret = process.env.APP_ENCRYPTION_KEY ?? 'dev-only-change-me'
  return crypto.createHash('sha256').update(secret).digest()
}

const encryptValue = (value: string): ProviderSecret => {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return {
    encryptedValue: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    keyVersion: 1,
    updatedAt: nowIso(),
    updatedBy: 'unknown',
  }
}

const decryptValue = (secret: ProviderSecret): string => {
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(secret.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(secret.authTag, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(secret.encryptedValue, 'base64')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

const ensureDataDir = () => {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
}

const seedUsers = (): User[] => {
  const createdAt = nowIso()
  const adminLogin = process.env.ADMIN_LOGIN ?? 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin#12345'
  const users: User[] = [
    {
      id: randomId(8),
      login: adminLogin,
      passwordHash: hashPassword(adminPassword),
      role: 'admin',
      isTestAccount: false,
      createdAt,
    },
  ]

  for (let i = 1; i <= 5; i += 1) {
    users.push({
      id: randomId(8),
      login: `demo-client-0${i}`,
      passwordHash: hashPassword('12345'),
      role: 'client',
      isTestAccount: true,
      createdAt,
    })
  }

  return users
}

const loadStore = (): AppStore => {
  ensureDataDir()
  if (!fs.existsSync(storePath)) {
    const initial: AppStore = {
      users: seedUsers(),
      sessions: [],
      draft: defaultDraft(),
      publishedVersions: [],
      threads: [],
      messages: [],
      audit: [],
    }
    fs.writeFileSync(storePath, JSON.stringify(initial, null, 2), 'utf8')
    return initial
  }

  const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8')) as AppStore
  if (!parsed.users || parsed.users.length === 0) parsed.users = seedUsers()
  if (!parsed.draft) parsed.draft = defaultDraft()
  if (!parsed.publishedVersions) parsed.publishedVersions = []
  if (!parsed.threads) parsed.threads = []
  if (!parsed.messages) parsed.messages = []
  if (!parsed.sessions) parsed.sessions = []
  if (!parsed.audit) parsed.audit = []
  return parsed
}

let store = loadStore()

const programCatalog: LearningProgramItem[] = [
  { id: 'p1', title: 'Введение в вайб-кодинг', description: 'Как формулировать идею, цель и результат проекта.' },
  { id: 'p2', title: 'Алгоритмическое мышление', description: 'Блок-схемы, условия, циклы на детских примерах.' },
  { id: 'p3', title: 'Scratch: первые игры', description: 'Сцены, спрайты, события, очки и уровни.' },
  { id: 'p4', title: 'UX для детей', description: 'Как сделать понятный интерфейс для пользователя.' },
  { id: 'p5', title: 'HTML и структура сайта', description: 'Страницы, заголовки, карточки, ссылки.' },
  { id: 'p6', title: 'CSS и стиль продукта', description: 'Цвета, отступы, сетка, адаптивность.' },
  { id: 'p7', title: 'JavaScript-основы', description: 'Переменные, функции, работа с кнопками и формами.' },
  { id: 'p8', title: 'Работа с AI-ассистентом', description: 'Промпты, проверка ответов, безопасное использование.' },
  { id: 'p9', title: 'Отладка и исправление ошибок', description: 'Поиск багов и проверка гипотез.' },
  { id: 'p10', title: 'Командная работа', description: 'Роли в команде и культура обратной связи.' },
  { id: 'p11', title: 'Презентация проекта', description: 'Как показать ценность и результат своей работы.' },
  { id: 'p12', title: 'Финальный демо-день', description: 'Подготовка и защита проекта перед родителями.' },
];

const normalizeModuleProgress = (source: unknown): ModuleProgressItem[] => {
  const sourceMap = new Map<string, boolean>()
  if (Array.isArray(source)) {
    for (const item of source) {
      if (!item || typeof item !== 'object') continue
      const raw = item as Record<string, unknown>
      const programId = String(raw.programId ?? '')
      if (!programId) continue
      sourceMap.set(programId, Boolean(raw.completed))
    }
  }
  return programCatalog.map((program) => ({
    programId: program.id,
    completed: sourceMap.get(program.id) ?? false,
  }))
}

const progressFromModules = (moduleProgress: ModuleProgressItem[]): number => {
  if (moduleProgress.length === 0) return 0
  const completed = moduleProgress.filter((item) => item.completed).length
  return Math.round((completed / moduleProgress.length) * 100)
}

const buildStudentProfiles = (users: User[]): StudentProfile[] => {
  const samples = [
    { login: 'vasya', fullName: 'Василий Петров', rep: 'Петрова Ольга', email: 'vasya.parent@example.test', contacts: '@vasya_parent' },
    { login: 'fedya', fullName: 'Фёдор Смирнов', rep: 'Смирнова Ирина', email: 'fedya.parent@example.test', contacts: '@fedya_parent' },
    { login: 'sveta', fullName: 'Светлана Иванова', rep: 'Иванов Роман', email: 'sveta.parent@example.test', contacts: '@sveta_parent' },
    { login: 'masha', fullName: 'Мария Кузнецова', rep: 'Кузнецова Анна', email: 'masha.parent@example.test', contacts: '@masha_parent' },
    { login: 'petya', fullName: 'Пётр Соколов', rep: 'Соколова Елена', email: 'petya.parent@example.test', contacts: '@petya_parent' },
  ]

  const profiles: StudentProfile[] = []
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]
    const user = users.find((item) => item.login === sample.login && item.role === 'client')
    if (!user) continue

    const moduleProgress = normalizeModuleProgress(
      programCatalog.map((program, moduleIndex) => ({ programId: program.id, completed: moduleIndex < 3 + index })),
    )
    const progressPercent = progressFromModules(moduleProgress)

    profiles.push({
      id: randomId(8),
      userId: user.id,
      nickname: sample.login,
      fullName: sample.fullName,
      legalRepresentative: sample.rep,
      email: sample.email,
      contacts: sample.contacts,
      progressPercent,
      progressNote: `Пройдено ${moduleProgress.filter((item) => item.completed).length} из ${moduleProgress.length} модулей.`,
      attentionNote: 'Уделить внимание домашней практике и повторению базовых модулей.',
      moduleProgress,
      updatedAt: nowIso(),
    })
  }
  return profiles
}

const loadStudentProfiles = (users: User[]): StudentProfile[] => {
  if (fs.existsSync(studentProfilesPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(studentProfilesPath, 'utf8')) as StudentProfile[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        let changed = false
        for (const student of parsed) {
          const normalized = normalizeModuleProgress((student as Partial<StudentProfile>).moduleProgress)
          if (JSON.stringify(normalized) !== JSON.stringify((student as Partial<StudentProfile>).moduleProgress ?? [])) {
            student.moduleProgress = normalized
            changed = true
          }

          const nextPercent = progressFromModules(student.moduleProgress)
          if (student.progressPercent !== nextPercent) {
            student.progressPercent = nextPercent
            changed = true
          }

          const expectedNote = `Пройдено ${student.moduleProgress.filter((item) => item.completed).length} из ${student.moduleProgress.length} модулей.`
          if (!student.progressNote || student.progressNote.includes('модул')) {
            if (student.progressNote !== expectedNote) {
              student.progressNote = expectedNote
              changed = true
            }
          }
        }
        if (changed) fs.writeFileSync(studentProfilesPath, JSON.stringify(parsed, null, 2), 'utf8')
        return parsed
      }
    } catch {
      // ignore and regenerate
    }
  }

  const generated = buildStudentProfiles(users)
  fs.writeFileSync(studentProfilesPath, JSON.stringify(generated, null, 2), 'utf8')
  return generated
}

const persistStudentProfiles = () => {
  ensureDataDir()
  fs.writeFileSync(studentProfilesPath, JSON.stringify(studentProfiles, null, 2), 'utf8')
}

const normalizeLegacyDemoLogins = () => {
  const mapping = ['vasya', 'fedya', 'sveta', 'masha', 'petya']
  let changed = false
  for (let i = 1; i <= 5; i += 1) {
    const legacy = `demo-client-0${i}`
    const target = mapping[i - 1]
    const user = store.users.find((item) => item.login === legacy)
    if (!user) continue
    if (store.users.some((item) => item.login === target)) continue
    user.login = target
    changed = true
  }
  if (changed) persistStore()
}

let studentProfiles = loadStudentProfiles(store.users)


const persistStore = () => {
  ensureDataDir()
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8')
}

normalizeLegacyDemoLogins()
studentProfiles = loadStudentProfiles(store.users)

const loadProviderSecret = (): ProviderSecret | null => {
  if (!fs.existsSync(providerSecretPath)) return null
  try {
    return JSON.parse(fs.readFileSync(providerSecretPath, 'utf8')) as ProviderSecret
  } catch {
    return null
  }
}

const saveProviderSecret = (secret: ProviderSecret) => {
  ensureDataDir()
  fs.writeFileSync(providerSecretPath, JSON.stringify(secret, null, 2), 'utf8')
}

const removeProviderSecret = () => {
  if (fs.existsSync(providerSecretPath)) fs.unlinkSync(providerSecretPath)
}

const addAudit = (actorId: string, action: string, objectId: string) => {
  store.audit.push({ id: randomId(8), actorId, action, objectId, createdAt: nowIso() })
  persistStore()
}

const safeUser = (user: User): SafeUser => ({ id: user.id, login: user.login, role: user.role })

const currentPublished = (): PublishedConfigVersion | null => {
  if (store.publishedVersions.length === 0) return null
  return store.publishedVersions[store.publishedVersions.length - 1]
}

const resolveSessionUser = (req: express.Request): User | null => {
  const cookies = parseCookies(req.headers.cookie)
  const token = cookies[cookieName]
  if (!token) return null
  const session = store.sessions.find((item) => item.token === token)
  if (!session) return null
  return store.users.find((user) => user.id === session.userId) ?? null
}

const requireAuth = (req: AuthedRequest, res: express.Response, next: express.NextFunction) => {
  const user = resolveSessionUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'Требуется вход.' })
  req.user = user
  return next()
}

const requireAdmin = (req: AuthedRequest, res: express.Response, next: express.NextFunction) => {
  const user = resolveSessionUser(req)
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Доступ только для администратора.' })
  }
  req.user = user
  return next()
}

const requireClient = (req: AuthedRequest, res: express.Response, next: express.NextFunction) => {
  const user = resolveSessionUser(req)
  if (!user || user.role !== 'client') {
    return res.status(401).json({ ok: false, error: 'Войдите как ученик, чтобы открыть кабинет.' })
  }
  req.user = user
  return next()
}

const ensureGuestId = (req: express.Request, res: express.Response): string => {
  const cookies = parseCookies(req.headers.cookie)
  const existing = cookies[guestCookieName]
  if (existing) return existing
  const generated = `guest-${randomId(8)}`
  setCookie(res, guestCookieName, generated, 1000 * 60 * 60 * 24 * 30)
  return generated
}

const ownerFromRequest = (req: express.Request, res: express.Response) => {
  const user = resolveSessionUser(req)
  if (user) {
    return { ownerType: 'user' as const, ownerId: user.id, safe: safeUser(user) }
  }
  return { ownerType: 'guest' as const, ownerId: ensureGuestId(req, res), safe: null }
}

const threadForOwner = (threadId: string, ownerType: 'user' | 'guest', ownerId: string): ChatThread | null => {
  return (
    store.threads.find(
      (thread) => thread.id === threadId && thread.ownerType === ownerType && thread.ownerId === ownerId,
    ) ?? null
  )
}

const systemPrompt = (config: ConfigDraft | PublishedConfigVersion): string => {
  const data = config.businessData
  return [
    config.promptText,
    `Модель runtime: gpt-6-sol.`,
    `Название: ${data.name}`,
    `Описание: ${data.description}`,
    `Программы: ${data.programs}`,
    `Возраст: ${data.ageAudience}`,
    `Цены: ${data.prices}`,
    `Часы: ${data.hours} (${data.timezone})`,
    `Формат: ${data.format}`,
    `Контакты: ${data.contacts}`,
    `Ссылка на запись: ${data.enrollmentLink || 'не указана'}`,
    `FAQ: ${data.faq}`,
    `Разрешённые темы: ${config.allowedTopics}`,
    'Если данных не хватает — прямо скажи и предложи связаться с администратором.',
  ].join('\n')
}

const extractResponseText = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') return ''
  const asRecord = payload as Record<string, unknown>
  if (typeof asRecord.output_text === 'string') return asRecord.output_text
  if (Array.isArray(asRecord.output)) {
    const chunks: string[] = []
    for (const item of asRecord.output) {
      if (!item || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      if (Array.isArray(record.content)) {
        for (const piece of record.content) {
          if (piece && typeof piece === 'object') {
            const text = (piece as Record<string, unknown>).text
            if (typeof text === 'string') chunks.push(text)
          }
        }
      }
    }
    return chunks.join('\n').trim()
  }
  return ''
}

const activeProviderKey = (): string => {
  const secret = loadProviderSecret()
  if (secret) {
    try {
      return decryptValue(secret)
    } catch {
      return ''
    }
  }
  return process.env.OPENAI_API_KEY ?? ''
}

const callModel = async (input: string, config: ConfigDraft | PublishedConfigVersion, history: ChatMessage[]) => {
  const key = activeProviderKey()
  if (!key) {
    return {
      text: 'Ключ OpenAI не настроен. Передайте запрос администратору.',
      latencyMs: 0,
      modelAvailable: false,
    }
  }

  const historySlice = history.slice(-6).map((message) => ({
    role: message.role,
    content: message.content,
  }))

  const startedAt = Date.now()
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-6-sol',
        input: [
          { role: 'system', content: systemPrompt(config) },
          ...historySlice,
          { role: 'user', content: input },
        ],
        max_output_tokens: 450,
      }),
    })

    const data = (await response.json()) as unknown
    if (!response.ok) {
      return {
        text: 'Сервис AI временно недоступен. Попробуйте позже или свяжитесь с администратором.',
        latencyMs: Date.now() - startedAt,
        modelAvailable: false,
      }
    }

    const text = extractResponseText(data)
    return {
      text:
        text ||
        'Не получилось сформировать ответ. Уточните вопрос или обратитесь к администратору.',
      latencyMs: Date.now() - startedAt,
      modelAvailable: true,
    }
  } catch {
    return {
      text: 'Проблема с подключением к AI. Попробуйте позже.',
      latencyMs: Date.now() - startedAt,
      modelAvailable: false,
    }
  }
}

const wantsHumanHelp = (text: string): boolean => {
  const lower = text.toLowerCase()
  return ['скидк', 'возврат', 'гарант', 'договор', 'номер куратора', 'запишите', 'оплат'].some((token) =>
    lower.includes(token),
  )
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'ai-da-school-api',
    model: 'gpt-6-sol',
    providerKeyConfigured: Boolean(activeProviderKey()),
    publishedConfig: Boolean(currentPublished()),
  })
})

app.get('/api/auth/me', (req, res) => {
  const user = resolveSessionUser(req)
  if (!user) return res.json({ ok: true, user: null })
  return res.json({ ok: true, user: safeUser(user) })
})

app.post('/api/auth/login', (req, res) => {
  const login = String(req.body?.login ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')
  if (!login || !password) {
    return res.status(400).json({ ok: false, error: 'Введите логин и пароль.' })
  }

  const user = store.users.find((item) => item.login === login)
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ ok: false, error: 'Неверный логин или пароль.' })
  }

  store.sessions = store.sessions.filter((session) => session.userId !== user.id)
  const token = randomId(24)
  store.sessions.push({ token, userId: user.id, createdAt: nowIso() })
  persistStore()

  setCookie(res, cookieName, token, 1000 * 60 * 60 * 12)
  addAudit(user.id, 'login', user.id)
  return res.json({ ok: true, user: safeUser(user) })
})

app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie)
  const token = cookies[cookieName]
  if (token) {
    store.sessions = store.sessions.filter((session) => session.token !== token)
    persistStore()
  }
  clearCookie(res, cookieName)
  return res.json({ ok: true })
})

app.get('/api/catalog/programs', (_req, res) => {
  res.json({ ok: true, programs: programCatalog })
})

app.get('/api/student/me', requireClient, (req: AuthedRequest, res) => {
  const profile = studentProfiles.find((item) => item.userId === req.user!.id)
  if (!profile) return res.status(404).json({ ok: false, error: 'Профиль ученика не найден.' })

  res.json({
    ok: true,
    student: profile,
    programs: programCatalog,
    highlights: [
      'Следующий дедлайн: финализировать мини-проект модуля.',
      'Рекомендация: 2 короткие сессии практики в неделю.',
      'Фокус недели: повторить базовые функции и условные конструкции.',
    ],
  })
})

app.get('/api/admin/students', requireAdmin, (_req, res) => {
  const students = studentProfiles
    .map((student) => {
      const user = store.users.find((item) => item.id === student.userId)
      return { ...student, login: user?.login ?? '' }
    })
    .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))

  res.json({ ok: true, students })
})

app.get('/api/admin/students/:id/history', requireAdmin, (req, res) => {
  const student = studentProfiles.find((item) => item.id === req.params.id)
  if (!student) return res.status(404).json({ ok: false, error: 'Ученик не найден.' })

  const history: StudentHistoryItem[] = store.audit
    .filter((item) => item.objectId === student.id && item.action.startsWith('student.'))
    .map((item) => ({
      id: item.id,
      studentId: student.id,
      actorLogin: store.users.find((user) => user.id === item.actorId)?.login ?? 'unknown',
      action: item.action,
      createdAt: item.createdAt,
    }))
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))

  res.json({ ok: true, history })
})

app.post('/api/admin/students', requireAdmin, (req: AuthedRequest, res) => {
  const login = String(req.body?.login ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')
  const fullName = String(req.body?.fullName ?? '').trim()
  const legalRepresentative = String(req.body?.legalRepresentative ?? '').trim()
  const email = String(req.body?.email ?? '').trim()
  const contacts = String(req.body?.contacts ?? '').trim()

  if (!login || !password || !fullName) {
    return res.status(400).json({ ok: false, error: 'Заполните логин, пароль и имя ученика.' })
  }
  if (store.users.some((item) => item.login === login)) {
    return res.status(409).json({ ok: false, error: 'Логин уже используется.' })
  }

  const user: User = {
    id: randomId(8),
    login,
    passwordHash: hashPassword(password),
    role: 'client',
    isTestAccount: true,
    createdAt: nowIso(),
  }
  store.users.push(user)

  const moduleProgress = normalizeModuleProgress([])

  const student: StudentProfile = {
    id: randomId(8),
    userId: user.id,
    nickname: login,
    fullName,
    legalRepresentative: legalRepresentative || 'Не указано',
    email: email || `${login}@example.test`,
    contacts: contacts || 'Не указано',
    progressPercent: 0,
    progressNote: `Пройдено 0 из ${moduleProgress.length} модулей.`,
    attentionNote: 'Нет замечаний.',
    moduleProgress,
    updatedAt: nowIso(),
  }

  studentProfiles.push(student)
  persistStore()
  persistStudentProfiles()
  addAudit(req.user!.id, 'student.create', student.id)
  res.status(201).json({ ok: true, student })
})

app.patch('/api/admin/students/:id', requireAdmin, (req: AuthedRequest, res) => {
  const student = studentProfiles.find((item) => item.id === req.params.id)
  if (!student) return res.status(404).json({ ok: false, error: 'Ученик не найден.' })

  const user = store.users.find((item) => item.id === student.userId)
  if (!user) return res.status(404).json({ ok: false, error: 'Учётная запись ученика не найдена.' })

  const nextLogin = req.body?.login ? String(req.body.login).trim().toLowerCase() : user.login
  if (nextLogin !== user.login && store.users.some((item) => item.login === nextLogin)) {
    return res.status(409).json({ ok: false, error: 'Такой логин уже существует.' })
  }

  user.login = nextLogin
  if (req.body?.newPassword) user.passwordHash = hashPassword(String(req.body.newPassword))

  student.nickname = String(req.body?.nickname ?? student.nickname)
  student.fullName = String(req.body?.fullName ?? student.fullName)
  student.legalRepresentative = String(req.body?.legalRepresentative ?? student.legalRepresentative)
  student.email = String(req.body?.email ?? student.email)
  student.contacts = String(req.body?.contacts ?? student.contacts)
  student.moduleProgress = normalizeModuleProgress(req.body?.moduleProgress ?? student.moduleProgress)

  const percentFromModules = progressFromModules(student.moduleProgress)
  const manualPercent = Math.max(0, Math.min(100, Number(req.body?.progressPercent ?? percentFromModules)))
  student.progressPercent = req.body?.moduleProgress ? percentFromModules : manualPercent

  const modulesDone = student.moduleProgress.filter((item) => item.completed).length
  const defaultProgressNote = `Пройдено ${modulesDone} из ${student.moduleProgress.length} модулей.`
  student.progressNote = String(req.body?.progressNote ?? defaultProgressNote)
  student.attentionNote = String(req.body?.attentionNote ?? student.attentionNote)
  student.updatedAt = nowIso()

  persistStore()
  persistStudentProfiles()
  addAudit(req.user!.id, 'student.update', student.id)
  res.json({ ok: true, student, login: user.login })
})

app.get('/api/admin/overview', requireAdmin, (req: AuthedRequest, res) => {
  const latestPublication = currentPublished()
  const newRequests = store.threads.filter((thread) => thread.status === 'new').length
  res.json({
    ok: true,
    data: {
      model: 'gpt-6-sol',
      providerKeyConfigured: Boolean(activeProviderKey()),
      published: Boolean(latestPublication),
      lastPublishedAt: latestPublication?.publishedAt ?? null,
      totalThreads: store.threads.length,
      newRequests,
      draftUpdatedAt: store.draft.updatedAt,
      admin: safeUser(req.user!),
    },
  })
})

app.get('/api/admin/config/draft', requireAdmin, (_req, res) => {
  res.json({ ok: true, draft: store.draft })
})

app.patch('/api/admin/config/draft', requireAdmin, (req: AuthedRequest, res) => {
  const payload = req.body ?? {}
  const nextBusinessData: BusinessData = {
    ...store.draft.businessData,
    ...(payload.businessData ?? {}),
  }

  store.draft = {
    ...store.draft,
    ...payload,
    businessData: nextBusinessData,
    modelKey: 'gpt-6-sol',
    updatedAt: nowIso(),
    updatedBy: req.user!.id,
  }
  persistStore()
  addAudit(req.user!.id, 'draft.update', 'config-draft')
  return res.json({ ok: true, draft: store.draft })
})

app.post('/api/admin/config/publish', requireAdmin, (req: AuthedRequest, res) => {
  const reason = String(req.body?.reason ?? 'Публикация из админ-панели').slice(0, 180)
  const published: PublishedConfigVersion = {
    id: randomId(8),
    businessData: { ...store.draft.businessData },
    promptText: store.draft.promptText,
    greeting: store.draft.greeting,
    allowedTopics: store.draft.allowedTopics,
    modelKey: 'gpt-6-sol',
    publishedAt: nowIso(),
    publishedBy: req.user!.id,
    reason,
  }
  store.publishedVersions.push(published)
  persistStore()
  addAudit(req.user!.id, 'config.publish', published.id)
  return res.json({ ok: true, published })
})

app.get('/api/admin/config/versions', requireAdmin, (_req, res) => {
  res.json({ ok: true, versions: [...store.publishedVersions].reverse() })
})

app.post('/api/admin/config/test', requireAdmin, async (req, res) => {
  const message = String(req.body?.message ?? '').trim()
  const useDraft = req.body?.useDraft !== false
  if (!message) return res.status(400).json({ ok: false, error: 'Введите сообщение для теста.' })

  const config = useDraft ? store.draft : currentPublished() ?? store.draft
  const result = await callModel(message, config, [])

  return res.json({
    ok: true,
    result: {
      text: result.text,
      latencyMs: result.latencyMs,
      source: useDraft ? 'draft' : 'published',
      modelKey: 'gpt-6-sol',
      modelAvailable: result.modelAvailable,
    },
  })
})

app.get('/api/admin/provider-key/status', requireAdmin, (_req, res) => {
  const secret = loadProviderSecret()
  res.json({
    ok: true,
    status: {
      configured: Boolean(secret || process.env.OPENAI_API_KEY),
      storedInDb: Boolean(secret),
      updatedAt: secret?.updatedAt ?? null,
      model: 'gpt-6-sol',
    },
  })
})

app.put('/api/admin/provider-key', requireAdmin, (req: AuthedRequest, res) => {
  const password = String(req.body?.adminPassword ?? '')
  const newKey = String(req.body?.apiKey ?? '').trim()

  if (!password || !verifyPassword(password, req.user!.passwordHash)) {
    return res.status(401).json({ ok: false, error: 'Повторный ввод пароля неверен.' })
  }
  if (!newKey.startsWith('sk-') || newKey.length < 20) {
    return res.status(400).json({ ok: false, error: 'Введите валидный API-ключ.' })
  }

  const encrypted = encryptValue(newKey)
  encrypted.updatedBy = req.user!.id
  saveProviderSecret(encrypted)
  addAudit(req.user!.id, 'provider-key.update', 'provider-secret')
  return res.json({ ok: true })
})

app.post('/api/admin/provider-key/test', requireAdmin, async (_req, res) => {
  const key = activeProviderKey()
  if (!key) {
    return res.status(400).json({ ok: false, error: 'Ключ не настроен.' })
  }

  const startedAt = Date.now()
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-6-sol',
        input: [{ role: 'user', content: 'ping' }],
        max_output_tokens: 12,
      }),
    })

    if (!response.ok) {
      return res.status(502).json({ ok: false, error: 'Подключение есть, но проверка не прошла.' })
    }

    return res.json({ ok: true, latencyMs: Date.now() - startedAt })
  } catch {
    return res.status(502).json({ ok: false, error: 'Не удалось связаться с OpenAI.' })
  }
})

app.delete('/api/admin/provider-key', requireAdmin, (req: AuthedRequest, res) => {
  const password = String(req.body?.adminPassword ?? '')
  if (!password || !verifyPassword(password, req.user!.passwordHash)) {
    return res.status(401).json({ ok: false, error: 'Повторный ввод пароля неверен.' })
  }

  removeProviderSecret()
  addAudit(req.user!.id, 'provider-key.delete', 'provider-secret')
  return res.json({ ok: true })
})

app.get('/api/admin/chats', requireAdmin, (_req, res) => {
  const items = store.threads
    .map((thread) => {
      const lastMessage = [...store.messages]
        .filter((message) => message.threadId === thread.id)
        .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))[0]
      return {
        id: thread.id,
        status: thread.status,
        needsHuman: thread.needsHuman,
        ownerType: thread.ownerType,
        updatedAt: thread.updatedAt,
        createdAt: thread.createdAt,
        preview: lastMessage ? messagePreview(lastMessage.content) : 'Диалог пока пуст',
      }
    })
    .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))

  res.json({ ok: true, chats: items })
})

app.get('/api/admin/chats/:id', requireAdmin, (req, res) => {
  const thread = store.threads.find((item) => item.id === req.params.id)
  if (!thread) return res.status(404).json({ ok: false, error: 'Диалог не найден.' })

  const messages = store.messages
    .filter((item) => item.threadId === thread.id)
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))

  return res.json({ ok: true, thread, messages })
})

app.patch('/api/admin/chats/:id', requireAdmin, (req: AuthedRequest, res) => {
  const thread = store.threads.find((item) => item.id === req.params.id)
  if (!thread) return res.status(404).json({ ok: false, error: 'Диалог не найден.' })

  const status = req.body?.status as ThreadStatus
  if (!['new', 'in_progress', 'closed'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'Некорректный статус.' })
  }

  thread.status = status
  thread.updatedAt = nowIso()
  persistStore()
  addAudit(req.user!.id, 'chat.status.update', thread.id)
  return res.json({ ok: true, thread })
})

app.get('/api/chat/threads', (req, res) => {
  const owner = ownerFromRequest(req, res)
  const threads = store.threads
    .filter((thread) => thread.ownerType === owner.ownerType && thread.ownerId === owner.ownerId)
    .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
  return res.json({ ok: true, threads, user: owner.safe })
})

app.post('/api/chat/threads', (req, res) => {
  const owner = ownerFromRequest(req, res)
  const createdAt = nowIso()
  const thread: ChatThread = {
    id: randomId(8),
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    status: 'new',
    needsHuman: false,
    createdAt,
    updatedAt: createdAt,
  }

  store.threads.push(thread)

  const initialMessage = String(req.body?.message ?? '').trim()
  if (initialMessage) {
    store.messages.push({
      id: randomId(8),
      threadId: thread.id,
      role: 'assistant',
      content: currentPublished()?.greeting ?? store.draft.greeting,
      createdAt,
      configVersionId: currentPublished()?.id ?? null,
      latencyMs: null,
    })
    store.messages.push({
      id: randomId(8),
      threadId: thread.id,
      role: 'user',
      content: initialMessage,
      createdAt: nowIso(),
      configVersionId: null,
      latencyMs: null,
    })
    thread.updatedAt = nowIso()
  }

  persistStore()
  return res.status(201).json({ ok: true, thread })
})

app.get('/api/chat/threads/:id/messages', (req, res) => {
  const owner = ownerFromRequest(req, res)
  const user = resolveSessionUser(req)
  let thread: ChatThread | null = null

  if (user?.role === 'admin') {
    thread = store.threads.find((item) => item.id === req.params.id) ?? null
  } else {
    thread = threadForOwner(req.params.id, owner.ownerType, owner.ownerId)
  }

  if (!thread) return res.status(404).json({ ok: false, error: 'Диалог не найден.' })
  const messages = store.messages
    .filter((item) => item.threadId === thread!.id)
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
  return res.json({ ok: true, thread, messages, user: owner.safe })
})

app.post('/api/chat/threads/:id/messages', async (req, res) => {
  const owner = ownerFromRequest(req, res)
  const thread = threadForOwner(req.params.id, owner.ownerType, owner.ownerId)
  if (!thread) return res.status(404).json({ ok: false, error: 'Диалог не найден.' })

  const content = String(req.body?.message ?? '').trim()
  if (!content) return res.status(400).json({ ok: false, error: 'Введите сообщение.' })

  const userMessage: ChatMessage = {
    id: randomId(8),
    threadId: thread.id,
    role: 'user',
    content,
    createdAt: nowIso(),
    configVersionId: null,
    latencyMs: null,
  }
  store.messages.push(userMessage)

  const published = currentPublished()
  const activeConfig = published ?? store.draft
  const threadHistory = store.messages.filter((item) => item.threadId === thread.id)
  const ai = await callModel(content, activeConfig, threadHistory)

  const assistantMessage: ChatMessage = {
    id: randomId(8),
    threadId: thread.id,
    role: 'assistant',
    content: ai.text,
    createdAt: nowIso(),
    configVersionId: published?.id ?? null,
    latencyMs: ai.latencyMs,
  }

  store.messages.push(assistantMessage)
  thread.needsHuman = wantsHumanHelp(content) || thread.needsHuman
  if (thread.needsHuman && thread.status === 'new') thread.status = 'in_progress'
  thread.updatedAt = nowIso()
  persistStore()

  return res.json({ ok: true, message: assistantMessage, thread })
})

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Маршрут не найден.' })
})

app.listen(port, () => {
  console.log(`AI-da-school API: http://localhost:${port}`)
})












