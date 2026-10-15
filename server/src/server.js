import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import path from "path";

// ===============================
// ROUTES
// ===============================

import auth from "./routes/auth.js";
import rides from "./routes/rides.js";
import drivers from "./routes/drivers.js";
import admin from "./routes/admin.js";

// ===============================
// ENVIRONMENT
// ===============================

dotenv.config();

// ===============================
// EXPRESS + HTTP SERVER
// ===============================

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:5173";

// ===============================
// SOCKET.IO
// ===============================

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
  },
});

app.set("io", io);

// ===============================
// SOCKET CONNECTION
// ===============================

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // =============================
  // USER ROOM
  // =============================

  socket.on("join:user", (userId) => {
    if (!userId) return;

    socket.join(`user:${userId}`);

    console.log(
      `User ${userId} joined user:${userId}`
    );
  });

  // =============================
  // ADMIN ROOM
  // =============================

  socket.on("join:admin", () => {
    socket.join("admins");

    console.log(
      `Admin joined admins room: ${socket.id}`
    );
  });

  // =============================
  // RIDE ROOM
  // =============================

  socket.on("join:ride", (rideId) => {
    if (!rideId) return;

    socket.join(`ride:${rideId}`);

    console.log(
      `Socket ${socket.id} joined ride:${rideId}`
    );
  });

  // =============================
  // DRIVER LIVE LOCATION
  // =============================

  socket.on("driver:location", (data) => {
    const {
      rideId,
      driverId,
      lat,
      lng,
    } = data || {};

    // Validate location data
    if (
      !rideId ||
      !driverId ||
      lat == null ||
      lng == null
    ) {
      return;
    }

    const locationData = {
      rideId,
      driverId,
      lat: Number(lat),
      lng: Number(lng),
    };

    // Send location to passenger
    io.to(`ride:${rideId}`).emit(
      "driver:location",
      locationData
    );

    // Send location to admin fleet dashboard
    io.to("admins").emit(
      "driver:location",
      locationData
    );
  });

  // =============================
  // DISCONNECT
  // =============================

  socket.on("disconnect", (reason) => {
    console.log(
      `Socket disconnected: ${socket.id} (${reason})`
    );
  });
});

// ===============================
// CORS
// ===============================

const corsOptions = {
  origin: CLIENT_URL,
  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],
};

// IMPORTANT:
// Do NOT use app.options("*", ...)
// Newer Express/path-to-regexp versions
// reject the "*" route pattern.

app.use(cors(corsOptions));

// ===============================
// BODY PARSERS
// ===============================

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

// ===============================
// COOKIE PARSER
// ===============================

app.use(cookieParser());

// ===============================
// UPLOADS
// ===============================

const uploadsPath = path.resolve("uploads");

// Public uploads
app.use(
  "/uploads",
  express.static(uploadsPath)
);

// API uploads
app.use(
  "/api/uploads",
  express.static(uploadsPath)
);

// ===============================
// HEALTH CHECK
// ===============================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    success: true,
    message: "RideFlow API is running",
    timestamp: new Date().toISOString(),
  });
});

// ===============================
// API ROUTES
// ===============================

app.use("/api/auth", auth);

app.use("/api/rides", rides);

app.use("/api/drivers", drivers);

app.use("/api/admin", admin);

// ===============================
// 404 HANDLER
// ===============================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ===============================
// GLOBAL ERROR HANDLER
// ===============================

app.use((err, req, res, next) => {
  console.error("");
  console.error("================================");
  console.error("          SERVER ERROR");
  console.error("================================");
  console.error(err);
  console.error("================================");
  console.error("");

  // Multer error
  if (err?.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: err.message || "File upload error",
      code: err.code,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message:
      err.message || "Internal server error",
  });
});

// ===============================
// MONGODB + SERVER
// ===============================

async function startServer() {
  try {
    // =============================
    // CHECK MONGO URI
    // =============================

    if (!process.env.MONGO_URI) {
      throw new Error(
        "MONGO_URI is missing from .env"
      );
    }

    console.log("");
    console.log("Connecting to MongoDB...");

    // =============================
    // CONNECT MONGODB
    // =============================

    await mongoose.connect(
      process.env.MONGO_URI
    );

    console.log(
      "MongoDB connected successfully"
    );

    // =============================
    // START SERVER
    // =============================

    server.listen(PORT, () => {
      console.log("");
      console.log("================================");
      console.log("          RIDEFLOW SERVER");
      console.log("================================");
      console.log(
        `API:    http://localhost:${PORT}`
      );
      console.log(
        `Client: ${CLIENT_URL}`
      );
      console.log(
        `Health: http://localhost:${PORT}/api/health`
      );
      console.log(
        `Uploads: http://localhost:${PORT}/uploads`
      );
      console.log("================================");
      console.log("");
    });

  } catch (error) {
    console.error("");
    console.error(
      "MongoDB connection failed:"
    );
    console.error(
      error.message
    );
    console.error("");

    process.exit(1);
  }
}

// ===============================
// START RIDEFLOW
// ===============================

startServer();