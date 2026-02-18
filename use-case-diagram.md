# Use Case Diagram

```mermaid
flowchart LR
    Admin([Admin])
    HOD([HOD])
    Teacher([Teacher])
    Student([Student])

    subgraph System[Sentraexam Platform]
      UC1((Manage Users))
      UC2((Manage Departments))
      UC3((Manage Courses))
      UC4((Review Enrollment Requests))
      UC5((Create Assessments))
      UC6((Approve/Schedule Assessments))
      UC7((Take Exam Session))
      UC8((Grade Submissions))
      UC9((Monitor Proctoring Evidence))
      UC10((Send Announcements))
      UC11((View Notifications))
      UC12((Manage Documents))
      UC13((Manage Academic Calendar))
      UC14((View Role Dashboard))
    end

    Admin --> UC1
    Admin --> UC2
    Admin --> UC3
    Admin --> UC6
    Admin --> UC10
    Admin --> UC11
    Admin --> UC12
    Admin --> UC13
    Admin --> UC14

    HOD --> UC3
    HOD --> UC4
    HOD --> UC6
    HOD --> UC9
    HOD --> UC10
    HOD --> UC11
    HOD --> UC12
    HOD --> UC13
    HOD --> UC14

    Teacher --> UC3
    Teacher --> UC4
    Teacher --> UC5
    Teacher --> UC8
    Teacher --> UC9
    Teacher --> UC11
    Teacher --> UC12
    Teacher --> UC13
    Teacher --> UC14

    Student --> UC3
    Student --> UC7
    Student --> UC11
    Student --> UC12
    Student --> UC13
    Student --> UC14
```

## Scope Notes
- Assessment statistics and grading are teacher/HOD/admin scoped by permissions.
- Students can only access their own enrollment, sessions, submissions, notifications, and permitted resources.
- Department and course visibility are role and ownership constrained in backend querysets.
