# DATABASE_SCHEMA.md

## Цель
Минимальная модель данных MVP web-школы AI-da-school.

## Роли
- STUDENT
- PARENT
- TEACHER
- ADMIN

## Основные сущности

### User
- id UUID PK
- email nullable
- display_name
- role enum
- created_at
- updated_at

### StudentProfile
- user_id FK -> User
- age_group enum: 10_11 / 12_14
- current_level enum: START / PRO
- onboarding_completed boolean

Не хранить точную дату рождения, адрес, телефон и геолокацию без отдельной необходимости.

### ParentProfile
- user_id FK -> User

### ParentStudentLink
- parent_user_id
- student_user_id
- status pending/active/revoked

### Course
- id
- slug
- title
- level START/PRO
- description
- duration_weeks
- is_active

### Enrollment
- id
- student_user_id
- course_id
- enrolled_at
- status active/completed/paused

### Module
- id
- course_id
- order_index
- title
- description

### Lesson
- id
- module_id
- order_index
- title
- summary
- content_json
- estimated_minutes
- published

### LessonProgress
- id
- student_user_id
- lesson_id
- status not_started/in_progress/completed
- progress_percent
- started_at
- completed_at

Unique(student_user_id, lesson_id).

### Assignment
- id
- lesson_id
- title
- instructions
- rubric_json nullable

### Submission
- id
- assignment_id
- student_user_id
- project_id nullable
- answer_text nullable
- status draft/submitted/reviewed
- submitted_at nullable

### Project
- id
- student_user_id
- course_id nullable
- title
- description
- status idea/development/testing/done
- current_version
- created_at
- updated_at

### ProjectVersion
- id
- project_id
- version_number
- code_json or source_text
- notes
- created_at

Unique(project_id, version_number).

### AIConversation
- id
- student_user_id
- lesson_id nullable
- project_id nullable
- created_at

### AIMessage
- id
- conversation_id
- role user/assistant
- content
- safety_label nullable
- created_at

Для production рассмотреть ограниченное хранение/TTL AI-истории.

### Achievement
- id
- slug
- title
- description
- rule_json

### StudentAchievement
- student_user_id
- achievement_id
- awarded_at

### ScheduleEvent
- id
- course_id
- lesson_id nullable
- starts_at
- ends_at nullable
- title
- event_type lesson/demo_day/other

### Notification
- id
- user_id
- type
- title
- body
- read_at nullable
- created_at

## Индексы
- lesson_progress(student_user_id, status)
- project(student_user_id, updated_at)
- schedule_event(course_id, starts_at)
- ai_conversation(student_user_id, created_at)

## MVP API mapping
GET /api/courses -> Course
GET /api/lessons/:id -> Lesson
GET/POST /api/student/progress -> LessonProgress
GET/POST /api/projects -> Project
PUT /api/projects/:id -> Project
POST /api/projects/:id/version -> ProjectVersion
POST /api/ai/chat -> AIConversation + AIMessage
GET /api/schedule -> ScheduleEvent
GET /api/achievements -> Achievement + StudentAchievement

## Seed data
Создать:
- 2 Course: START, PRO;
- по 12 Lesson;
- расписание 10.10.2026–26.12.2026;
- 3 fictional students;
- минимум 5 demo projects;
- demo student: Алекс, 12 лет, START, 4/12 уроков, проект «Космическая викторина».

## Правила целостности
- пользователь не может читать данные другого ученика;
- parent получает доступ только через active ParentStudentLink;
- teacher/admin — через RBAC;
- ProjectVersion не перезаписывать: создавать новую версию;
- опубликованный lesson должен принадлежать существующему module/course.

## Рекомендуемая реализация
Для прототипа: Supabase/PostgreSQL или Firebase.
Для production предпочтительна SQL-модель с явными связями и RLS/RBAC.