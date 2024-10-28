import { Server } from "socket.io";
import {
  socketAuth,
  handleSocketError,
  logSocketEvent,
} from "../utils/auth.utils.js";
import roomHandlers from "./handlers/room.handlers.js";
import gameHandlers from "./handlers/game.handlers.js";
import chatHandlers from "./handlers/chat.handlers.js";

export function initializeSocketHandlers(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Middleware for authentication
  io.use(socketAuth);

  // Connection handler
  io.on("connection", (socket) => {
    const userId = socket.user.id;
    console.log(`User connected: ${userId}`);

    // Initialize handlers
    try {
      roomHandlers(io, socket);
      gameHandlers(io, socket);
      chatHandlers(io, socket);
    } catch (error) {
      handleSocketError(socket, error);
    }

    // Track active games/rooms for the user
    let activeRooms = new Set();

    // Custom middleware for logging events in development
    if (process.env.NODE_ENV !== "production") {
      socket.onAny((eventName, data) => {
        logSocketEvent(eventName, data, userId);
      });
    }

    // Room management
    socket.on("room:join", ({ roomCode }) => {
      try {
        activeRooms.add(roomCode);
        socket.join(roomCode);

        // Notify room about new user
        io.to(roomCode).emit("user:joined", {
          userId: socket.user.id,
          username: socket.user.username,
        });
      } catch (error) {
        handleSocketError(socket, error);
      }
    });

    socket.on("room:leave", ({ roomCode }) => {
      try {
        activeRooms.delete(roomCode);
        socket.leave(roomCode);

        // Notify room about user leaving
        io.to(roomCode).emit("user:left", {
          userId: socket.user.id,
          username: socket.user.username,
        });
      } catch (error) {
        handleSocketError(socket, error);
      }
    });

    // Disconnect handler
    socket.on("disconnect", async () => {
      try {
        console.log(`User disconnected: ${userId}`);

        // Handle disconnection for all active rooms
        for (const roomCode of activeRooms) {
          // Notify room about disconnection
          io.to(roomCode).emit("user:disconnected", {
            userId: socket.user.id,
            username: socket.user.username,
          });

          // Update room state (handle in roomHandlers)
          socket.emit("room:leave", { roomCode });
        }

        activeRooms.clear();
      } catch (error) {
        console.error("Disconnect error:", error);
      }
    });

    // Error handler
    socket.on("error", (error) => {
      handleSocketError(socket, error);
    });
  });

  // Custom namespace for game state updates
  const gameNamespace = io.of("/game");

  gameNamespace.use(socketAuth);

  gameNamespace.on("connection", (socket) => {
    // Game-specific event handlers
    socket.on("game:stateUpdate", (data) => {
      try {
        const { roomCode, gameState } = data;
        // Broadcast game state update to all players in the room
        gameNamespace.to(roomCode).emit("game:stateUpdated", gameState);
      } catch (error) {
        handleSocketError(socket, error);
      }
    });
  });

  // Heartbeat to keep connections alive
  setInterval(() => {
    io.emit("ping");
  }, 25000);

  // Handle server shutdown gracefully
  process.on("SIGTERM", () => {
    console.log("SIGTERM received. Closing all socket connections...");
    io.close(() => {
      console.log("Socket.IO server closed");
      process.exit(0);
    });
  });

  return io;
}

// Helper to emit to specific user across all namespaces
export const emitToUser = (io, userId, event, data) => {
  io.to(userId).emit(event, data);
  io.of("/game").to(userId).emit(event, data);
};

// Helper to broadcast to a room across all namespaces
export const broadcastToRoom = (io, roomCode, event, data) => {
  io.to(roomCode).emit(event, data);
  io.of("/game").to(roomCode).emit(event, data);
};

// Helper to get all users in a room
export const getRoomUsers = async (io, roomCode) => {
  const mainSockets = await io.in(roomCode).fetchSockets();
  const gameSockets = await io.of("/game").in(roomCode).fetchSockets();

  const users = new Set();

  [...mainSockets, ...gameSockets].forEach((socket) => {
    if (socket.user) {
      users.add(socket.user.id);
    }
  });

  return Array.from(users);
};

// Helper to check if user is connected
export const isUserConnected = async (io, userId) => {
  const mainSockets = await io.in(userId).fetchSockets();
  const gameSockets = await io.of("/game").in(userId).fetchSockets();

  return mainSockets.length > 0 || gameSockets.length > 0;
};

// Helper to get socket by user ID
export const getSocketByUserId = async (io, userId) => {
  const mainSockets = await io.in(userId).fetchSockets();
  if (mainSockets.length > 0) return mainSockets[0];

  const gameSockets = await io.of("/game").in(userId).fetchSockets();
  if (gameSockets.length > 0) return gameSockets[0];

  return null;
};

// Update game state for all connected clients in a room
export const updateGameState = (io, roomCode, gameState) => {
  broadcastToRoom(io, roomCode, "game:stateUpdated", gameState);
};

// Notify specific user
export const notifyUser = (io, userId, message, type = "info") => {
  emitToUser(io, userId, "notification", { message, type });
};

// Broadcast system message to room
export const broadcastSystemMessage = (io, roomCode, message) => {
  broadcastToRoom(io, roomCode, "chat:system", {
    id: Date.now(),
    content: message,
    timestamp: new Date().toISOString(),
    type: "system",
  });
};
