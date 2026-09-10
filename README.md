# AI-da-school

Web-школа вайбкодинга для детей 10–14 лет с AI-консультантом.

**Руководитель школы:** Броварник Александр Алексеевич  
**Старт первого потока:** 10 октября 2026 года  
**Продолжительность:** 10–12 недель  
**Учебные треки:** VibeCode START и VibeCode PRO

## Быстрый старт

Рекомендуется Node.js 22 LTS (не ниже 22.12).

```powershell
git clone https://github.com/AABrovarnik/AI-da-school.git
cd AI-da-school
npm install
Copy-Item .env.example .env
npm run dev
```

После запуска:
- frontend: http://localhost:5173
- backend API: http://localhost:3001
- health-check: http://localhost:3001/api/health

`npm run dev` одновременно запускает React/Vite frontend и Node.js/Express backend.

## Основная структура

```text
AI-da-school/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── .env.example
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   └── styles.css
├── server/
│   ├── index.ts
│   └── tsconfig.json
├── dev-package/
└── docs/
```

## Команды

```powershell
npm run dev       # frontend + backend
npm run dev:web   # только Vite/React
npm run dev:api   # только Node/Express
npm run build     # production build + компиляция backend
npm start         # запуск скомпилированного backend
```

## Переменные окружения

Скопируйте `.env.example` в `.env` и добавляйте секреты только в `.env`.

```env
PORT=3001
GEMINI_API_KEY=
```

Не публикуйте `.env` и Gemini API key в GitHub или frontend-коде.

## Пакет разработки

Файлы для последовательной разработки в Google AI Studio находятся в `dev-package/`:

- `MASTER_PROMPT.md`
- `COURSE_START.md`
- `COURSE_PRO.md`
- `AI_TUTOR_PROMPT.md`
- `UI_SPEC.md`
- `DATABASE_SCHEMA.md`
- `SAFETY.md`
- `ROADMAP.md`

## Документы

- `docs/VibeCode_School_TZ_v1.0.md` — полное техническое задание в Markdown.
- `docs/VibeCode_School_TZ_v1.0.docx` — версия технического задания в Microsoft Word.

## Концепция

Цель проекта — научить детей превращать идею в работающий цифровой продукт вместе с AI: формулировать задачу, писать промпты, создавать прототип, тестировать, находить и исправлять ошибки и развивать собственный проект.
