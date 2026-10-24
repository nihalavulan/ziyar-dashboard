import mongoose, { Schema, InferSchemaType } from "mongoose";

/**
 * Hidden /wn dashboard: one food-cost sheet per day.
 * Each section (Mandhi Rice, Madhooth, Alfahm, …) holds its ingredient rows;
 * a row's cost is qty × rate (derived, not stored).
 */
const IngredientSchema = new Schema(
  {
    name: { type: String, default: "" },
    qty: { type: Number, default: 0 },
    unit: { type: String, default: "kg" },
    rate: { type: Number, default: 0 }, // cost of 1 unit
  },
  { _id: false }
);

const SectionSchema = new Schema(
  {
    key: { type: String, required: true },
    rows: { type: [IngredientSchema], default: [] },
  },
  { _id: false }
);

const WnFoodCostSchema = new Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD
    sections: { type: [SectionSchema], default: [] },
  },
  { timestamps: true }
);

export type WnFoodCostDoc = InferSchemaType<typeof WnFoodCostSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WnFoodCost =
  mongoose.models.WnFoodCost || mongoose.model("WnFoodCost", WnFoodCostSchema);

export default WnFoodCost;
