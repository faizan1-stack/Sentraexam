# Sentraexam Frontend

React-based frontend application for the Sentraexam academic management platform.

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Ant Design (antd)
- **Routing**: React Router v6
- **State Management**:
  - React Context API (Authentication)
  - TanStack Query / React Query (Server state)
- **HTTP Client**: Axios
- **Form Handling**: React Hook Form + Ant Design Form

## Prerequisites

- Node.js 18+ and npm
- Backend API running at `http://localhost:8000` (or update `.env`)

## Getting Started

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

The `.env` file should already exist with:

```
VITE_API_BASE_URL=http://localhost:8000/api
```

Update this if your backend runs on a different URL.

### 3. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### 4. Build for Production

```bash
npm run build
```

The production build will be in the `dist/` folder.

### 5. Preview Production Build

```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── api/                 # API service layer & React Query hooks
│   │   ├── client.ts        # Axios instance with interceptors
│   │   ├── auth.ts          # Authentication API
│   │   ├── users.ts         # User management API
│   │   └── departments.ts   # Department management API
│   │
│   ├── components/          # Reusable components
│   │   └── ProtectedRoute.tsx
│   │
│   ├── contexts/            # React Context providers
│   │   └── AuthContext.tsx  # Authentication context
│   │
│   ├── features/            # Feature-based modules
│   │   ├── auth/            # Authentication features
│   │   ├── users/           # User management
│   │   │   └── pages/       # User CRUD pages
│   │   ├── departments/     # Department management
│   │   │   └── pages/       # Department CRUD pages
│   │   ├── courses/         # (To be implemented)
│   │   ├── assessments/     # (To be implemented)
│   │   └── notifications/   # (To be implemented)
│   │
│   ├── layouts/             # Layout components
│   │   ├── AuthLayout.tsx   # Layout for login/signup pages
│   │   └── DashboardLayout.tsx  # Main dashboard with sidebar
│   │
│   ├── pages/               # Top-level page components
│   │   ├── auth/            # Auth pages (Login, Reset, Activate)
│   │   └── DashboardHome.tsx
│   │
│   ├── routes/              # Route configuration
│   │   └── index.tsx        # All application routes
│   │
│   ├── types/               # TypeScript type definitions
│   │   └── index.ts         # All API types & interfaces
│   │
│   ├── App.tsx              # Main app with providers
│   └── main.tsx             # Application entry point
│
├── .env                     # Environment variables
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Features Implemented

### Phase 1: Foundation & Authentication ✅
- [x] Project setup with Vite + TypeScript
- [x] Ant Design configuration
- [x] API client with Axios interceptors
- [x] JWT authentication with token refresh
- [x] Login page
- [x] Password reset flow
- [x] Account activation flow
- [x] Protected routes
- [x] Dashboard layout with sidebar navigation

### Phase 2: User & Department Management ✅
- [x] User list with search and filters
- [x] Create new user
- [x] Edit user
- [x] Delete user
- [x] Department list
- [x] Create department
- [x] Edit department
- [x] Delete department

### Phase 3-5: To Be Implemented
- [ ] Course management (CRUD + enrollment)
- [ ] Assessment management (CRUD + submissions + grading)
- [ ] Notifications & Announcements
- [ ] Document management with file upload
- [ ] Academic calendar & timetable
- [ ] User profile page
- [ ] Settings page

## User Roles & Access Control

The application supports 4 user roles:

1. **ADMIN** - Full access to all features
2. **HOD** (Head of Department) - Manage department, courses, assessments
3. **TEACHER** - Create courses, assessments, grade submissions
4. **STUDENT** - View courses, submit assessments, view grades

Routes are protected based on roles using the `ProtectedRoute` component.

## Authentication Flow

1. User logs in with email/password at `/login`
2. Backend returns JWT access + refresh tokens
3. Tokens stored in localStorage
4. Access token sent with every API request via Axios interceptor
5. On 401 error, auto-refresh token using refresh token
6. If refresh fails, redirect to login

## API Integration

All API calls use React Query hooks for:
- Automatic caching
- Background refetching
- Optimistic updates
- Error handling
- Loading states

Example:
```typescript
// Using the users API
const { data, isLoading } = useUsers({ role: 'STUDENT' });
const createMutation = useCreateUser();
```

## Default Login Credentials

After running Django's `createsuperuser`, use those credentials. Otherwise, create a user via Django admin.

## Common Development Tasks

### Add a new feature module

1. Create folder in `src/features/<feature-name>/`
2. Add `pages/`, `components/`, etc.
3. Create API service in `src/api/<feature>.ts`
4. Add routes in `src/routes/index.tsx`
5. Update sidebar menu in `DashboardLayout.tsx`

### Add TypeScript types

Add new interfaces to `src/types/index.ts`

### Debugging API calls

Check the browser's Network tab or add console logs in `src/api/client.ts` interceptors.

## Troubleshooting

### CORS errors
Make sure Django backend has CORS enabled for `http://localhost:5173` (already configured in Django settings).

### 401 Unauthorized errors
Check that tokens are being stored and sent correctly. Clear localStorage and log in again.

### Build errors
Delete `node_modules` and `package-lock.json`, then run `npm install` again.

## Next Steps

1. Implement remaining features (Courses, Assessments, etc.)
2. Add form validation improvements
3. Add loading skeletons
4. Implement real-time notifications (WebSocket)
5. Add dark mode support
6. Improve responsive design for mobile
7. Add unit tests with Vitest
8. Add E2E tests with Playwright

## Contributing

When adding new features, follow the existing patterns:
- Use React Query for API calls
- Use Ant Design components
- Follow the feature-based folder structure
- Add TypeScript types for all data
- Implement proper error handling
