// Run: node explain-queries.js  -> proves your indexes are being used (IXSCAN vs COLLSCAN)
require('dotenv').config();
const mongoose = require('mongoose');
const Attendance = require('./src/models/Attendance');
const Employee = require('./src/models/Employee');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const emp = await Employee.findOne().lean();

  const plan1 = await Attendance.find({ employee: emp._id, date: { $gte: new Date('2026-01-01') } }).explain('executionStats');
  const s1 = plan1.executionStats;
  console.log('Attendance by employee+date ->', s1.executionStages.stage, '| docsExamined:', s1.totalDocsExamined, '| returned:', s1.nReturned);

  const plan2 = await Employee.find({ department: emp.department, status: 'Active' }).explain('executionStats');
  const s2 = plan2.executionStats;
  console.log('Employees by dept+status   ->', s2.executionStages.stage, '| docsExamined:', s2.totalDocsExamined, '| returned:', s2.nReturned);
  process.exit(0);
})();
