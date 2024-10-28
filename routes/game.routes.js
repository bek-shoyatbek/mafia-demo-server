import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  createRoom,
  getRooms,
  getRoom,
} from "../controllers/game.controller.js";

const router = express.Router();

router.post("/rooms", protect, createRoom);
router.get("/rooms", protect, getRooms);
router.get("/rooms/:code", protect, getRoom);

export default router;
