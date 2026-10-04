import mongoose, { Schema, InferSchemaType } from "mongoose";

/**
 * Per-day P&L figures that are entered manually (everything else — food cost,
 * fixed expenses, salary — is derived from other sections).
 */
const DailyPnlSchema = new Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD
    totalSales: { type: Number, default: 0 },
    staffFood: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type DailyPnlDoc = InferSchemaType<typeof DailyPnlSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const DailyPnl =
  mongoose.models.DailyPnl || mongoose.model("DailyPnl", DailyPnlSchema);

export default DailyPnl;
