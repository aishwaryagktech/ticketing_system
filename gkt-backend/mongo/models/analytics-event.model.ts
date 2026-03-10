import mongoose, { Schema } from 'mongoose';

const AnalyticsEventSchema = new Schema({
  product_id: { type: String, required: true },
  tenant_id:  { type: String, default: null },
  user_type:  { type: String },
  event_type: { type: String, required: true },
  actor_id:   { type: String },
  ticket_id:  { type: String },
  metadata:   { type: Schema.Types.Mixed, default: {} },
  date:       { type: Date },
  created_at: { type: Date, default: Date.now, expires: '365d' },
});

AnalyticsEventSchema.index({ product_id: 1, event_type: 1, date: -1 });
AnalyticsEventSchema.index({ product_id: 1, tenant_id: 1, event_type: 1 });

export const AnalyticsEvent = mongoose.model('AnalyticsEvent', AnalyticsEventSchema);
