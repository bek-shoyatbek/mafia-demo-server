import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    settings: {
      maxPlayers: {
        type: Number,
        required: true,
        min: 5,
        max: 15,
      },
      roles: {
        MAFIA: { type: Number, required: true },
        DETECTIVE: { type: Number, required: true },
        DOCTOR: { type: Number, required: true },
        VILLAGER: { type: Number, required: true },
      },
      dayDuration: {
        type: Number,
        required: true,
        default: 120,
      },
      nightDuration: {
        type: Number,
        required: true,
        default: 30,
      },
    },
    players: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        isReady: {
          type: Boolean,
          default: false,
        },
        role: {
          type: String,
          enum: ["MAFIA", "DETECTIVE", "DOCTOR", "VILLAGER"],
        },
      },
    ],
    status: {
      type: String,
      enum: ["WAITING", "STARTING", "IN_PROGRESS", "FINISHED"],
      default: "WAITING",
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 3600, // Room documents will be automatically deleted after 1 hour
    },
  },
  {
    timestamps: true,
  }
);

const Room = mongoose.model("Room", roomSchema);
export default Room;
