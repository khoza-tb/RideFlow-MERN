
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

// Supports one or more comma-separated frontend URLs.
const allowedOrigins = [
  "http://localhost:5173",
  ...(process.env.CLIENT_URL || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean),
];

// Render runs behind a reverse proxy.
app.set("trust proxy", 1);

// ===============================
// CORS CONFIGURATION
// ===============================

const corsOptions = {
  origin(origin, callback) {
    // Requests such as direct health checks may not send Origin.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn("CORS blocked origin:", origin);

    return callback(
      new Error(`CORS blocked origin: ${origin}`)
    );
  },

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

// ===============================
// SOCKET.IO
// ===============================

const io = new Server(server, {
  cors: corsOptions,
});

app.set("io", io);

// ===============================
// SOCKET CONNECTION
// ===============================

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // USER ROOM
  socket.on("join:user", (userId) => {
    if (!userId) return;

    socket.join(`user:${userId}`);

    console.log(`User ${userId} joined user:${userId}`);
  });

  // ADMIN ROOM
  socket.on("join:admin", () => {
    socket.join("admins");

    console.log(`Admin joined admins room: ${socket.id}`);
  });

  // RIDE ROOM
  socket.on("join:ride", (rideId) => {
    if (!rideId) return;

    socket.join(`ride:${rideId}`);

    console.log(`Socket ${socket.id} joined ride:${rideId}`);
  });

  // DRIVER LIVE LOCATION
  socket.on("driver:location", (data) => {
    const {
      rideId,
      driverId,
      lat,
      lng,
    } = data || {};

    if (
      !rideId ||
      !driverId ||
      lat == null ||
      lng == null
    ) {
      return;
    }

    const latitude = Number(lat);
    const longitude = Number(lng);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return;
    }

    const locationData = {
      rideId,
      driverId,
      lat: latitude,
      lng: longitude,
    };

    // Notify passengers in this ride room.
    io.to(`ride:${rideId}`).emit(
      "driver:location",
      locationData
    );

    // Notify connected admin dashboards.
    io.to("admins").emit(
      "driver:location",
      locationData
    );
  });

  // DISCONNECT
  socket.on("disconnect", (reason) => {
    console.log(
      `Socket disconnected: ${socket.id} (${reason})`
    );
  });
});

// ===============================
// EXPRESS MIDDLEWARE
// ===============================

app.use(cors(corsOptions));

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

app.use(cookieParser());

// ===============================
// UPLOADS
// ===============================

const uploadsPath = path.resolve("uploads");

app.use("/uploads", express.static(uploadsPath));
app.use("/api/uploads", express.static(uploadsPath));

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
  console.error("SERVER ERROR:", err);

  if (err?.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: err.message || "File upload error",
      code: err.code,
    });
  }

  if (err?.message?.startsWith("CORS blocked origin:")) {
    return res.status(403).json({
      success: false,
      message: "Origin is not allowed by CORS",
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// ===============================
// MONGODB + SERVER
// ===============================

async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from .env");
    }

    console.log("Connecting to MongoDB...");

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully");

    server.listen(PORT, "0.0.0.0", () => {
      console.log("================================");
      console.log("          RIDEFLOW SERVER");
      console.log("================================");
      console.log(`Port: ${PORT}`);
      console.log(`Allowed clients: ${allowedOrigins.join(", ")}`);
      console.log(`Health: /api/health`);
      console.log("================================");
    });
  } catch (error) {
    console.error("Failed to start RideFlow:", error.message);
    process.exit(1);
  }
}

startServer();