const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const auth = require('../controllers/authController');
const emp = require('../controllers/employeeController');
const att = require('../controllers/attendanceController');
const leave = require('../controllers/leaveController');

const hr = restrictTo('HR');

// Public
router.post('/auth/login', auth.login);

// Everything below needs a valid login
router.use(protect);
router.get('/auth/me', auth.me);
router.post('/auth/change-password', auth.changePassword);

// Departments
router.route('/departments').get(emp.getDepartments).post(hr, emp.createDepartment);

// Employees (HR only)
router.route('/employees').post(hr, emp.createEmployee).get(hr, emp.getEmployees);
router.get('/employees/stats/departments', hr, emp.departmentStats);
router.patch('/employees/:id/reset-password', hr, emp.resetPassword);
router.route('/employees/:id').get(hr, emp.getEmployee).put(hr, emp.updateEmployee).delete(hr, emp.deleteEmployee);

// Attendance - self service
router.post('/attendance/check-in', att.checkIn);
router.post('/attendance/check-out', att.checkOut);
router.get('/attendance/me/today', att.myToday);
router.get('/attendance/me', att.employeeReport);
// Attendance - HR
router.get('/attendance/today', hr, att.today);
router.get('/attendance/employee/:id', hr, att.employeeReport);
router.get('/attendance/report/monthly', hr, att.monthlyReport);
router.get('/attendance/report/department', hr, att.departmentReport);
router.get('/attendance/report/absentees', hr, att.absentees);
router.get('/attendance/report/top-late', hr, att.topLate);

// Leaves
router.post('/leaves', leave.applyLeave);
router.get('/leaves/me', leave.myLeaves);
router.get('/leaves', hr, leave.getLeaves);
router.patch('/leaves/:id', hr, leave.reviewLeave);

module.exports = router;
