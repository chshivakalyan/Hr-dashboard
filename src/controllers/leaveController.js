const Leave = require('../models/Leave');
const Attendance = require('../models/Attendance');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Employee applies for their own leave (employee + status can't be faked from the client)
exports.applyLeave = wrap(async (req, res) => {
  const { type, from, to, reason } = req.body;
  const leave = await Leave.create({ employee: req.user.id, type, from, to, reason, status: 'Pending' });
  req.app.get('io').to('hr').emit('leave:new', { id: leave._id, employee: req.user.name, type: leave.type });
  res.status(201).json(leave);
});

// GET /api/leaves/me
exports.myLeaves = wrap(async (req, res) => {
  res.json(await Leave.find({ employee: req.user.id }).sort({ from: -1 }).lean());
});

// GET /api/leaves  (HR)
exports.getLeaves = wrap(async (req, res) => {
  const { status, employee } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (employee) filter.employee = employee;
  res.json(await Leave.find(filter).populate('employee', 'empCode name').sort({ from: -1 }).lean());
});

// PATCH /api/leaves/:id  { status: "Approved" | "Rejected" }  (HR, not for their own leave)
exports.reviewLeave = wrap(async (req, res) => {
  const { status } = req.body;
  if (!['Approved', 'Rejected'].includes(status)) return res.status(400).json({ message: 'Status must be Approved or Rejected' });

  const leave = await Leave.findOneAndUpdate(
    { _id: req.params.id, status: 'Pending', employee: { $ne: req.user.id } },
    { status },
    { new: true }
  );
  if (!leave) return res.status(404).json({ message: 'Pending leave request not found (you cannot review your own leave)' });

  if (status === 'Approved') {
    // bulk-create "On Leave" attendance rows for every day in the range
    const ops = [];
    for (let d = new Date(leave.from); d <= leave.to; d.setDate(d.getDate() + 1)) {
      const day = new Date(d); day.setHours(0, 0, 0, 0);
      ops.push({
        updateOne: {
          filter: { employee: leave.employee, date: day },
          update: { $setOnInsert: { employee: leave.employee, date: day, status: 'On Leave' } },
          upsert: true,
        },
      });
    }
    await Attendance.bulkWrite(ops);
  }
  const io = req.app.get('io');
  io.to('user:' + leave.employee).emit('leave:update', { id: leave._id, status });
  io.to('hr').emit('leave:update', { id: leave._id, status });
  res.json(leave);
});
