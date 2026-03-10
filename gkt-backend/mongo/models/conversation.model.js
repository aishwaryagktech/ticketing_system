"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Conversation = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const AttachmentSchema = new mongoose_1.Schema({
    filename: { type: String, required: true },
    mime_type: { type: String, required: true },
    size_bytes: { type: Number, required: true },
    base64: { type: String, required: true },
}, { _id: false });
const MessageSchema = new mongoose_1.Schema({
    message_id: { type: String, required: true },
    author_type: { type: String, enum: ['user', 'agent', 'bot', 'system'] },
    author_id: { type: String, required: true },
    author_name: { type: String, required: true },
    body: { type: String, required: true },
    is_internal: { type: Boolean, default: false },
    sentiment: { type: String },
    ai_suggested: { type: Boolean, default: false },
    ai_draft_accepted: { type: Boolean, default: false },
    attachments: { type: [AttachmentSchema], default: [] },
    created_at: { type: Date, default: Date.now },
}, { _id: false });
const BotSessionSchema = new mongoose_1.Schema({
    resolved_by_bot: { type: Boolean },
    turns_count: { type: Number },
    handoff_reason: { type: String },
    model_used: { type: String },
    kb_articles_used: { type: [String], default: [] },
    ended_at: { type: Date },
}, { _id: false });
const ConversationSchema = new mongoose_1.Schema({
    product_id: { type: String, required: true, index: true },
    tenant_id: { type: String, default: null },
    ticket_id: { type: String, required: true },
    type: { type: String, enum: ['ticket', 'bot'] },
    messages: { type: [MessageSchema], default: [] },
    bot_session: { type: BotSessionSchema, default: null },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
});
ConversationSchema.index({ product_id: 1, ticket_id: 1 });
ConversationSchema.index({ product_id: 1, type: 1, created_at: -1 });
exports.Conversation = mongoose_1.default.model('Conversation', ConversationSchema);
//# sourceMappingURL=conversation.model.js.map