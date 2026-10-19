module.exports = (err, req, res, next) => {
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: 'Validation failed', errors });
  }
  if (err.name === 'CastError') return res.status(400).json({ message: `Invalid ${err.path}: ${err.value}` });
  if (err.code === 11000) {
    return res.status(409).json({ message: `Duplicate value for: ${Object.keys(err.keyValue).join(', ')}` });
  }
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
};
