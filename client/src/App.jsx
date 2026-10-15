import { Routes, Route } from "react-router-dom";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import About from "./pages/About";
import GetStarted from "./pages/GetStarted";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

import Passenger from "./pages/PassengerDashboard";
import Driver from "./pages/DriverDashboard";
import Admin from "./pages/AdminDashboard";

import DriverProfile from "./pages/DriverProfile";
import DriverSettings from "./pages/DriverSettings";
import DriverVerification from "./pages/DriverVerification";


export default function App() {
  return (
    <Layout>
      <Routes>

        {/* Public pages */}
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/get-started" element={<GetStarted />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route
          path="/reset-password/:token"
          element={<ResetPassword />}
        />

        {/* Passenger */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute roles={["passenger"]}>
              <Passenger />
            </ProtectedRoute>
          }
        />

        {/* Driver dashboard */}
        <Route
          path="/driver"
          element={
            <ProtectedRoute roles={["driver"]}>
              <Driver />
            </ProtectedRoute>
          }
        />

        {/* Driver profile */}
        <Route
          path="/driver/profile"
          element={
            <ProtectedRoute roles={["driver"]}>
              <DriverProfile />
            </ProtectedRoute>
          }
        />

        {/* Driver settings */}
        <Route
          path="/driver/settings"
          element={
            <ProtectedRoute roles={["driver"]}>
              <DriverSettings />
            </ProtectedRoute>
          }
        />

        {/* Driver verification */}
        <Route
          path="/driver/verification"
          element={
            <ProtectedRoute roles={["driver"]}>
              <DriverVerification />
            </ProtectedRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Admin />
            </ProtectedRoute>
          }
        />

      </Routes>
    </Layout>
  );
}