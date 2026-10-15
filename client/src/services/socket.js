import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const socket = io(SOCKET_URL, {
  autoConnect: true,
  withCredentials: true,
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  timeout: 10000,
});

socket.on("connect", () => {
  console.log("🟢 RideFlow socket connected:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("🔴 RideFlow socket disconnected:", reason);
});

socket.on("connect_error", (error) => {
  console.error(
    "❌ RideFlow socket connection error:",
    error.message
  );
});

export default socket;