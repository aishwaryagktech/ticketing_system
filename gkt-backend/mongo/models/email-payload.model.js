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
exports.EmailPayload = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const EmailPayloadSchema = new mongoose_1.Schema({
    product_id: { type: String, required: true, index: true },
    from_email: { type: String, required: true },
    from_name: { type: String },
    to_email: { type: String, required: true },
    subject: { type: String },
    body_text: { type: String },
    body_html: { type: String },
    headers: { type: mongoose_1.Schema.Types.Mixed },
    parsed_ticket_id: { type: String },
    is_reply: { type: Boolean, default: false },
    processing_status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
    received_at: { type: Date, default: Date.now },
});
exports.EmailPayload = mongoose_1.default.model('EmailPayload', EmailPayloadSchema);
//# sourceMappingURL=email-payload.model.js.map