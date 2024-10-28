import { verifyToken } from "../../utils/auth.utils.js";

export default function chatHandlers(io, socket) {
  const sendMessage = async (data) => {
    try {
      const { roomCode, content } = data;
      const user = await verifyToken(socket.handshake.auth.token);

      io.to(roomCode).emit("chat:message", {
        id: Date.now(),
        sender: {
          id: user.id,
          username: user.username,
        },
        content,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Send message error:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  };

  // Register handlers
  socket.on("chat:message", sendMessage);
}
