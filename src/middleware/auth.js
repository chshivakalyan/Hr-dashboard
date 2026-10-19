const { verify } = require('../config/jwt');
const Employee = require('../models/Employee');

// Requires a valid "Authorization: Bearer <token>" header
exports.protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ message: 'Please log in first' });
    const payload = verify(header.slice(7));
    const emp = await Employee.findById(payload.id).select('name role status').lean();
    if (!emp || emp.status === 'Resigned') return res.status(401).json({ message: 'Account no longer active' });
    req.user = { id: String(emp._id), role: emp.role, name: emp.name };
    next();
  } catch (e) {
    res.status(401).json({ message: 'Session expired, please log in again' });
  }
};

// Role guard, e.g. restrictTo('HR')
exports.restrictTo = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Only HR can do this' });
