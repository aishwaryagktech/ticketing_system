import mongoose, { Schema } from 'mongoose';

const GmailAuthSchema = new Schema({
  email: { type: String, required: true, unique: true, index: true },
  tokens: { type: Schema.Types.Mixed, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

GmailAuthSchema.pre('save', function (next) {
  // @ts-ignore
  this.updated_at = new Date();
  next();
});

export const GmailAuth = mongoose.model('GmailAuth', GmailAuthSchema);

