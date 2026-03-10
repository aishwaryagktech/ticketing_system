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
exports.AiUsageLog = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const AiUsageLogSchema = new mongoose_1.Schema({
    product_id: { type: String, required: true },
    user_id: { type: String },
    ticket_id: { type: String },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    feature: { type: String, required: true },
    prompt_tokens: { type: Number },
    completion_tokens: { type: Number },
    total_tokens: { type: Number },
    latency_ms: { type: Number },
    cost_usd: { type: Number },
    success: { type: Boolean, required: true },
    error_message: { type: String },
    created_at: { type: Date, default: Date.now },
});
AiUsageLogSchema.index({ product_id: 1, provider: 1, created_at: -1 });
AiUsageLogSchema.index({ product_id: 1, feature: 1, created_at: -1 });
exports.AiUsageLog = mongoose_1.default.model('AiUsageLog', AiUsageLogSchema);
//# sourceMappingURL=ai-usage-log.model.js.map