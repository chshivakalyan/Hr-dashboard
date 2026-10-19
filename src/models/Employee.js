const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

const employeeSchema = new Schema(
  {
    empCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: [true, 'Name is required'], trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    phone: {
      type: String,
      validate: { validator: (v) => /^[6-9]\d{9}$/.test(v), message: 'Phone must be a valid 10-digit Indian number' },
    },
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    designation: { type: String, required: true, trim: true },
    salary: { type: Number, required: true, min: [0, 'Salary cannot be negative'] },
    joiningDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['Active', 'On Leave', 'Resigned'], default: 'Active' },
    manager: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    role: { type: String, enum: ['HR', 'Employee'], default: 'Employee' },
    password: { type: String, minlength: [6, 'Password must be at least 6 characters'], select: false, default: 'Welcome@123' },
  },
  { timestamps: true }
);

// Hash the password whenever it is new or changed
employeeSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('password')) this.password = await bcrypt.hash(this.password, 10);
  next();
});
employeeSchema.methods.matchPassword = function (plain) { return bcrypt.compare(plain, this.password); };

// Indexes (query optimization)
employeeSchema.index({ department: 1, status: 1 });        // list active people in a department
employeeSchema.index({ name: 'text', designation: 'text' }); // search box
employeeSchema.index({ joiningDate: -1 });                   // newest joiners first

module.exports = model('Employee', employeeSchema);
