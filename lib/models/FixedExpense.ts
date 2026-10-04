import mongoose, { Schema, InferSchemaType } from "mongoose";

/**
 * A recurring fixed expense (rent, electricity, EMI, …).
 * Stored at its natural period; the per-day cost is derived
 * (month ÷ 30, year ÷ 360, day as-is).
 */
const FixedExpenseSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    amount: { type: Number, default: 0 },
    period: { type: String, enum: ["day", "month", "year"], default: "month" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type FixedExpenseDoc = InferSchemaType<typeof FixedExpenseSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const FixedExpense =
  mongoose.models.FixedExpense ||
  mongoose.model("FixedExpense", FixedExpenseSchema);

export default FixedExpense;
