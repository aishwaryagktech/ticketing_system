import mongoose, { Schema } from 'mongoose';

const EmailPayloadSchema = new Schema({
  product_id:        { type: String, required: true, index: true },
  from_email:        { type: String, required: true },
  from_name:         { type: String },
  to_email:          { type: String, required: true },
  subject:           { type: String },
  body_text:         { type: String },
  body_html:         { type: String },
  headers:           { type: Schema.Types.Mixed },
  parsed_ticket_id:  { type: String },
  is_reply:          { type: Boolean, default: false },
  processing_status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
  received_at:       { type: Date, default: Date.now },
});

export const EmailPayload = mongoose.model('EmailPayload', EmailPayloadSchema);
