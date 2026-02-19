# Professional Gantt Chart - Sentraexam Delivery Plan (September to January)

This plan is structured by phase, includes dependencies, and highlights release milestones.

```mermaid
gantt
    title Sentraexam Delivery Roadmap (Sep 2025 - Jan 2026)
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d
    excludes    weekends

    section Phase 1 - Discovery & Architecture
    Requirements Baseline                         :done, req, 2025-09-01, 2025-09-10
    Scope Freeze & Backlog                        :done, scope, 2025-09-11, 2025-09-18
    System Architecture & ER/Class Design         :done, arch, 2025-09-19, 2025-09-30

    section Phase 2 - Backend Core (Django/DRF)
    Auth, Roles, Permissions                      :done, be_auth, 2025-10-01, 2025-10-12
    Departments, Courses, Enrollments             :done, be_acad, 2025-10-10, 2025-10-26
    Assessments + Scheduling Workflow             :done, be_assess, 2025-10-22, 2025-11-12
    Notifications (API + WebSocket)               :active, be_notify, 2025-11-06, 2025-11-24
    Proctoring APIs + Evidence Storage            :active, be_proc, 2025-11-16, 2025-12-06

    section Phase 3 - Frontend Delivery (React/TS)
    Auth, Layout System, Route Guards             :done, fe_core, 2025-10-12, 2025-10-30
    Role Dashboards (Admin/HOD/Teacher/Student)  :done, fe_dash, 2025-11-01, 2025-11-22
    Assessment, Schedule, Exam Session UI         :active, fe_exam, 2025-11-20, 2025-12-14
    Proctoring & Notification UX                  :fe_proc, 2025-12-01, 2025-12-22

    section Phase 4 - Quality, Release, Handover
    Integration & API Contract Testing            :qa_int, 2025-12-10, 2025-12-29
    UAT + Defect Resolution                       :qa_uat, after qa_int, 20d
    Production Hardening & Deployment             :release, after qa_uat, 10d
    Documentation & Knowledge Transfer            :docs, after release, 8d

    section Milestones
    M1 Architecture Sign-off                       :milestone, m1, 2025-09-30, 1d
    M2 Backend Feature Complete                    :milestone, m2, 2025-12-06, 1d
    M3 Frontend Feature Complete                   :milestone, m3, 2025-12-22, 1d
    M4 Go-Live                                     :milestone, m4, 2026-01-24, 1d
```

## Status Legend
- `done`: completed
- `active`: in progress
- no status tag: planned
