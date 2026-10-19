require('dotenv').config();
const mongoose = require('mongoose');
const Department = require('./models/Department');
const Employee = require('./models/Employee');
const Attendance = require('./models/Attendance');
const Leave = require('./models/Leave');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([Department.deleteMany(), Employee.deleteMany(), Attendance.deleteMany(), Leave.deleteMany()]);
  await Promise.all([Department.init(), Employee.init(), Attendance.init()]); // make sure indexes exist

  const depts = await Department.insertMany([{ name: 'Engineering' }, { name: 'HR' }, { name: 'Sales' }]);
  const titles = ['Developer', 'Analyst', 'Manager', 'Executive'];
  const names = ['Aarav', 'Diya', 'Rohan', 'Sneha', 'Kabir', 'Meera', 'Arjun', 'Isha', 'Vivaan', 'Anaya', 'Reyansh', 'Kiara'];

  // Employee.create (not insertMany) so the password-hashing hook runs
  const hr = await Employee.create({
    empCode: 'HR001', name: 'Priya Sharma', email: 'hr@company.com', phone: '9800000001',
    department: depts[1]._id, designation: 'HR Manager', salary: 70000, role: 'HR', password: 'Admin@123',
  });
  const staff = await Employee.create(
    names.map((n, i) => ({
      empCode: `EMP${String(i + 1).padStart(3, '0')}`,
      name: n,
      email: `${n.toLowerCase()}@company.com`,
      phone: `98${String(10000000 + i * 1111).slice(0, 8)}`,
      department: depts[i % 3]._id,
      designation: titles[i % 4],
      salary: 30000 + i * 5000,
    }))
  );
  const emps = [hr, ...staff];

  // 20 days of attendance history
  const rows = [];
  for (let d = 1; d <= 20; d++) {
    const day = new Date(); day.setDate(day.getDate() - d); day.setHours(0, 0, 0, 0);
    if ([0, 6].includes(day.getDay())) continue;
    for (const e of emps) {
      if (Math.random() < 0.08) continue; // absent
      const late = Math.random() < 0.2;
      const checkIn = new Date(day); checkIn.setHours(late ? 9 : 8, late ? 45 : 50, 0);
      const checkOut = new Date(day); checkOut.setHours(17 + Math.floor(Math.random() * 2), 30, 0);
      rows.push({ employee: e._id, date: day, checkIn, checkOut, status: late ? 'Late' : 'Present', workHours: +((checkOut - checkIn) / 36e5).toFixed(2) });
    }
  }
  await Attendance.insertMany(rows);

  // a couple of pending leave requests so HR has something to approve
  const soon = (n) => { const x = new Date(); x.setDate(x.getDate() + n); x.setHours(0, 0, 0, 0); return x; };
  await Leave.insertMany([
    { employee: staff[0]._id, type: 'Casual', from: soon(3), to: soon(4), reason: 'Family function' },
    { employee: staff[1]._id, type: 'Sick', from: soon(1), to: soon(1), reason: 'Fever' },
  ]);

  console.log(`Seeded ${depts.length} departments, ${emps.length} employees, ${rows.length} attendance records`);
  console.log('HR login:       hr@company.com    / Admin@123');
  console.log('Employee login: aarav@company.com / Welcome@123  (same password for all employees)');
  process.exit(0);
})();
