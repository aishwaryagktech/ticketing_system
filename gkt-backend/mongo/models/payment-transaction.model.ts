import mongoose, { Schema } from 'mongoose';

const PaymentTransactionSchema = new Schema({
  tenant_id:        { type: String, required: true },
  product_id:       { type: String, required: true },
  payment_id:       { type: String, required: true, unique: true },
  order_id:         { type: String, required: true },
  plan_id:          { type: String, required: true },
  plan_name:        { type: String, required: true },
  amount_inr:       { type: Number, required: true },
  currency:         { type: String, default: 'INR' },
  status:           { type: String, default: 'paid' },
  payment_provider: { type: String, default: 'razorpay' },
  period_start:     { type: Date },
  period_end:       { type: Date },
  paid_at:          { type: Date, default: Date.now },
});

PaymentTransactionSchema.index({ tenant_id: 1, paid_at: -1 });
PaymentTransactionSchema.index({ product_id: 1, paid_at: -1 });

export const PaymentTransaction = mongoose.model('PaymentTransaction', PaymentTransactionSchema);
