const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const { sign } = require('../config/jwt');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

exports.login = wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  const emp = await Employee.findOne({ email: email.toLowerCase().trim() }).select('+password').populate('department', 'name');
  if (!emp || emp.status === 'Resigned' || !(await emp.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  emp.password = undefined;
  res.json({ token: sign(emp), user: emp });
});

exports.me = wrap(async (req, res) => {
  res.json(await Employee.findById(req.user.id).populate('department', 'name'));
});

exports.changePassword = wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const emp = await Employee.findById(req.user.id).select('+password');
  if (!(await emp.matchPassword(currentPassword || ''))) return res.status(400).json({ message: 'Current password is incorrect' });
  emp.password = newPassword; // hashed by the pre-save hook (min length validated)
  await emp.save();
  res.json({ message: 'Password changed' });
});
