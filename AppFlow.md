# Sentraexam Application Flow & Role-Based Access Control

This document provides a comprehensive overview of the application functionality for each user role in the Sentraexam academic management platform.

## User Roles Overview

### 1. Administrator (ADMIN)
**Full system access and management capabilities**

#### User Management
- ✅ Create, view, edit, and delete ALL users (Admin, HOD, Teacher, Student)
- ✅ Assign users to departments with specific roles
- ✅ Activate/deactivate user accounts
- ✅ View all user profiles and audit logs
- ✅ Manage user permissions across the system

#### Department Management
- ✅ Create, view, edit, and delete ALL departments
- ✅ Assign Head of Department (HOD) to any department
- ✅ View department statistics (teacher count, student count)
- ✅ Manage department memberships across all departments

#### Course Management
- ✅ Create, view, edit, and delete ALL courses
- ✅ Approve/reject course submissions from HODs and Teachers
- ✅ Assign teachers to courses
- ✅ Manage course enrollment across all departments
- ✅ View all course analytics and statistics

#### Assessment Management
- ✅ Create, view, edit, and delete ALL assessments
- ✅ Approve/reject assessment submissions
- ✅ Schedule assessments across all courses
- ✅ View all assessment submissions and grades
- ✅ Grade submissions for any course

#### System Administration
- ✅ Manage academic calendar (years, terms, events)
- ✅ Create and send announcements to all users
- ✅ Access and manage all documents in the system
- ✅ View system-wide analytics and reports
- ✅ Configure system settings and permissions

---

### 2. Head of Department (HOD)
**Department-level management and oversight**

#### Department Management
- ✅ View own department details and statistics
- ✅ Manage department memberships (add/remove teachers and students)
- ✅ Assign teachers to courses within the department
- ✅ View department performance metrics

#### User Management (Department Only)
- ✅ View all users within their department
- ✅ Create new users (Teacher, Student) for their department
- ✅ Edit user profiles within their department
- ✅ Cannot manage Admin users or users from other departments

#### Course Management
- ✅ Create, view, edit courses within their department
- ✅ Submit courses for approval to Admin
- ✅ Assign teachers to courses within their department
- ✅ Approve courses created by teachers in their department
- ✅ View all course enrollments within their department

#### Assessment Management
- ✅ Create, view, edit assessments for courses in their department
- ✅ Submit assessments for approval to Admin
- ✅ Approve assessments created by teachers in their department
- ✅ Schedule assessments for courses in their department
- ✅ View all assessment submissions and grades within their department

#### Communication & Notifications
- ✅ Create and send announcements to department members
- ✅ View notifications and announcements relevant to their department
- ✅ Cannot send announcements to other departments or system-wide

---

### 3. Teacher
**Course and assessment management within assigned courses**

#### Course Management
- ✅ View courses they are assigned to teach
- ✅ Create draft courses (requires HOD/Admin approval)
- ✅ View active courses available to students
- ✅ Cannot create courses outside their department

#### Assessment Management
- ✅ Create assessments for courses they teach
- ✅ Submit assessments for approval (HOD/Admin)
- ✅ View approved and scheduled assessments
- ✅ Grade student submissions for their courses
- ✅ Provide feedback on student submissions

#### Student Management
- ✅ View enrolled students in their courses
- ✅ Manage course enrollments (add/remove students)
- ✅ Track student progress and performance
- ✅ Cannot view students from other courses/departments

#### Communication
- ✅ View announcements relevant to their courses/department
- ✅ Receive notifications about assessment submissions
- ✅ Cannot send system-wide announcements

---

### 4. Student
**Learning and assessment participation**

#### Course Management
- ✅ View enrolled courses
- ✅ View available courses for enrollment
- ✅ Cannot create or edit courses

#### Assessment Management
- ✅ View approved and scheduled assessments for enrolled courses
- ✅ Submit assessments before deadlines
- ✅ View their own submission status and grades
- ✅ Receive feedback from teachers
- ✅ Cannot create or grade assessments

#### Profile & Progress
- ✅ View own profile and academic progress
- ✅ Track course completion status
- ✅ View personal grade history
- ✅ Cannot view other students' information

#### Communication
- ✅ View announcements relevant to their courses/department
- ✅ Receive notifications about new assessments and grades
- ✅ Cannot send announcements

---

## Workflow Processes

