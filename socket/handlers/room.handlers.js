import Room from "../../models/Room.js";
import { verifyToken } from "../../utils/auth.utils.js";

export default function roomHandlers(io, socket) {
  const joinRoom = async (data) => {
    try {
      const { roomCode } = data;
      const user = await verifyToken(socket.handshake.auth.token);

      const room = await Room.findOne({ code: roomCode });
      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      if (room.status !== "WAITING") {
        socket.emit("error", { message: "Game already in progress" });
        return;
      }

      if (room.players.length >= room.settings.maxPlayers) {
        socket.emit("error", { message: "Room is full" });
        return;
      }

      // Add player to room if not already in
      if (!room.players.find((p) => p.user.toString() === user.id)) {
        room.players.push({ user: user.id, isReady: false });
        await room.save();
      }

      socket.join(roomCode);
      await room.populate("players.user", "username");

      io.to(roomCode).emit("room:updated", {
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
      console.error("Join room error:", error);
      socket.emit("error", { message: "Failed to join room" });
    }
  };

  const leaveRoom = async (data) => {
    try {
      const { roomCode } = data;
      const user = await verifyToken(socket.handshake.auth.token);

      const room = await Room.findOne({ code: roomCode });
      if (!room) return;

      // Remove player from room
      room.players = room.players.filter((p) => p.user.toString() !== user.id);

      // If room is empty, delete it
      if (room.players.length === 0) {
        await Room.deleteOne({ _id: room._id });
        io.to(roomCode).emit("room:deleted");
        return;
      }

      // If host left, assign new host
      if (room.host.toString() === user.id) {
        room.host = room.players[0].user;
      }

      await room.save();
      await room.populate("players.user", "username");

      socket.leave(roomCode);
      io.to(roomCode).emit("room:updated", {
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
      console.error("Leave room error:", error);
      socket.emit("error", { message: "Failed to leave room" });
    }
  };

  const toggleReady = async (data) => {
    try {
      const { roomCode } = data;
      const user = await verifyToken(socket.handshake.auth.token);

      const room = await Room.findOne({ code: roomCode });
      if (!room) return;

      const player = room.players.find((p) => p.user.toString() === user.id);
      if (player) {
        player.isReady = !player.isReady;
        await room.save();
        await room.populate("players.user", "username");

        io.to(roomCode).emit("room:updated", {
          room: {
            id: room._id,
            code: room.code,
            host: room.host,
            settings: room.settings,
            players: room.players,
            status: room.status,
          },
        });
      }
    } catch (error) {
      console.error("Toggle ready error:", error);
      socket.emit("error", { message: "Failed to toggle ready status" });
    }
  };

  // Register handlers
  socket.on("room:join", joinRoom);
  socket.on("room:leave", leaveRoom);
  socket.on("room:toggleReady", toggleReady);
}
