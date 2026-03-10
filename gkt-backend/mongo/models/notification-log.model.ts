import mongoose, { Schema } from 'mongoose';

const NotificationLogSchema = new Schema({
  product_id:          { type: String, required: true },
  notification_id:     { type: String },
  user_id:             { type: String },
  channel:             { type: String, enum: ['in_app', 'email', 'sms'] },
  provider:            { type: String },
  status:              { type: String, enum: ['sent', 'delivered', 'failed', 'bounced'] },
  provider_message_id: { type: String },
  error:               { type: String },
  sent_at:             { type: Date, default: Date.now },
});

export const NotificationLog = mongoose.model('NotificationLog', NotificationLogSchema);
