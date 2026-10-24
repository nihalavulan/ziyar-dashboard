import mongoose, { Schema, InferSchemaType } from "mongoose";

/**
 * Hidden /wn dashboard: one SOP per team member — a written guide of their
 * daily tasks, responsibilities and KPIs (no day-by-day ticking yet).
 */
const TaskSchema = new Schema(
  {
    time: { type: String, default: "" }, // free text, e.g. "10:00 AM" or "Before opening"
    text: { type: String, default: "" },
  },
  { _id: false }
);

const WnSopSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, default: "", trim: true },
    tasks: { type: [TaskSchema], default: [] },
    responsibilities: { type: [String], default: [] },
    kpis: { type: [String], default: [] },
    notes: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type WnSopDoc = InferSchemaType<typeof WnSopSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WnSop = mongoose.models.WnSop || mongoose.model("WnSop", WnSopSchema);

export default WnSop;
