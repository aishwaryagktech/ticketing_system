import mongoose from 'mongoose';
export declare const EmailPayload: mongoose.Model<{
    product_id: string;
    from_email: string;
    to_email: string;
    is_reply: boolean;
    processing_status: "pending" | "processed" | "failed";
    received_at: NativeDate;
    headers?: any;
    from_name?: string | null | undefined;
    subject?: string | null | undefined;
    body_text?: string | null | undefined;
    body_html?: string | null | undefined;
    parsed_ticket_id?: string | null | undefined;
}, {}, {}, {}, mongoose.Document<unknown, {}, {
    product_id: string;
    from_email: string;
    to_email: string;
    is_reply: boolean;
    processing_status: "pending" | "processed" | "failed";
    received_at: NativeDate;
    headers?: any;
    from_name?: string | null | undefined;
    subject?: string | null | undefined;
    body_text?: string | null | undefined;
    body_html?: string | null | undefined;
    parsed_ticket_id?: string | null | undefined;
}, {}, mongoose.DefaultSchemaOptions> & {
    product_id: string;
    from_email: string;
    to_email: string;
    is_reply: boolean;
    processing_status: "pending" | "processed" | "failed";
    received_at: NativeDate;
    headers?: any;
    from_name?: string | null | undefined;
    subject?: string | null | undefined;
    body_text?: string | null | undefined;
    body_html?: string | null | undefined;
    parsed_ticket_id?: string | null | undefined;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, {
    product_id: string;
    from_email: string;
    to_email: string;
    is_reply: boolean;
    processing_status: "pending" | "processed" | "failed";
    received_at: NativeDate;
    headers?: any;
    from_name?: string | null | undefined;
    subject?: string | null | undefined;
    body_text?: string | null | undefined;
    body_html?: string | null | undefined;
    parsed_ticket_id?: string | null | undefined;
}, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    product_id: string;
    from_email: string;
    to_email: string;
    is_reply: boolean;
    processing_status: "pending" | "processed" | "failed";
    received_at: NativeDate;
    headers?: any;
    from_name?: string | null | undefined;
    subject?: string | null | undefined;
    body_text?: string | null | undefined;
    body_html?: string | null | undefined;
    parsed_ticket_id?: string | null | undefined;
}>, {}, mongoose.DefaultSchemaOptions> & mongoose.FlatRecord<{
    product_id: string;
    from_email: string;
    to_email: string;
    is_reply: boolean;
    processing_status: "pending" | "processed" | "failed";
    received_at: NativeDate;
    headers?: any;
    from_name?: string | null | undefined;
    subject?: string | null | undefined;
    body_text?: string | null | undefined;
    body_html?: string | null | undefined;
    parsed_ticket_id?: string | null | undefined;
}> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=email-payload.model.d.ts.map