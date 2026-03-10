import mongoose from 'mongoose';
export declare const NotificationLog: mongoose.Model<{
    product_id: string;
    sent_at: NativeDate;
    error?: string | null | undefined;
    status?: "failed" | "sent" | "delivered" | "bounced" | null | undefined;
    user_id?: string | null | undefined;
    provider?: string | null | undefined;
    notification_id?: string | null | undefined;
    channel?: "email" | "in_app" | "sms" | null | undefined;
    provider_message_id?: string | null | undefined;
}, {}, {}, {}, mongoose.Document<unknown, {}, {
    product_id: string;
    sent_at: NativeDate;
    error?: string | null | undefined;
    status?: "failed" | "sent" | "delivered" | "bounced" | null | undefined;
    user_id?: string | null | undefined;
    provider?: string | null | undefined;
    notification_id?: string | null | undefined;
    channel?: "email" | "in_app" | "sms" | null | undefined;
    provider_message_id?: string | null | undefined;
}, {}, mongoose.DefaultSchemaOptions> & {
    product_id: string;
    sent_at: NativeDate;
    error?: string | null | undefined;
    status?: "failed" | "sent" | "delivered" | "bounced" | null | undefined;
    user_id?: string | null | undefined;
    provider?: string | null | undefined;
    notification_id?: string | null | undefined;
    channel?: "email" | "in_app" | "sms" | null | undefined;
    provider_message_id?: string | null | undefined;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, {
    product_id: string;
    sent_at: NativeDate;
    error?: string | null | undefined;
    status?: "failed" | "sent" | "delivered" | "bounced" | null | undefined;
    user_id?: string | null | undefined;
    provider?: string | null | undefined;
    notification_id?: string | null | undefined;
    channel?: "email" | "in_app" | "sms" | null | undefined;
    provider_message_id?: string | null | undefined;
}, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    product_id: string;
    sent_at: NativeDate;
    error?: string | null | undefined;
    status?: "failed" | "sent" | "delivered" | "bounced" | null | undefined;
    user_id?: string | null | undefined;
    provider?: string | null | undefined;
    notification_id?: string | null | undefined;
    channel?: "email" | "in_app" | "sms" | null | undefined;
    provider_message_id?: string | null | undefined;
}>, {}, mongoose.DefaultSchemaOptions> & mongoose.FlatRecord<{
    product_id: string;
    sent_at: NativeDate;
    error?: string | null | undefined;
    status?: "failed" | "sent" | "delivered" | "bounced" | null | undefined;
    user_id?: string | null | undefined;
    provider?: string | null | undefined;
    notification_id?: string | null | undefined;
    channel?: "email" | "in_app" | "sms" | null | undefined;
    provider_message_id?: string | null | undefined;
}> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=notification-log.model.d.ts.map