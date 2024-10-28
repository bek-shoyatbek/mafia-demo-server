import mongoose from "mongoose";

const gameSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    players: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        role: {
          type: String,
          enum: ["MAFIA", "DETECTIVE", "DOCTOR", "VILLAGER"],
          required: true,
        },
        isAlive: {
          type: Boolean,
          default: true,
        },
      },
    ],
    phases: [
      {
        type: {
          type: String,
          enum: ["DAY_DISCUSSION", "DAY_VOTING", "NIGHT_ACTION"],
          required: true,
        },
        startTime: {
          type: Date,
          required: true,
        },
        endTime: {
          type: Date,
          required: true,
        },
        votes: [
          {
            voter: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
            },
            target: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
            },
          },
        ],
        actions: [
          {
            player: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
            },
            action: String,
            target: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
            },
          },
        ],
        eliminated: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    winner: {
      type: String,
      enum: ["MAFIA", "VILLAGE"],
    },
    startedAt: {
      type: Date,
      required: true,
    },
    endedAt: Date,
  },
  {
    timestamps: true,
  }
);

const Game = mongoose.model("Game", gameSchema);
export default Game;
