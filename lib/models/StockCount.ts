import mongoose, { Schema, InferSchemaType } from "mongoose";

/**
 * A stock item's figures for one day.
 *   received = quantity that came in that day
 *   count    = physical count at close (null = not counted that day)
 *   used     = last count + received since − count   (derived, see lib/stock.ts)
 */
const StockCountSchema = new Schema(
  {
    stockItem: { type: Schema.Types.ObjectId, ref: "StockItem", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    received: { type: Number, default: 0 },
    count: { type: Number, default: null },
    rate: { type: Number, default: 0 }, // cost per unit (snapshot that day)
  },
  { timestamps: true }
);

StockCountSchema.index({ stockItem: 1, date: 1 }, { unique: true });
StockCountSchema.index({ date: 1 });

export type StockCountDoc = InferSchemaType<typeof StockCountSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const StockCount =
  mongoose.models.StockCount || mongoose.model("StockCount", StockCountSchema);

export default StockCount;
