# Chapter 3: System Design

## 3.1 System Architecture

Sentraexam follows a layered, service-oriented web architecture:

1. Presentation Layer: React + TypeScript SPA (`frontend/`) for Admin, HOD, Teacher, and Student roles.
2. Application Layer: Django + DRF APIs (`apps/*`) with role-based authorization, business rules, and workflow orchestration.
3. Real-Time Layer: Django Channels over WebSocket (`/ws/notifications/`) for live notifications.
4. Background Processing Layer: Celery + Celery Beat with Redis broker/result backend for asynchronous and scheduled jobs.
5. Data Layer: PostgreSQL as the primary relational database; media persisted in local storage or ImageKit.
6. AI/Proctoring Layer: OpenCV, YOLO (Ultralytics), NumPy, and optional Gemini-assisted analysis.

Reference diagram: `architecture-diagram.md`.

---

## 3.2 Data Flow Diagrams / UML Diagrams

### 3.2.1 Data Flow Diagrams (DFD)

The system defines DFDs at three levels:

1. Level 0 (Context): External actors (Student, Teacher, HOD, Admin) exchange requests and responses with Sentraexam.
2. Level 1: Core processes are decomposed into Auth/User Management, Course/Enrollment, Assessment/Scheduling, Exam/Proctoring, and Notifications/Reporting.
3. Level 2 (Assessment & Scheduling): Detailed flow of assessment creation, schedule proposal, approval/rejection, publication, assignment, and result publishing.

Reference: `dfd-level-diagram.md`.

### 3.2.2 UML Diagrams Included

1. Use Case Diagram: `use-case-diagram.md`
2. Class Diagram: `class-diagram.md`
3. Sequence Diagrams: `sequence-diagram.md`

These diagrams model static structure (entities/relations) and dynamic interactions (login, enrollment approval, scheduling, proctoring, notifications).

---

## 3.3 Database Design (ERD and Schema)

### 3.3.1 ERD

The ERD models a centralized academic platform with strong role linkage to departments, courses, assessments, and proctoring artifacts.

Reference: `er-diagram.md`.

### 3.3.2 Logical Schema (Major Modules)

1. Identity and Access
- `users_user`
- `users_activationtoken`
- `users_passwordresettoken`

2. Academic Structure
- `departments_department`
- `departments_departmentmembership`
- `courses_course`
- `courses_courseenrollment`
- `academic_calendar_academicyear`
- `academic_calendar_academicterm`
- `academic_calendar_calendarevent`
- `academic_calendar_timetableentry`

3. Assessment and Proctoring
- `assessments_assessment`
- `assessments_examassignment`
- `assessments_examsession`
- `assessments_cheatinglog`
- `assessments_assessmentsubmission`
- `proctoring_studentfacereference`
- `proctoring_proctoringsnapshot`
- `proctoring_proctoringviolation`
- `proctoring_proctoringsettings`
- `proctoring_proctoringvideoclip`
- `proctoring_sessionrecording`

4. Communication and Documents
- `notifications_announcement`
- `notifications_announcementrecipient`
- `notifications_notification`
- `documents_documentcategory`
- `documents_document`
- `documents_documentaccesslog`

### 3.3.3 Key Design Characteristics

1. UUID primary keys across domain entities.
2. Auditability via timestamp and ownership base models.
3. Role-scoped access enforced at API permission and queryset layers.
4. Strong foreign-key integrity between assessments, sessions, submissions, and proctoring evidence.

---

## 3.4 Interface Design (UI/UX)

### 3.4.1 Frontend Design Approach

1. Single Page Application built with React + TypeScript + Vite.
2. Consistent dashboard layout for role-based workspaces.
3. Protected routes with role checks (`ProtectedRoute`).
4. Ant Design components for forms, tables, filters, cards, and feedback states.
5. Dashboard-first workflow minimizing clicks for daily academic operations.

### 3.4.2 Primary UI Screens

1. Public/Auth
- Welcome page (`/`)
- Login (`/login`)
- Activation (`/activate/:token`)
- Password reset (`/reset-password`)

2. Dashboard and Modules
- Role dashboard home (`/dashboard`)
- Users (`/dashboard/users`)
- Departments (`/dashboard/departments`)
- Courses and enrollment (`/dashboard/courses`, `/dashboard/enrollments`)
- Assessments and exam-taking (`/dashboard/assessments`, `/dashboard/assessments/:id/take`)
- Notifications/announcements (`/dashboard/notifications`, `/dashboard/announcements`)
- Documents (`/dashboard/documents`)
- Calendar (`/dashboard/calendar`)

### 3.4.3 UI/UX Mockups Guidance

