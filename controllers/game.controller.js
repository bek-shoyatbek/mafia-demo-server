import Room from "../models/Room.js";
import { generateRoomCode } from "../utils/game.utils.js";

export const createRoom = async (req, res) => {
  try {
    const { settings } = req.body;
    const roomCode = await generateRoomCode();

    const room = await Room.create({
      code: roomCode,
      host: req.user._id,
      settings,
      players: [{ user: req.user._id, isReady: false }],
    });

    await room.populate("players.user", "username");

    res.status(201).json({
      room: {
        id: room._id,
        code: room.code,
        host: req.user._id,
        settings: room.settings,
        players: room.players,
      },
    });
  } catch (error) {
    console.error("Create room error:", error);
    res.status(500).json({ message: "Failed to create room" });
  }
};

export const getRooms = async (req, res) => {
  try {
    const rooms = await Room.find({ status: "WAITING" })
      .populate("host", "username")
      .populate("players.user", "username");

    res.json({
      rooms: rooms.map((room) => ({
        id: room._id,
        code: room.code,
        host: room.host,
        settings: room.settings,
        players: room.players,
        status: room.status,
      })),
    });
  } catch (error) {
    console.error("Get rooms error:", error);
    res.status(500).json({ message: "Failed to get rooms" });
  }
};

export const getRoom = async (req, res) => {
  try {
    const room = await Room.findOne({ code: req.params.code })
      .populate("host", "username")
      .populate("players.user", "username");

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    res.json({
      room: {
        id: room._id,
        code: room.code,
        host: room.host,
        settings: room.settings,
        players: room.players,
        status: room.status,
      },
    });
  } catch (error) {
    console.error("Get room error:", error);
    res.status(500).json({ message: "Failed to get room" });
  }
};
