const { Schema, model } = require('mongoose');

const departmentSchema = new Schema(
  {
    name: { type: String, required: [true, 'Department name is required'], unique: true, trim: true },
    description: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

module.exports = model('Department', departmentSchema);
