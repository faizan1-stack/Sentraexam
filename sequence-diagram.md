# Sequence Diagrams (Mermaid)

## 1) Login and Dashboard Load

```mermaid
sequenceDiagram
    participant User
    participant FE as React Frontend
    participant API as Django API
    participant DB as PostgreSQL

    User->>FE: Enter credentials
    FE->>API: POST /api/auth/token/
    API->>DB: Validate user
    DB-->>API: User + role
    API-->>FE: access + refresh JWT
    FE->>API: GET /api/auth/dashboard/{role}/
    API->>DB: Fetch role-specific metrics
    API-->>FE: Dashboard payload
    FE-->>User: Render dashboard
```

## 2) Enrollment Approval Flow

```mermaid
sequenceDiagram
    participant Student
    participant FE
    participant API
    participant DB
    participant HOD as HOD/Teacher

    Student->>FE: Request enrollment
    FE->>API: POST /api/courses/enrollments/
    API->>DB: Create CourseEnrollment(PENDING)
    API-->>FE: Enrollment created

    HOD->>FE: Open enrollment requests
    FE->>API: GET /api/courses/enrollments/
    API->>DB: Filter by role scope
    API-->>FE: Pending requests

    HOD->>FE: Approve or reject
    FE->>API: PATCH enrollment status
    API->>DB: Update enrollment
    API->>DB: Create notifications
    API-->>FE: Status updated
```

## 3) Assessment Scheduling and Approval

```mermaid
sequenceDiagram
    participant Teacher
    participant FE
    participant API
    participant DB
    participant Admin as HOD/Admin

    Teacher->>FE: Propose schedule
    FE->>API: POST /api/assessments/{id}/schedule/
    API->>DB: Save PROPOSED schedule
    API-->>FE: Proposed

    Admin->>FE: Review schedule
    FE->>API: POST /api/assessments/{id}/schedule/approve/
    API->>DB: Mark APPROVED and SCHEDULED
    API->>DB: Create notifications/reminders
    API-->>FE: Approved
```

## 4) Exam Session and Proctoring

```mermaid
sequenceDiagram
    participant Student
    participant FE
    participant API
    participant DB
    participant AI as CV/YOLO Services

    Student->>FE: Start exam
    FE->>API: POST /api/assessments/{id}/start-session/
    API->>DB: Create ExamSession
    API-->>FE: session + deadline + questions

    loop Every snapshot interval
      FE->>API: POST /api/proctoring/... snapshot
      API->>AI: Analyze frame
      AI-->>API: detections + confidence
      API->>DB: Save snapshot/violations
      API-->>FE: warning/ok
    end

    Student->>FE: Submit exam
    FE->>API: POST /api/assessments/submissions/
    API->>DB: Save submission + end session
    API-->>FE: Submission success
```

## 5) Real-Time Notification Delivery

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant WS as Channels Consumer
    participant API as Django API
    participant DB as PostgreSQL
    participant Redis

    FE->>WS: Connect /ws/notifications/?token=JWT
    WS->>Redis: Join user channel group

    API->>DB: Create Notification record
    API->>Redis: Publish user event
    Redis-->>WS: Notification event
    WS-->>FE: Push JSON payload
    FE-->>FE: Update bell count + toast
```
