const Employee = require('../models/Employee');
const Department = require('../models/Department');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ---- Departments ----
exports.createDepartment = wrap(async (req, res) => res.status(201).json(await Department.create(req.body)));
exports.getDepartments = wrap(async (req, res) => res.json(await Department.find().lean()));

// ---- Employees: CRUD ----
exports.createEmployee = wrap(async (req, res) => {
  const emp = await Employee.create(req.body); // password defaults to Welcome@123 if HR leaves it blank
  emp.password = undefined;
  res.status(201).json(emp);
});

// HR resets someone's password back to the default
exports.resetPassword = wrap(async (req, res) => {
  const emp = await Employee.findById(req.params.id).select('+password');
  if (!emp) return res.status(404).json({ message: 'Employee not found' });
  emp.password = 'Welcome@123';
  await emp.save();
  res.json({ message: `Password for ${emp.name} reset to Welcome@123` });
});

exports.getEmployees = wrap(async (req, res) => {
  const { department, status, search, page = 1, limit = 10 } = req.query;
  const filter = {};
  if (department) filter.department = department;
  if (status) filter.status = status;
  if (search) filter.$text = { $search: search };

  const skip = (Math.max(+page, 1) - 1) * +limit;
  const [data, total] = await Promise.all([
    Employee.find(filter)
      .select('empCode name email designation department status role') // projection
      .populate('department', 'name')
      .sort({ joiningDate: -1 })
      .skip(skip)
      .limit(+limit)
      .lean(), // plain objects = faster
    Employee.countDocuments(filter),
  ]);
  res.json({ total, page: +page, pages: Math.ceil(total / limit), data });
});

exports.getEmployee = wrap(async (req, res) => {
  const emp = await Employee.findById(req.params.id).populate('department manager', 'name empCode');
  if (!emp) return res.status(404).json({ message: 'Employee not found' });
  res.json(emp);
});

exports.updateEmployee = wrap(async (req, res) => {
  delete req.body.password; // passwords change only through the dedicated endpoints
  // runValidators is needed so schema validation also runs on updates
  const emp = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!emp) return res.status(404).json({ message: 'Employee not found' });
  res.json(emp);
});

exports.deleteEmployee = wrap(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ message: 'You cannot resign your own account' });
  // soft delete keeps attendance history intact
  const emp = await Employee.findByIdAndUpdate(req.params.id, { status: 'Resigned' }, { new: true });
  if (!emp) return res.status(404).json({ message: 'Employee not found' });
  res.json({ message: 'Employee marked as Resigned', employee: emp });
});

// ---- Aggregation: headcount + average salary per department ----
exports.departmentStats = wrap(async (req, res) => {
  const stats = await Employee.aggregate([
    { $match: { status: { $ne: 'Resigned' } } },
    { $group: { _id: '$department', headcount: { $sum: 1 }, avgSalary: { $avg: '$salary' }, totalPayroll: { $sum: '$salary' } } },
    { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
    { $unwind: '$dept' },
    { $project: { _id: 0, department: '$dept.name', headcount: 1, avgSalary: { $round: ['$avgSalary', 0] }, totalPayroll: 1 } },
    { $sort: { headcount: -1 } },
  ]);
  res.json(stats);
});
