import mongoose, { Schema, InferSchemaType } from "mongoose";

/**
 * Hidden /wn dashboard: one food-cost sheet per day.
 * Each section is one dish (key = WnFoodItem id, label = its name that day)
 * and holds its ingredient rows;
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
    label: { type: String, default: "" },
    rows: { type: [IngredientSchema], default: [] },
    // Set when this dish was carried forward from an earlier day (that day's date).
    // Empty = entered by hand on this day (rows [] = deliberately nothing).
    copiedFrom: { type: String, default: "" },
  },
  { _id: false }
);

const WnFoodCostSchema = new Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD
    sections: { type: [SectionSchema], default: [] },
    // true = the whole day was created automatically (never saved by hand).
    auto: { type: Boolean, default: false },
    copiedFrom: { type: String, default: "" }, // the day it was copied from
  },
  { timestamps: true }
);

export type WnFoodCostDoc = InferSchemaType<typeof WnFoodCostSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WnFoodCost =
  mongoose.models.WnFoodCost || mongoose.model("WnFoodCost", WnFoodCostSchema);

export default WnFoodCost;
