import mongoose from 'mongoose';
export declare const Conversation: mongoose.Model<{
    created_at: NativeDate;
    updated_at: NativeDate;
    product_id: string;
    ticket_id: string;
    messages: mongoose.Types.DocumentArray<{
        created_at: NativeDate;
        body: string;
        message_id: string;
        author_id: string;
        author_name: string;
        is_internal: boolean;
        ai_suggested: boolean;
        ai_draft_accepted: boolean;
        attachments: mongoose.Types.DocumentArray<{
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }> & {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }>;
        sentiment?: string | null | undefined;
        author_type?: "user" | "system" | "agent" | "bot" | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        created_at: NativeDate;
        body: string;
        message_id: string;
        author_id: string;
        author_name: string;
        is_internal: boolean;
        ai_suggested: boolean;
        ai_draft_accepted: boolean;
        attachments: mongoose.Types.DocumentArray<{
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }> & {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }>;
        sentiment?: string | null | undefined;
        author_type?: "user" | "system" | "agent" | "bot" | null | undefined;
    }> & {
        created_at: NativeDate;
        body: string;
        message_id: string;
        author_id: string;
        author_name: string;
        is_internal: boolean;
        ai_suggested: boolean;
        ai_draft_accepted: boolean;
        attachments: mongoose.Types.DocumentArray<{
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }> & {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }>;
        sentiment?: string | null | undefined;
        author_type?: "user" | "system" | "agent" | "bot" | null | undefined;
    }>;
    type?: "ticket" | "bot" | null | undefined;
    tenant_id?: string | null | undefined;
    bot_session?: {
        kb_articles_used: string[];
        resolved_by_bot?: boolean | null | undefined;
        turns_count?: number | null | undefined;
        handoff_reason?: string | null | undefined;
        model_used?: string | null | undefined;
        ended_at?: NativeDate | null | undefined;
    } | null | undefined;
}, {}, {}, {}, mongoose.Document<unknown, {}, {
    created_at: NativeDate;
    updated_at: NativeDate;
    product_id: string;
    ticket_id: string;
    messages: mongoose.Types.DocumentArray<{
        created_at: NativeDate;
        body: string;
        message_id: string;
        author_id: string;
        author_name: string;
        is_internal: boolean;
        ai_suggested: boolean;
        ai_draft_accepted: boolean;
        attachments: mongoose.Types.DocumentArray<{
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }> & {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }>;
        sentiment?: string | null | undefined;
        author_type?: "user" | "system" | "agent" | "bot" | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        created_at: NativeDate;
        body: string;
        message_id: string;
        author_id: string;
        author_name: string;
        is_internal: boolean;
        ai_suggested: boolean;
        ai_draft_accepted: boolean;
        attachments: mongoose.Types.DocumentArray<{
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }> & {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }>;
        sentiment?: string | null | undefined;
        author_type?: "user" | "system" | "agent" | "bot" | null | undefined;
    }> & {
        created_at: NativeDate;
        body: string;
        message_id: string;
        author_id: string;
        author_name: string;
        is_internal: boolean;
        ai_suggested: boolean;
        ai_draft_accepted: boolean;
        attachments: mongoose.Types.DocumentArray<{
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }> & {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }>;
        sentiment?: string | null | undefined;
        author_type?: "user" | "system" | "agent" | "bot" | null | undefined;
    }>;
    type?: "ticket" | "bot" | null | undefined;
    tenant_id?: string | null | undefined;
    bot_session?: {
        kb_articles_used: string[];
        resolved_by_bot?: boolean | null | undefined;
        turns_count?: number | null | undefined;
        handoff_reason?: string | null | undefined;
        model_used?: string | null | undefined;
        ended_at?: NativeDate | null | undefined;
    } | null | undefined;
}, {}, mongoose.DefaultSchemaOptions> & {
    created_at: NativeDate;
    updated_at: NativeDate;
    product_id: string;
    ticket_id: string;
    messages: mongoose.Types.DocumentArray<{
        created_at: NativeDate;
        body: string;
        message_id: string;
        author_id: string;
        author_name: string;
        is_internal: boolean;
        ai_suggested: boolean;
        ai_draft_accepted: boolean;
        attachments: mongoose.Types.DocumentArray<{
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }> & {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }>;
        sentiment?: string | null | undefined;
        author_type?: "user" | "system" | "agent" | "bot" | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        created_at: NativeDate;
        body: string;
        message_id: string;
        author_id: string;
        author_name: string;
        is_internal: boolean;
        ai_suggested: boolean;
        ai_draft_accepted: boolean;
        attachments: mongoose.Types.DocumentArray<{
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }> & {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }>;
        sentiment?: string | null | undefined;
        author_type?: "user" | "system" | "agent" | "bot" | null | undefined;
    }> & {
        created_at: NativeDate;
        body: string;
        message_id: string;
        author_id: string;
        author_name: string;
        is_internal: boolean;
        ai_suggested: boolean;
        ai_draft_accepted: boolean;
        attachments: mongoose.Types.DocumentArray<{
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }> & {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }>;
        sentiment?: string | null | undefined;
        author_type?: "user" | "system" | "agent" | "bot" | null | undefined;
    }>;
    type?: "ticket" | "bot" | null | undefined;
    tenant_id?: string | null | undefined;
    bot_session?: {
        kb_articles_used: string[];
        resolved_by_bot?: boolean | null | undefined;
        turns_count?: number | null | undefined;
        handoff_reason?: string | null | undefined;
        model_used?: string | null | undefined;
        ended_at?: NativeDate | null | undefined;
    } | null | undefined;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, {
    created_at: NativeDate;
    updated_at: NativeDate;
    product_id: string;
    ticket_id: string;
    messages: mongoose.Types.DocumentArray<{
        created_at: NativeDate;
        body: string;
        message_id: string;
        author_id: string;
        author_name: string;
        is_internal: boolean;
        ai_suggested: boolean;
        ai_draft_accepted: boolean;
        attachments: mongoose.Types.DocumentArray<{
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }> & {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }>;
        sentiment?: string | null | undefined;
        author_type?: "user" | "system" | "agent" | "bot" | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        created_at: NativeDate;
        body: string;
        message_id: string;
        author_id: string;
        author_name: string;
        is_internal: boolean;
        ai_suggested: boolean;
        ai_draft_accepted: boolean;
        attachments: mongoose.Types.DocumentArray<{
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }> & {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }>;
        sentiment?: string | null | undefined;
        author_type?: "user" | "system" | "agent" | "bot" | null | undefined;
    }> & {
        created_at: NativeDate;
        body: string;
        message_id: string;
        author_id: string;
        author_name: string;
        is_internal: boolean;
        ai_suggested: boolean;
        ai_draft_accepted: boolean;
        attachments: mongoose.Types.DocumentArray<{
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }> & {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }>;
        sentiment?: string | null | undefined;
        author_type?: "user" | "system" | "agent" | "bot" | null | undefined;
    }>;
    type?: "ticket" | "bot" | null | undefined;
    tenant_id?: string | null | undefined;
    bot_session?: {
        kb_articles_used: string[];
        resolved_by_bot?: boolean | null | undefined;
        turns_count?: number | null | undefined;
        handoff_reason?: string | null | undefined;
        model_used?: string | null | undefined;
        ended_at?: NativeDate | null | undefined;
    } | null | undefined;
}, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    created_at: NativeDate;
    updated_at: NativeDate;
    product_id: string;
    ticket_id: string;
    messages: mongoose.Types.DocumentArray<{
        created_at: NativeDate;
        body: string;
        message_id: string;
        author_id: string;
        author_name: string;
        is_internal: boolean;
        ai_suggested: boolean;
        ai_draft_accepted: boolean;
        attachments: mongoose.Types.DocumentArray<{
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }> & {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }>;
        sentiment?: string | null | undefined;
        author_type?: "user" | "system" | "agent" | "bot" | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        created_at: NativeDate;
        body: string;
        message_id: string;
        author_id: string;
        author_name: string;
        is_internal: boolean;
        ai_suggested: boolean;
        ai_draft_accepted: boolean;
        attachments: mongoose.Types.DocumentArray<{
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }> & {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }>;
        sentiment?: string | null | undefined;
        author_type?: "user" | "system" | "agent" | "bot" | null | undefined;
    }> & {
        created_at: NativeDate;
        body: string;
        message_id: string;
        author_id: string;
        author_name: string;
        is_internal: boolean;
        ai_suggested: boolean;
        ai_draft_accepted: boolean;
        attachments: mongoose.Types.DocumentArray<{
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }> & {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }>;
        sentiment?: string | null | undefined;
        author_type?: "user" | "system" | "agent" | "bot" | null | undefined;
    }>;
    type?: "ticket" | "bot" | null | undefined;
    tenant_id?: string | null | undefined;
    bot_session?: {
        kb_articles_used: string[];
        resolved_by_bot?: boolean | null | undefined;
        turns_count?: number | null | undefined;
        handoff_reason?: string | null | undefined;
        model_used?: string | null | undefined;
        ended_at?: NativeDate | null | undefined;
    } | null | undefined;
}>, {}, mongoose.DefaultSchemaOptions> & mongoose.FlatRecord<{
    created_at: NativeDate;
    updated_at: NativeDate;
    product_id: string;
    ticket_id: string;
    messages: mongoose.Types.DocumentArray<{
        created_at: NativeDate;
        body: string;
        message_id: string;
        author_id: string;
        author_name: string;
        is_internal: boolean;
        ai_suggested: boolean;
        ai_draft_accepted: boolean;
        attachments: mongoose.Types.DocumentArray<{
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }> & {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }>;
        sentiment?: string | null | undefined;
        author_type?: "user" | "system" | "agent" | "bot" | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        created_at: NativeDate;
        body: string;
        message_id: string;
        author_id: string;
        author_name: string;
        is_internal: boolean;
        ai_suggested: boolean;
        ai_draft_accepted: boolean;
        attachments: mongoose.Types.DocumentArray<{
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }> & {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }>;
        sentiment?: string | null | undefined;
        author_type?: "user" | "system" | "agent" | "bot" | null | undefined;
    }> & {
        created_at: NativeDate;
        body: string;
        message_id: string;
        author_id: string;
        author_name: string;
        is_internal: boolean;
        ai_suggested: boolean;
        ai_draft_accepted: boolean;
        attachments: mongoose.Types.DocumentArray<{
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }> & {
            base64: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
        }>;
        sentiment?: string | null | undefined;
        author_type?: "user" | "system" | "agent" | "bot" | null | undefined;
    }>;
    type?: "ticket" | "bot" | null | undefined;
    tenant_id?: string | null | undefined;
    bot_session?: {
        kb_articles_used: string[];
        resolved_by_bot?: boolean | null | undefined;
        turns_count?: number | null | undefined;
        handoff_reason?: string | null | undefined;
        model_used?: string | null | undefined;
        ended_at?: NativeDate | null | undefined;
    } | null | undefined;
}> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=conversation.model.d.ts.map