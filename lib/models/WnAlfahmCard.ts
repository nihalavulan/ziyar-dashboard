import mongoose, { Schema } from "mongoose";

/**
 * Hidden /wn dashboard: the alfahm "rate card" — settings and marinade recipes
 * (see lib/alfahm.ts). One document, key "main".
 */
const WnAlfahmCardSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "main" },
    settings: { type: Schema.Types.Mixed, default: {} },
    recipes: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true, minimize: false }
);

export const WnAlfahmCard =
  mongoose.models.WnAlfahmCard || mongoose.model("WnAlfahmCard", WnAlfahmCardSchema);

export default WnAlfahmCard;
