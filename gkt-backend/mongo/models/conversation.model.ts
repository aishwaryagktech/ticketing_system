import mongoose, { Schema, Document } from 'mongoose';

const AttachmentSchema = new Schema({
  filename:   { type: String, required: true },
  mime_type:  { type: String, required: true },
  size_bytes: { type: Number, required: true },
  base64:     { type: String, required: true },
}, { _id: false });

const MessageSchema = new Schema({
  message_id:        { type: String, required: true },
  author_type:       { type: String, enum: ['user', 'agent', 'bot', 'system'] },
  author_id:         { type: String, required: true },
  author_name:       { type: String, required: true },
  body:              { type: String, required: true },
  is_internal:       { type: Boolean, default: false },
  sentiment:         { type: String },
  ai_suggested:      { type: Boolean, default: false },
  ai_draft_accepted: { type: Boolean, default: false },
  attachments:       { type: [AttachmentSchema], default: [] },
  created_at:        { type: Date, default: Date.now },
}, { _id: false });

const BotSessionSchema = new Schema({
  resolved_by_bot:  { type: Boolean },
  turns_count:      { type: Number },
  handoff_reason:   { type: String },
  handoff_ticket_id:{ type: String },
  model_used:       { type: String },
  kb_articles_used: { type: [String], default: [] },
  ended_at:         { type: Date },
}, { _id: false });

// Stores FlowPay app logs fetched at session start for AI context
const AppLogsSchema = new Schema({
  fetched_at:  { type: Date,     default: null },
  user_id:     { type: String,   default: null },
  session_id:  { type: String,   default: null },
  raw_text:    { type: String,   default: null },
  error_count: { type: Number,   default: 0    },
  issue_types: { type: [String], default: []   },
}, { _id: false });

const ConversationSchema = new Schema({
  // For bot conversations, we use tenant_product_id as the scoping key.
  tenant_product_id: { type: String, required: true, index: true },
  tenant_id:         { type: String, default: null },
  session_id:        { type: String, default: null, index: true },
  ticket_id:         { type: String, default: null, index: true },
  type:              { type: String, enum: ['ticket', 'bot', 'human'] },
  gmail_thread_id:   { type: String, default: null },
  messages:    { type: [MessageSchema], default: [] },
  bot_session: { type: BotSessionSchema, default: null },
  app_logs:    { type: AppLogsSchema,    default: null },
  created_at:  { type: Date, default: Date.now },
  updated_at:  { type: Date, default: Date.now },
});

ConversationSchema.index({ tenant_product_id: 1, session_id: 1 });
ConversationSchema.index({ tenant_product_id: 1, ticket_id: 1 });
ConversationSchema.index({ tenant_product_id: 1, type: 1, created_at: -1 });

export const Conversation = mongoose.model('Conversation', ConversationSchema);
