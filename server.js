import express from "express";
import { createServer } from "http";
import { initializeSocketHandlers } from "./socket/index.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

// Routes
import authRoutes from "./routes/auth.routes.js";
import gameRoutes from "./routes/game.routes.js";

// Error handler
import { errorHandler } from "./middleware/error.middleware.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = initializeSocketHandlers(httpServer);

// Security Middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later",
});

app.use("/api/", limiter);

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Database Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Health Check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/game", gameRoutes);

// Handle production
if (process.env.NODE_ENV === "production") {
  // Serve static files
  app.use(express.static(path.join(__dirname, "../client/dist")));

  // Handle SPA routing
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.json({ message: "API is running..." });
  });
}

// Error Handling Middleware
app.use((req, res, next) => {
  const error = new Error("Not Found");
  error.status = 404;
  next(error);
});

app.use(errorHandler);

// Graceful Shutdown
const gracefulShutdown = () => {
  console.log("Received shutdown signal...");

  // Close HTTP server
  httpServer.close(() => {
    console.log("HTTP server closed");

    // Close database connection
    mongoose.connection.close(false, () => {
      console.log("MongoDB connection closed");
      process.exit(0);
    });
  });

  // Force close if graceful shutdown fails
  setTimeout(() => {
    console.error(
      "Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  gracefulShutdown();
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
  gracefulShutdown();
});

// Start Server
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`
    🚀 Server is running in ${process.env.NODE_ENV} mode on port ${PORT}
    👋 Health check available at http://localhost:${PORT}/health
    📝 API Documentation at http://localhost:${PORT}/api-docs
    ${
      process.env.NODE_ENV === "development"
        ? `🔧 GraphQL Playground at http://localhost:${PORT}/graphql`
        : ""
    }
  `);
});

// Export for testing
export default app;
