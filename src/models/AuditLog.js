const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  method: { type: String, required: true },
  route: { type: String, required: true },
  statusCode: { type: Number, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requestBody: {},
  responseBody: {},
  createdAt: { type: Date, default: Date.now }
});

auditLogSchema.index({ route: 1, createdAt: -1 });
auditLogSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);


