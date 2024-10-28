import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const verifyToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  } catch (error) {
    throw new Error("Invalid token");
  }
};

export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// Socket.io authentication middleware
export const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const user = await verifyToken(token);
    socket.user = user;

    // Join user's personal room for private messages
    socket.join(user.id.toString());

    next();
  } catch (error) {
    next(new Error("Authentication failed"));
  }
};

// Role-based game action validation
export const validateGameAction = (player, action, gameState) => {
  const { role, isAlive } = player;
  const { phase } = gameState;

  if (!isAlive) {
    throw new Error("Dead players cannot perform actions");
  }

  switch (action) {
    case "KILL":
      if (role !== "MAFIA" || phase !== "NIGHT_ACTION") {
        throw new Error("Invalid action for role or phase");
      }
      break;

    case "INVESTIGATE":
      if (role !== "DETECTIVE" || phase !== "NIGHT_ACTION") {
        throw new Error("Invalid action for role or phase");
      }
      break;

    case "PROTECT":
      if (role !== "DOCTOR" || phase !== "NIGHT_ACTION") {
        throw new Error("Invalid action for role or phase");
      }
      break;

    case "VOTE":
      if (phase !== "DAY_VOTING") {
        throw new Error("Voting is only allowed during the day voting phase");
      }
      break;

    default:
      throw new Error("Unknown action type");
  }

  return true;
};

// User permission validation
export const validateUserPermissions = (user, action, targetUser = null) => {
  switch (action) {
    case "START_GAME":
      if (!user.isHost) {
        throw new Error("Only the host can start the game");
      }
      break;

    case "KICK_PLAYER":
      if (!user.isHost) {
        throw new Error("Only the host can kick players");
      }
      if (targetUser.isHost) {
        throw new Error("Cannot kick the host");
      }
      break;

    case "CHANGE_SETTINGS":
      if (!user.isHost) {
        throw new Error("Only the host can change game settings");
      }
      break;

    default:
      throw new Error("Unknown permission action");
  }

  return true;
};

// Rate limiting helper
const rateLimits = new Map();

export const checkRateLimit = (userId, action, limit = 5, window = 60000) => {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const userRates = rateLimits.get(key) || [];

  // Remove old timestamps
  const validRates = userRates.filter((timestamp) => now - timestamp < window);

  if (validRates.length >= limit) {
    throw new Error("Rate limit exceeded");
  }

  validRates.push(now);
  rateLimits.set(key, validRates);

  // Clean up old entries
  setTimeout(() => {
    const rates = rateLimits.get(key) || [];
    rateLimits.set(
      key,
      rates.filter((timestamp) => now - timestamp < window)
    );
  }, window);

  return true;
};

// Error handler for socket events
export const handleSocketError = (socket, error) => {
  console.error("Socket error:", error);

  const errorMessage =
    process.env.NODE_ENV === "production" ? "An error occurred" : error.message;

  socket.emit("error", {
    message: errorMessage,
    code: error.code || "UNKNOWN_ERROR",
  });
};

// Socket event logger for debugging
export const logSocketEvent = (eventName, data, userId) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(`Socket Event: ${eventName}`);
    console.log("User:", userId);
    console.log("Data:", JSON.stringify(data, null, 2));
    console.log("Timestamp:", new Date().toISOString());
    console.log("-------------------");
  }
};

// Validate game state transitions
export const validateGameStateTransition = (currentState, nextState, game) => {
  const validTransitions = {
    WAITING: ["STARTING"],
    STARTING: ["DAY_DISCUSSION", "NIGHT_ACTION"],
    DAY_DISCUSSION: ["DAY_VOTING"],
    DAY_VOTING: ["NIGHT_ACTION", "GAME_END"],
    NIGHT_ACTION: ["DAY_DISCUSSION", "GAME_END"],
    GAME_END: ["WAITING"],
  };

  if (!validTransitions[currentState]?.includes(nextState)) {
    throw new Error(
      `Invalid game state transition from ${currentState} to ${nextState}`
    );
  }

  // Additional validation based on game state
  switch (nextState) {
    case "STARTING":
      if (game.players.length < game.settings.minPlayers) {
        throw new Error("Not enough players to start the game");
      }
      if (!game.players.every((p) => p.isReady)) {
        throw new Error("All players must be ready to start the game");
      }
      break;

    case "GAME_END":
      if (!checkWinCondition(game)) {
        throw new Error("Game cannot end without a winner");
      }
      break;
  }

  return true;
};
