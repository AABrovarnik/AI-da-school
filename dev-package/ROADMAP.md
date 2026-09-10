# ROADMAP.md

## Цель
Пошаговый план сборки AI-da-school в Google AI Studio без перегрузки одного промпта.

## Этап 0. Подготовка
Входные файлы:
- MASTER_PROMPT.md
- COURSE_START.md
- COURSE_PRO.md
- AI_TUTOR_PROMPT.md
- UI_SPEC.md
- DATABASE_SCHEMA.md
- SAFETY.md
- ROADMAP.md

Результат: согласованная спецификация MVP.

## Этап 1. Каркас приложения
Собрать React + TypeScript frontend и Node.js backend.

Реализовать маршруты:
/
/programs
/programs/start
/programs/pro
/schedule
/lessons/:id
/dashboard
/projects
/projects/:id
/ai-tutor
/progress
/parents
/about
/admin

На этом этапе — demo data, без реальной авторизации.

Acceptance:
- приложение запускается;
- все routes открываются;
- responsive layout;
- ошибок в console нет.

## Этап 2. Учебный контент
Загрузить COURSE_START.md и COURSE_PRO.md в seed/data model.

Сделать:
- 2 курса;
- 12 уроков каждого уровня;
- календарь 10.10.2026–26.12.2026;
- lesson viewer;
- отметку завершения урока.

## Этап 3. Dashboard, прогресс, проекты
Реализовать:
- dashboard ученика;
- LessonProgress;
- список проектов;
- создание/редактирование проекта;
- ProjectVersion;
- достижения.

Ключевой сценарий:
урок → мини-задание → проект → сохранить версию → прогресс.

## Этап 4. AI-наставник
Подключить Gemini только через backend `/api/ai/chat`.

Контекст:
- STUDENT_LEVEL;
- CURRENT_LESSON;
- LESSON_TOPIC;
- PROJECT;
- STUDENT_PROGRESS;
- ограниченный project code/context.

Использовать AI_TUTOR_PROMPT.md как server-side system policy.

Acceptance:
- ключ отсутствует в frontend;
- AI отвечает по-русски и возрастно;
- progressive hints работают;
- quick actions работают;
- ошибки Gemini обрабатываются дружелюбно.

## Этап 5. Хранилище и RBAC
Подключить persistent database.

Рекомендуемый путь: Supabase/PostgreSQL.

Реализовать роли STUDENT/PARENT/TEACHER/ADMIN и правила из DATABASE_SCHEMA.md + SAFETY.md.

## Этап 6. Родительский раздел
MVP:
- публичная информация о программе и безопасности;
- авторизованный parent dashboard с прогрессом связанного ребёнка.

## Этап 7. Admin
CRUD для курса, модулей, уроков, расписания, заданий, объявлений и достижений.

Контент не должен быть зашит в JSX.

## Этап 8. QA MVP
Проверить минимум:
- все routes;
- 2 учебные программы;
- 24 урока;
- календарь;
- сохранение progress;
- создание и повторное открытие проекта;
- version history;
- AI chat;
- отсутствие Gemini key в browser;
- RBAC;
- responsive;
- empty/error/loading states.

## MVP release
В MVP входят:
- Главная;
- START/PRO;
- календарь;
- уроки;
- dashboard;
- прогресс;
- проекты;
- AI-наставник;
- Родителям;
- О школе;
- базовый Admin.

Не включать в v1 без необходимости:
- платежи;
- видеозвонки;
- сложную CRM;
- социальную сеть;
- публичные рейтинги детей.

## v1.1
- регистрация и полноценная авторизация;
- teacher review;
- homework/submissions;
- notifications;
- сертификаты;
- публикация проектов;
- GitHub integration;
- библиотека промптов.

## v2
- Prompt Builder;
- AI Code Reviewer;
- Adaptive Learning;
- AI Teacher;
- portfolio;
- персональные траектории.

## Рекомендуемый порядок промптов в Google AI Studio
1. MASTER_PROMPT.md + UI_SPEC.md + SAFETY.md — создать каркас.
2. COURSE_START.md + COURSE_PRO.md — добавить контент.
3. DATABASE_SCHEMA.md — сделать persistent data layer.
4. AI_TUTOR_PROMPT.md — подключить AI.
5. ROADMAP.md — проверить, что очередность функций соблюдена.
6. Отдельный финальный QA prompt: «Проверь все acceptance criteria и исправь найденные ошибки».

## Definition of Done MVP
Ученик может открыть сайт, выбрать программу, пройти урок, выполнить мини-задание, спросить AI-наставника, создать проект, сохранить новую версию, закрыть приложение и позже увидеть сохранённый прогресс. Администратор может менять учебный контент без изменения React-кода.