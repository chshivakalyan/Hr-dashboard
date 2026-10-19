const jwt = require('jsonwebtoken');

const secret = () => process.env.JWT_SECRET || 'dev-only-secret-change-me';
exports.sign = (emp) => jwt.sign({ id: emp._id, role: emp.role }, secret(), { expiresIn: '8h' });
exports.verify = (token) => jwt.verify(token, secret());
