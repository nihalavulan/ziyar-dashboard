import mongoose, { Schema, InferSchemaType } from "mongoose";

/**
 * A kitchen person (Mandi master, Alfahm master, helper…) with their own private
 * daily-usage page at /k/<token>. The token in the link is their key: no password.
 */
const WorkerItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    unit: { type: String, default: "kg", trim: true },
    stockItemId: { type: String, default: "" }, // set when picked from Stock
  },
  { _id: false }
);

const KitchenWorkerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, default: "", trim: true },
    token: { type: String, required: true, unique: true, index: true },
    items: { type: [WorkerItemSchema], default: [] },
    order: { type: Number, default: 0 },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type KitchenWorkerDoc = InferSchemaType<typeof KitchenWorkerSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const KitchenWorker =
  mongoose.models.KitchenWorker || mongoose.model("KitchenWorker", KitchenWorkerSchema);

export default KitchenWorker;
