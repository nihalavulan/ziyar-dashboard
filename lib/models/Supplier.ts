import mongoose, { Schema, InferSchemaType } from "mongoose";

const SupplierSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // Balance owed before any daily entries exist (starting point of the ledger).
    openingBalance: { type: Number, default: 0 },
    // Display order (keeps the list in the same order it was entered).
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type SupplierDoc = InferSchemaType<typeof SupplierSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Supplier =
  mongoose.models.Supplier || mongoose.model("Supplier", SupplierSchema);

export default Supplier;
