import mongoose, { Schema, InferSchemaType } from "mongoose";

/** Hidden /wn dashboard: a dish whose ingredient cost is tracked daily (e.g. Mandhi Rice). */
const WnFoodItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type WnFoodItemDoc = InferSchemaType<typeof WnFoodItemSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WnFoodItem =
  mongoose.models.WnFoodItem || mongoose.model("WnFoodItem", WnFoodItemSchema);

export default WnFoodItem;
