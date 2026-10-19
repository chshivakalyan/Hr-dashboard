const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const dayStart = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

// POST /api/attendance/check-in  (logged-in user)
exports.checkIn = wrap(async (req, res) => {
  const emp = { _id: req.user.id, name: req.user.name }; // you can only check yourself in

  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const status = minutes > +(process.env.LATE_AFTER_MINUTES || 570) ? 'Late' : 'Present';

  const record = await Attendance.create({ employee: emp._id, date: dayStart(now), checkIn: now, status });
  const io = req.app.get('io');
  io.to('hr').emit('attendance:update', { type: 'check-in', employee: emp.name, status, time: now });
  io.to('user:' + emp._id).emit('me:update');
  res.status(201).json(record);
});

// POST /api/attendance/check-out  (logged-in user)
exports.checkOut = wrap(async (req, res) => {
  const record = await Attendance.findOne({ employee: req.user.id, date: dayStart() });
  if (!record) return res.status(404).json({ message: 'No check-in found for today' });
  if (record.checkOut) return res.status(400).json({ message: 'Already checked out' });

  record.checkOut = new Date();
  await record.save(); // triggers pre-save hook -> workHours
  const io = req.app.get('io');
  io.to('hr').emit('attendance:update', { type: 'check-out', employee: req.user.name, workHours: record.workHours });
  io.to('user:' + req.user.id).emit('me:update');
  res.json(record);
});

// GET /api/attendance/today  -> live board
exports.today = wrap(async (req, res) => {
  const data = await Attendance.find({ date: dayStart() })
    .populate('employee', 'empCode name designation')
    .sort({ checkIn: -1 })
    .lean();
  res.json({ count: data.length, data });
});

// GET /api/attendance/report/monthly?year=2026&month=10
exports.monthlyReport = wrap(async (req, res) => {
  const year = +req.query.year || new Date().getFullYear();
  const month = +req.query.month || new Date().getMonth() + 1;
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);

  const report = await Attendance.aggregate([
    { $match: { date: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: '$employee',
        present: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } },
        halfDays: { $sum: { $cond: [{ $eq: ['$status', 'Half Day'] }, 1, 0] } },
        onLeave: { $sum: { $cond: [{ $eq: ['$status', 'On Leave'] }, 1, 0] } },
        totalHours: { $sum: '$workHours' },
        avgHours: { $avg: '$workHours' },
      },
    },
    { $lookup: { from: 'employees', localField: '_id', foreignField: '_id', as: 'emp' } },
    { $unwind: '$emp' },
    {
      $project: {
        _id: 0, empCode: '$emp.empCode', name: '$emp.name',
        present: 1, late: 1, halfDays: 1, onLeave: 1,
        totalHours: { $round: ['$totalHours', 1] }, avgHours: { $round: ['$avgHours', 2] },
      },
    },
    { $sort: { name: 1 } },
  ]);
  res.json({ year, month, report });
});

// GET /api/attendance/report/department?date=2026-10-18
exports.departmentReport = wrap(async (req, res) => {
  const date = dayStart(req.query.date ? new Date(req.query.date) : new Date());
  const report = await Attendance.aggregate([
    { $match: { date } },
    { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'emp' } },
    { $unwind: '$emp' },
    { $group: { _id: '$emp.department', present: { $sum: 1 }, late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } } } },
    { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
    { $unwind: '$dept' },
    { $project: { _id: 0, department: '$dept.name', present: 1, late: 1 } },
  ]);
  res.json({ date, report });
});

// GET /api/attendance/report/absentees?date=...  -> active employees with no record that day
exports.absentees = wrap(async (req, res) => {
  const date = dayStart(req.query.date ? new Date(req.query.date) : new Date());
  const absent = await Employee.aggregate([
    { $match: { status: 'Active' } },
    { $lookup: { from: 'attendances', let: { id: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$employee', '$$id'] }, { $eq: ['$date', date] }] } } }], as: 'att' } },
    { $match: { att: { $size: 0 } } },
    { $project: { empCode: 1, name: 1, designation: 1 } },
  ]);
  res.json({ date, count: absent.length, absent });
});

// GET /api/attendance/report/top-late?limit=5  -> most frequent late comers
exports.topLate = wrap(async (req, res) => {
  const top = await Attendance.aggregate([
    { $match: { status: 'Late' } },
    { $group: { _id: '$employee', lateCount: { $sum: 1 } } },
    { $sort: { lateCount: -1 } },
    { $limit: +req.query.limit || 5 },
    { $lookup: { from: 'employees', localField: '_id', foreignField: '_id', as: 'emp' } },
    { $unwind: '$emp' },
    { $project: { _id: 0, name: '$emp.name', empCode: '$emp.empCode', lateCount: 1 } },
  ]);
  res.json(top);
});

// GET /api/attendance/me/today -> my record for today (or null)
exports.myToday = wrap(async (req, res) => {
  res.json(await Attendance.findOne({ employee: req.user.id, date: dayStart() }).lean());
});

// GET /api/attendance/me?year&month   (employee: own report)
// GET /api/attendance/employee/:id?year&month   (HR: anyone's report)
exports.employeeReport = wrap(async (req, res) => {
  const id = req.params.id || req.user.id;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid employee id' });
  const year = +req.query.year || new Date().getFullYear();
  const month = +req.query.month || new Date().getMonth() + 1;
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);
  const range = { $gte: from, $lt: to };

  const [records, agg] = await Promise.all([
    Attendance.find({ employee: id, date: range }).select('date checkIn checkOut workHours status').sort({ date: -1 }).lean(),
    Attendance.aggregate([
      { $match: { employee: new mongoose.Types.ObjectId(id), date: range } },
      { $group: {
          _id: null,
          present: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } },
          halfDays: { $sum: { $cond: [{ $eq: ['$status', 'Half Day'] }, 1, 0] } },
          onLeave: { $sum: { $cond: [{ $eq: ['$status', 'On Leave'] }, 1, 0] } },
          totalHours: { $sum: '$workHours' },
          avgHours: { $avg: '$workHours' } } },
    ]),
  ]);

  // weekdays elapsed this month, so we can estimate absent days
  let workingDays = 0;
  const last = new Date(Math.min(to - 1, Date.now()));
  for (let d = new Date(from); d <= last; d.setDate(d.getDate() + 1)) if (![0, 6].includes(d.getDay())) workingDays++;

  const a = agg[0] || {};
  const summary = {
    workingDays, present: a.present || 0, late: a.late || 0, halfDays: a.halfDays || 0, onLeave: a.onLeave || 0,
    absent: Math.max(workingDays - records.length, 0),
    totalHours: +(a.totalHours || 0).toFixed(1), avgHours: +(a.avgHours || 0).toFixed(2),
  };
  res.json({ year, month, summary, records });
});
