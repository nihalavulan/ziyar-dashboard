import mongoose, { Schema, InferSchemaType } from "mongoose";

const StaffSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    section: { type: String, default: "", trim: true },
    // Daily salary amount.
    salary: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type StaffDoc = InferSchemaType<typeof StaffSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Staff =
  mongoose.models.Staff || mongoose.model("Staff", StaffSchema);

export default Staff;
