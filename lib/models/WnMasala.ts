import mongoose, { Schema, InferSchemaType } from "mongoose";

/**
 * Hidden /wn dashboard: a masala made in batches from a recipe
 * (e.g. Alfaham masala). Cost per unit = recipe cost ÷ amount the batch makes.
 */
const MasalaRowSchema = new Schema(
  {
    name: { type: String, default: "" },
    qty: { type: Number, default: 0 },
    unit: { type: String, default: "kg" },
    rate: { type: Number, default: 0 }, // cost of 1 unit
  },
  { _id: false }
);

const WnMasalaSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    rows: { type: [MasalaRowSchema], default: [] },
    yieldQty: { type: Number, default: 0 }, // how much one batch makes
    yieldUnit: { type: String, default: "kg" }, // "kg" or "L"
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type WnMasalaDoc = InferSchemaType<typeof WnMasalaSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WnMasala =
  mongoose.models.WnMasala || mongoose.model("WnMasala", WnMasalaSchema);

export default WnMasala;
