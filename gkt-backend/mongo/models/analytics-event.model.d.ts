import mongoose from 'mongoose';
export declare const AnalyticsEvent: mongoose.Model<{
    created_at: NativeDate;
    product_id: string;
    event_type: string;
    metadata: any;
    tenant_id?: string | null | undefined;
    user_type?: string | null | undefined;
    date?: NativeDate | null | undefined;
    ticket_id?: string | null | undefined;
    actor_id?: string | null | undefined;
}, {}, {}, {}, mongoose.Document<unknown, {}, {
    created_at: NativeDate;
    product_id: string;
    event_type: string;
    metadata: any;
    tenant_id?: string | null | undefined;
    user_type?: string | null | undefined;
    date?: NativeDate | null | undefined;
    ticket_id?: string | null | undefined;
    actor_id?: string | null | undefined;
}, {}, mongoose.DefaultSchemaOptions> & {
    created_at: NativeDate;
    product_id: string;
    event_type: string;
    metadata: any;
    tenant_id?: string | null | undefined;
    user_type?: string | null | undefined;
    date?: NativeDate | null | undefined;
    ticket_id?: string | null | undefined;
    actor_id?: string | null | undefined;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, {
    created_at: NativeDate;
    product_id: string;
    event_type: string;
    metadata: any;
    tenant_id?: string | null | undefined;
    user_type?: string | null | undefined;
    date?: NativeDate | null | undefined;
    ticket_id?: string | null | undefined;
    actor_id?: string | null | undefined;
}, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    created_at: NativeDate;
    product_id: string;
    event_type: string;
    metadata: any;
    tenant_id?: string | null | undefined;
    user_type?: string | null | undefined;
    date?: NativeDate | null | undefined;
    ticket_id?: string | null | undefined;
    actor_id?: string | null | undefined;
}>, {}, mongoose.DefaultSchemaOptions> & mongoose.FlatRecord<{
    created_at: NativeDate;
    product_id: string;
    event_type: string;
    metadata: any;
    tenant_id?: string | null | undefined;
    user_type?: string | null | undefined;
    date?: NativeDate | null | undefined;
    ticket_id?: string | null | undefined;
    actor_id?: string | null | undefined;
}> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=analytics-event.model.d.ts.map