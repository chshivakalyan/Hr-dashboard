const { Schema, model } = require('mongoose');

const leaveSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    type: { type: String, enum: ['Casual', 'Sick', 'Earned', 'Unpaid'], required: true },
    from: { type: Date, required: true },
    to: {
      type: Date,
      required: true,
      validate: { validator: function (v) { return v >= this.from; }, message: '"to" date must be on or after "from" date' },
    },
    reason: { type: String, trim: true, maxlength: 300 },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  },
  { timestamps: true }
);

leaveSchema.index({ employee: 1, from: -1 });
leaveSchema.index({ status: 1, from: 1 });

module.exports = model('Leave', leaveSchema);
