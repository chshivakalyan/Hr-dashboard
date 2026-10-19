# Real-Time Employee Attendance & HR Management System

Node.js + Express + Mongoose + MongoDB + Socket.IO

## Setup
```bash
npm install
cp .env.example .env     # set MONGO_URI (local or Atlas)
npm run seed             # 12 employees + ~20 days of attendance
npm run dev
```

## Syllabus coverage
| Concept | Where |
|---|---|
| CRUD | `employeeController.js`, `leaveController.js`, check-in/out in `attendanceController.js` |
| Data validation | Schema validators (regex email, phone, enum, min/max, custom `to >= from`), `pre('save')` hook in `Attendance.js`, `runValidators` on updates, central error handler |
| Aggregation | `$match $group $lookup $unwind $project $sort $cond $avg` in monthly, department, absentee and top-late reports |
| Indexing | Unique, compound, text and sorted indexes in each model |
| Query optimization | `.lean()`, `.select()` projections, pagination, `Promise.all`, compound indexes, `explain-queries.js` |
| Real-time | Socket.IO events `attendance:update`, `leave:new`, `leave:update` |

## API
| Method | Endpoint | Purpose |
|---|---|---|
| POST/GET | /api/departments | create / list |
| POST/GET | /api/employees | create / list (?department&status&search&page&limit) |
| GET/PUT/DELETE | /api/employees/:id | read / update / soft delete |
| GET | /api/employees/stats/departments | headcount + payroll per department |
| POST | /api/attendance/check-in `{employeeId}` | auto Late after 09:30 |
| POST | /api/attendance/check-out `{employeeId}` | computes workHours |
| GET | /api/attendance/today | live board |
| GET | /api/attendance/report/monthly?year&month | per-employee summary |
| GET | /api/attendance/report/department?date | dept-wise attendance |
| GET | /api/attendance/report/absentees?date | who hasn't checked in |
| GET | /api/attendance/report/top-late?limit | frequent late comers |
| POST/GET | /api/leaves | apply / list |
| PATCH | /api/leaves/:id `{status}` | approve/reject (approve auto-marks "On Leave") |

## Live dashboard test (browser console)
```html
<script src="/socket.io/socket.io.js"></script>
<script>io().on('attendance:update', console.log)</script>
```

## Login & roles
Run `npm run seed`, then sign in at http://localhost:5000

| Role | Login | Can do |
|---|---|---|
| HR | hr@company.com / Admin@123 | add/resign employees, reset passwords, approve/reject leave, live dashboard, all reports, view any employee's attendance |
| Employee | aarav@company.com / Welcome@123 (all employees) | check in/out, view own login-time report by month, apply for leave and track status, change password |

Security notes: passwords are hashed with bcrypt, logins use JWT (8h), every route is protected, HR-only routes return 403 for employees, employees can only check themselves in, and HR cannot approve their own leave. Live updates (Socket.IO) require a valid token; HR receives the company-wide feed, employees only their own updates.