### Course Creation Workflow
1. **Teacher** creates course as DRAFT
2. **Teacher** submits course for approval
3. **HOD** reviews and approves/rejects
4. **Admin** can override HOD decisions
5. Course becomes ACTIVE and available for enrollment

### Assessment Creation Workflow
1. **Teacher** creates assessment as DRAFT
2. **Teacher** submits assessment for approval
3. **HOD** reviews and approves/rejects
4. **Admin** can override HOD decisions
5. Assessment is SCHEDULED with dates
6. Students can submit during assessment period
7. Teacher grades submissions

### User Onboarding Workflow
1. **Admin/HOD** creates user account (inactive by default)
2. System generates activation token
3. User receives activation email
4. User activates account and sets password
5. User can login and access appropriate features

### Announcement Workflow
1. **Admin/HOD** creates announcement
2. Selects target audience (All, Department, Course, Custom)
3. System populates recipients based on audience
4. Announcement is sent as notifications
5. Users receive and read notifications

---

## Data Access Rules

### User Data Visibility
- **Admin**: All users across all departments
- **HOD**: Users within their department only
- **Teacher**: Students enrolled in their courses only
- **Student**: Own profile only

### Course Data Visibility
- **Admin**: All courses
- **HOD**: Courses within their department
- **Teacher**: Courses they teach + active courses
- **Student**: Enrolled courses + available courses

### Assessment Data Visibility
- **Admin**: All assessments
- **HOD**: Assessments for courses in their department
- **Teacher**: Assessments they created + assessments for courses they teach
- **Student**: Approved/scheduled assessments for enrolled courses

### Document Access
- **Private**: Only owner can access
- **Department**: All department members can access
- **Institution**: All users can access

---

## API Endpoint Access Summary

### Users API (`/api/users/`)
- **Admin**: Full CRUD on all users
- **HOD**: CRUD on department users only
- **Teacher**: Read own profile only
- **Student**: Read own profile only

### Departments API (`/api/departments/`)
- **Admin**: Full CRUD on all departments
- **HOD**: Read own department only
- **Teacher**: No access
- **Student**: No access

### Courses API (`/api/courses/`)
- **Admin**: Full CRUD on all courses
- **HOD**: CRUD on department courses
- **Teacher**: Create (draft) + read assigned/active courses
- **Student**: Read enrolled/available courses

### Assessments API (`/api/assessments/`)
- **Admin**: Full CRUD on all assessments
- **HOD**: CRUD on department assessments
- **Teacher**: Create + read assigned assessments
- **Student**: Read approved/scheduled assessments

### Submissions API (`/api/assessments/submissions/`)
- **Admin**: View all submissions
- **HOD**: View department submissions
- **Teacher**: View and grade course submissions
- **Student**: Create and view own submissions

### Announcements API (`/api/announcements/`)
- **Admin/HOD**: Create and read announcements
- **Teacher/Student**: Read relevant announcements only

---

## Frontend Feature Matrix

| Feature | Admin | HOD | Teacher | Student |
|---------|-------|-----|---------|---------|
| User Management | ✅ Full | ✅ Department | ❌ | ❌ |
| Department Management | ✅ Full | ✅ Own | ❌ | ❌ |
| Course Creation | ✅ Full | ✅ Department | ✅ Draft | ❌ |
| Course Approval | ✅ Full | ✅ Department | ❌ | ❌ |
| Assessment Creation | ✅ Full | ✅ Department | ✅ Draft | ❌ |
| Assessment Approval | ✅ Full | ✅ Department | ❌ | ❌ |
| Grade Management | ✅ Full | ✅ Department | ✅ Course | ❌ |
| Submission | ❌ | ❌ | ❌ | ✅ Own |
| Announcements | ✅ Send All | ✅ Send Dept | ❌ | ❌ |
| Analytics | ✅ Full | ✅ Department | ✅ Course | ✅ Own |

---

## Security & Permissions

### Authentication
- JWT-based authentication with 30-minute access tokens
- 7-day refresh tokens with rotation
- Automatic token blacklisting after rotation

### Authorization
- Role-based access control (RBAC)
- Object-level permissions using django-guardian
- Custom permission classes for granular control
- Query filtering based on user role and department

### Data Protection
- UUID primary keys for all models
- Automatic audit trails (created_by, updated_by, timestamps)
- Department-based data isolation
- Secure file upload with access controls

This comprehensive role-based system ensures that each user type has appropriate access and functionality while maintaining data security and privacy.