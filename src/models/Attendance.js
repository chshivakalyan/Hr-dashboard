const { Schema, model } = require('mongoose');

const attendanceSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true }, // normalized to 00:00 of the day
    checkIn: { type: Date },
    checkOut: { type: Date },
    status: { type: String, enum: ['Present', 'Late', 'Absent', 'Half Day', 'On Leave'], default: 'Present' },
    workHours: { type: Number, default: 0, min: 0, max: 24 },
  },
  { timestamps: true }
);

// One record per employee per day (also speeds up "today's record for X" lookups)
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
// Daily dashboards and department reports filter by date + status
attendanceSchema.index({ date: 1, status: 1 });

// Validation + derived data
attendanceSchema.pre('save', function (next) {
  if (this.checkIn && this.checkOut) {
    if (this.checkOut <= this.checkIn) return next(new Error('Check-out must be after check-in'));
    this.workHours = +((this.checkOut - this.checkIn) / 36e5).toFixed(2);
    if (this.workHours < 4) this.status = 'Half Day';
  }
  next();
});

module.exports = model('Attendance', attendanceSchema);
