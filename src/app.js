const path = require('path');
const express = require('express');
const routes = require('./routes');
const errorHandler = require('./middleware/error');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public'))); // frontend
app.get('/health', (req, res) => res.json({ status: 'HR Attendance API running' }));
app.use('/api', routes);
app.use(errorHandler);

module.exports = app;
