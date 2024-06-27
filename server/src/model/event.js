import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    tgId: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Event = mongoose.model("Event", eventSchema);

export default Event;
