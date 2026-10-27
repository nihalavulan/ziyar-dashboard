import mongoose, { Schema, InferSchemaType } from "mongoose";

/** What one kitchen person used on one day (one doc per person per day). */
const LogRowSchema = new Schema(
  {
    name: { type: String, required: true },
    qty: { type: Number, default: 0 },
    unit: { type: String, default: "kg" },
  },
  { _id: false }
);

const KitchenLogSchema = new Schema(
  {
    workerId: { type: String, required: true, index: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    rows: { type: [LogRowSchema], default: [] },
  },
  { timestamps: true }
);

KitchenLogSchema.index({ workerId: 1, date: 1 }, { unique: true });

export type KitchenLogDoc = InferSchemaType<typeof KitchenLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const KitchenLog =
  mongoose.models.KitchenLog || mongoose.model("KitchenLog", KitchenLogSchema);

export default KitchenLog;
