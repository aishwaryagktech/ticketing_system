import mongoose from 'mongoose';
export declare const AiUsageLog: mongoose.Model<{
    created_at: NativeDate;
    product_id: string;
    model: string;
    provider: string;
    feature: string;
    success: boolean;
    user_id?: string | null | undefined;
    ticket_id?: string | null | undefined;
    prompt_tokens?: number | null | undefined;
    completion_tokens?: number | null | undefined;
    total_tokens?: number | null | undefined;
    latency_ms?: number | null | undefined;
    cost_usd?: number | null | undefined;
    error_message?: string | null | undefined;
}, {}, {}, {}, mongoose.Document<unknown, {}, {
    created_at: NativeDate;
    product_id: string;
    model: string;
    provider: string;
    feature: string;
    success: boolean;
    user_id?: string | null | undefined;
    ticket_id?: string | null | undefined;
    prompt_tokens?: number | null | undefined;
    completion_tokens?: number | null | undefined;
    total_tokens?: number | null | undefined;
    latency_ms?: number | null | undefined;
    cost_usd?: number | null | undefined;
    error_message?: string | null | undefined;
}, {}, mongoose.DefaultSchemaOptions> & {
    created_at: NativeDate;
    product_id: string;
    model: string;
    provider: string;
    feature: string;
    success: boolean;
    user_id?: string | null | undefined;
    ticket_id?: string | null | undefined;
    prompt_tokens?: number | null | undefined;
    completion_tokens?: number | null | undefined;
    total_tokens?: number | null | undefined;
    latency_ms?: number | null | undefined;
    cost_usd?: number | null | undefined;
    error_message?: string | null | undefined;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, {
    created_at: NativeDate;
    product_id: string;
    model: string;
    provider: string;
    feature: string;
    success: boolean;
    user_id?: string | null | undefined;
    ticket_id?: string | null | undefined;
    prompt_tokens?: number | null | undefined;
    completion_tokens?: number | null | undefined;
    total_tokens?: number | null | undefined;
    latency_ms?: number | null | undefined;
    cost_usd?: number | null | undefined;
    error_message?: string | null | undefined;
}, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    created_at: NativeDate;
    product_id: string;
    model: string;
    provider: string;
    feature: string;
    success: boolean;
    user_id?: string | null | undefined;
    ticket_id?: string | null | undefined;
    prompt_tokens?: number | null | undefined;
    completion_tokens?: number | null | undefined;
    total_tokens?: number | null | undefined;
    latency_ms?: number | null | undefined;
    cost_usd?: number | null | undefined;
    error_message?: string | null | undefined;
}>, {}, mongoose.DefaultSchemaOptions> & mongoose.FlatRecord<{
    created_at: NativeDate;
    product_id: string;
    model: string;
    provider: string;
    feature: string;
    success: boolean;
    user_id?: string | null | undefined;
    ticket_id?: string | null | undefined;
    prompt_tokens?: number | null | undefined;
    completion_tokens?: number | null | undefined;
    total_tokens?: number | null | undefined;
    latency_ms?: number | null | undefined;
    cost_usd?: number | null | undefined;
    error_message?: string | null | undefined;
}> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=ai-usage-log.model.d.ts.map