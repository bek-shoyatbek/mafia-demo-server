import Room from "../../models/Room.js";
import Game from "../../models/Game.js";
import { verifyToken } from "../../utils/auth.utils.js";
import { assignRoles, checkWinCondition } from "../../utils/game.utils.js";

export default function gameHandlers(io, socket) {
  const startGame = async (data) => {
    try {
      const { roomCode } = data;
      const user = await verifyToken(socket.handshake.auth.token);

      const room = await Room.findOne({ code: roomCode });
      if (!room || room.host.toString() !== user.id) return;

      if (!room.players.every((p) => p.isReady)) {
        socket.emit("error", { message: "Not all players are ready" });
        return;
      }

      const roles = assignRoles(room.players.length, room.settings.roles);
      const game = await Game.create({
        room: room._id,
        players: room.players.map((p, index) => ({
          user: p.user,
          role: roles[index],
          isAlive: true,
        })),
        startedAt: new Date(),
      });

      room.status = "IN_PROGRESS";
      await room.save();

      // Send role assignments to each player privately
      game.players.forEach((player) => {
        io.to(player.user.toString()).emit("game:role", {
          role: player.role,
        });
      });

      io.to(roomCode).emit("game:started", {
        gameId: game._id,
        phase: "NIGHT_ACTION",
        timeLimit: room.settings.nightDuration,
      });
    } catch (error) {
      console.error("Start game error:", error);
      socket.emit("error", { message: "Failed to start game" });
    }
  };

  const performAction = async (data) => {
    try {
      const { gameId, action, targetId } = data;
      const user = await verifyToken(socket.handshake.auth.token);

      const game = await Game.findById(gameId);
      if (!game) return;

      const player = game.players.find((p) => p.user.toString() === user.id);
      if (!player || !player.isAlive) return;

      game.phases[game.phases.length - 1].actions.push({
        player: user.id,
        action,
        target: targetId,
      });

      await game.save();

      // Check if all actions are completed
      const alivePlayers = game.players.filter((p) => p.isAlive);
      const actionsNeeded = alivePlayers.filter((p) =>
        ["MAFIA", "DETECTIVE", "DOCTOR"].includes(p.role)
      ).length;

      if (
        game.phases[game.phases.length - 1].actions.length === actionsNeeded
      ) {
        // Process night actions and transition to day
        // This would be handled by a game state machine in production
        io.to(game.room.toString()).emit("game:phaseChanged", {
          phase: "DAY_DISCUSSION",
          timeLimit: 120,
        });
      }
    } catch (error) {
      console.error("Perform action error:", error);
      socket.emit("error", { message: "Failed to perform action" });
    }
  };

  const castVote = async (data) => {
    try {
      const { gameId, targetId } = data;
      const user = await verifyToken(socket.handshake.auth.token);

      const game = await Game.findById(gameId);
      if (!game) return;

      const player = game.players.find((p) => p.user.toString() === user.id);
      if (!player || !player.isAlive) return;

      const currentPhase = game.phases[game.phases.length - 1];
      currentPhase.votes = currentPhase.votes.filter(
        (v) => v.voter.toString() !== user.id
      );
      currentPhase.votes.push({ voter: user.id, target: targetId });

      await game.save();

      // Broadcast vote update
      io.to(game.room.toString()).emit("game:voteUpdate", {
        votes: currentPhase.votes,
      });

      // Check if all alive players have voted
      const alivePlayers = game.players.filter((p) => p.isAlive).length;
      if (currentPhase.votes.length === alivePlayers) {
        // Process votes and transition to next phase
        // This would be handled by a game state machine in production
        const winner = checkWinCondition(game);
        if (winner) {
          io.to(game.room.toString()).emit("game:ended", { winner });
        } else {
          io.to(game.room.toString()).emit("game:phaseChanged", {
            phase: "NIGHT_ACTION",
            timeLimit: 30,
          });
        }
      }
    } catch (error) {
      console.error("Cast vote error:", error);
      socket.emit("error", { message: "Failed to cast vote" });
    }
  };

  // Register handlers
  socket.on("game:start", startGame);
  socket.on("game:action", performAction);
  socket.on("game:vote", castVote);
}
