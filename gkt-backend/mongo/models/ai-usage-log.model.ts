import mongoose, { Schema } from 'mongoose';

const AiUsageLogSchema = new Schema({
  product_id:        { type: String, required: true },
  user_id:           { type: String },
  ticket_id:         { type: String },
  provider:          { type: String, required: true },
  model:             { type: String, required: true },
  feature:           { type: String, required: true },
  prompt_tokens:     { type: Number },
  completion_tokens: { type: Number },
  total_tokens:      { type: Number },
  latency_ms:        { type: Number },
  cost_usd:          { type: Number },
  success:           { type: Boolean, required: true },
  error_message:     { type: String },
  created_at:        { type: Date, default: Date.now },
});

AiUsageLogSchema.index({ product_id: 1, provider: 1, created_at: -1 });
AiUsageLogSchema.index({ product_id: 1, feature: 1, created_at: -1 });

export const AiUsageLog = mongoose.model('AiUsageLog', AiUsageLogSchema);