Use screenshots of implemented pages as practical mockups in the report. Recommended screenshot set:

1. Login page
2. Admin dashboard
3. Teacher dashboard
4. Student dashboard
5. Assessment creation/scheduling page
6. Exam taking page with proctoring state
7. Notifications center
8. Documents page
9. Calendar page

---

## 3.5 Navigation Structure

Navigation is hierarchical and role-controlled.

1. Entry: `/` -> `/login` -> authenticated `/dashboard`
2. Shared modules: courses, assessments, documents, calendar, notifications
3. Admin-only modules: user management and full department control
4. HOD/Admin modules: announcements and department-level governance
5. Student-specific path: enroll + take exam

Reference route map: `frontend/src/routes/index.tsx`.

A simplified structure:

```text
/
/login
/activate/:token
/reset-password
/dashboard
  /users
  /departments
  /courses
  /enrollments
  /assessments
  /notifications
  /announcements
  /documents
  /calendar
```

---

## 3.6 System Modeling (UML: Activity, Sequence, Class)

### 3.6.1 Activity Model (Representative)

Assessment Lifecycle Activity:

1. Teacher creates draft assessment.
2. Teacher submits for approval.
3. HOD/Admin reviews.
4. If approved -> schedule/publish.
5. Student attempts assessment.
6. Proctoring captures evidence during session.
7. Student submits.
8. Teacher grades and publishes result.

### 3.6.2 Sequence Model

Implemented sequences documented for:

1. Login and dashboard load
2. Enrollment approval flow
3. Assessment scheduling and approval
4. Exam session and proctoring loop
5. Real-time notification delivery

Reference: `sequence-diagram.md`.

### 3.6.3 Class Model

Domain classes include user/department/course/assessment/proctoring/notification/document/calendar models with base inheritance (`BaseModel`, `OwnedModel`) and explicit cardinalities.

Reference: `class-diagram.md`.

---

## 3.7 Hardware-Based Project Section

This project is primarily software/web-based. Hardware-specific sections are documented as non-applicable unless future IoT integration is introduced.

### 3.7.1 Microcontroller or Board Used

Current status: Not applicable.

### 3.7.2 Hardware Components Introduction

Current status: Not applicable (no dedicated MCU/sensor board required for core platform operation).

### 3.7.3 Software Drivers Associated with Hardware

Current status: Not applicable.

### 3.7.4 Sensor and Actuator Setup

Current status: Not applicable.

### 3.7.5 Code Implementation Overview (Hardware Angle)

Current status: Not applicable. Existing implementation is web stack:

1. Backend: Django/DRF + PostgreSQL + Celery + Channels
2. Frontend: React + TypeScript
3. AI: CV/YOLO/Gemini integrations for proctoring analysis

### 3.7.6 Communication Protocols

Protocols used in this project:

1. HTTP/HTTPS for REST APIs (`/api/*`)
2. WebSocket for real-time notifications (`/ws/notifications/`)
3. Redis protocol internally for broker/channel layer

MQTT: Not currently used.

### 3.7.7 Screenshots of Mobile/Web Interface

Applicable (web interface). Insert screenshots from key pages listed in Section 3.4.3.

### 3.7.8 System Block Diagram or Circuit Diagram

System block diagram is applicable and represented by software architecture (see `architecture-diagram.md`).

Circuit diagram: Not applicable.

### 3.7.9 Price/Cost Quotes (Budget Breakdown)

Estimated software deployment budget (monthly):

1. VPS/Compute (app + worker): USD 20-60
2. Managed PostgreSQL: USD 15-50
3. Managed Redis: USD 10-30
4. Object/media storage + CDN/Image delivery: USD 0-30
5. Domain + TLS: USD 1-2 (amortized)
6. Optional AI API usage (Gemini): variable by request volume

Approximate total: USD 46-172/month (excluding one-time development labor).

### 3.7.10 Project Pictures/Photos

For this software project, include:

1. Web UI screenshots
2. API docs screenshots (`/api/docs/`, `/api/redoc/`)
3. Architecture and diagram renders from Mermaid files

---

## 3.8 Traceability to Repository Artifacts

1. Architecture: `architecture-diagram.md`
2. DFD: `dfd-level-diagram.md`
3. ERD: `er-diagram.md`
4. Class model: `class-diagram.md`
5. Sequence model: `sequence-diagram.md`
6. Use cases: `use-case-diagram.md`
7. Navigation/routes: `frontend/src/routes/index.tsx`
8. Role flow and access matrix: `AppFlow.md`

This chapter aligns with the current Sentraexam implementation and can be directly used in project documentation/report submission.
