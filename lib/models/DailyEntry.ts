import mongoose, { Schema, InferSchemaType } from "mongoose";

/**
 * One document per supplier per day. We store ONLY the day's transaction
 * amounts (purchase + paid). Opening balance and total are derived from the
 * full history, so editing any past day flows forward automatically.
 */
const DailyEntrySchema = new Schema(
  {
    supplier: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    // Stored as 'YYYY-MM-DD' (lexicographically sortable).
    date: { type: String, required: true },
    purchase: { type: Number, default: 0 },
    paid: { type: Number, default: 0 },
  },
  { timestamps: true }
);

DailyEntrySchema.index({ supplier: 1, date: 1 }, { unique: true });

export type DailyEntryDoc = InferSchemaType<typeof DailyEntrySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const DailyEntry =
  mongoose.models.DailyEntry || mongoose.model("DailyEntry", DailyEntrySchema);

export default DailyEntry;
