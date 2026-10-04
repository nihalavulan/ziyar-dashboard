import mongoose, { Schema, InferSchemaType } from "mongoose";

/**
 * A food item's figures for one day.
 *   balance = prepared - sold - damage   (derived)
 *   total   = sold * rate                (food cost of that item, derived)
 */
const FoodEntrySchema = new Schema(
  {
    foodItem: { type: Schema.Types.ObjectId, ref: "FoodItem", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    name: { type: String, default: "" },
    prepared: { type: Number, default: 0 },
    sold: { type: Number, default: 0 },
    damage: { type: Number, default: 0 },
    rate: { type: Number, default: 0 }, // cost per unit (snapshot that day)
  },
  { timestamps: true }
);

FoodEntrySchema.index({ foodItem: 1, date: 1 }, { unique: true });
FoodEntrySchema.index({ date: 1 });

export type FoodEntryDoc = InferSchemaType<typeof FoodEntrySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const FoodEntry =
  mongoose.models.FoodEntry || mongoose.model("FoodEntry", FoodEntrySchema);

export default FoodEntry;
