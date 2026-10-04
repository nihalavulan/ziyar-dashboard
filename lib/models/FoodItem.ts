import mongoose, { Schema, InferSchemaType } from "mongoose";

/** A predefined food item (Mutton, Beef, …). Rate is the default cost/unit. */
const FoodItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    rate: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type FoodItemDoc = InferSchemaType<typeof FoodItemSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const FoodItem =
  mongoose.models.FoodItem || mongoose.model("FoodItem", FoodItemSchema);

export default FoodItem;
