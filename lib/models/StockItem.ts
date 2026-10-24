import mongoose, { Schema, InferSchemaType } from "mongoose";

/** A stocked item (Rice, Onion, Oil, …) with its category, unit and current cost/unit. */
const StockItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, default: "Other", trim: true },
    unit: { type: String, default: "kg", trim: true },
    rate: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type StockItemDoc = InferSchemaType<typeof StockItemSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const StockItem =
  mongoose.models.StockItem || mongoose.model("StockItem", StockItemSchema);

export default StockItem;
