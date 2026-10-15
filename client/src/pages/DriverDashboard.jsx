import {
  useEffect,
  useState
} from "react";

import {
  Power,
  Car,
  MapPin,
  RefreshCw,
  Navigation,
  Wallet,
  Star,
  FileCheck,
  AlertTriangle,
  LogOut,
  LayoutDashboard,
  DollarSign,
  User,
  Settings,
  Menu,
  X
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import api from "../services/api";
import socket from "../services/socket";
import { useAuth } from "../context/AuthContext";
import RideMap from "../components/RideMap";

export default function DriverDashboard() {
  const {
    user,
    logout
  } = useAuth();

  const navigate = useNavigate();

  const [d, setD] = useState(null);
  const [available, setAvailable] = useState([]);
  const [rides, setRides] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ===========================================================
  // LOAD DRIVER DATA
  // ===========================================================

  const load = async () => {
    try {
      setError("");

      const p = await api.get("/drivers/profile");

      setD(p.data.driver);

      const a = await api.get(
        "/rides/available/list"
      );

      setAvailable(a.data.rides || []);

      const m = await api.get(
        "/rides/mine"
      );

      setRides(m.data.rides || []);

      // Driver earnings
      try {
        const e = await api.get(
          "/drivers/earnings"
        );

        setEarnings(e.data);
      } catch (earningsError) {
        console.error(
          "EARNINGS ERROR:",
          earningsError
        );
      }

    } catch (e) {
      setError(
        e.response?.data?.message ||
          "Unable to load driver dashboard."
      );
    }
  };

  // ===========================================================
  // INITIAL LOAD
  // ===========================================================

  useEffect(() => {
    load();
  }, []);

  // ===========================================================
  // AUTO REFRESH
  // ===========================================================

  useEffect(() => {
    const timer = setInterval(
      load,
      7000
    );

    return () =>
      clearInterval(timer);
  }, []);

  // ===========================================================
  // DRIVER LOCATION TRACKING
  // ===========================================================

  useEffect(() => {
    if (!d?.online) return;

    let watch = null;

    if (navigator.geolocation) {
      watch =
        navigator.geolocation.watchPosition(
          async (pos) => {

            const active = rides.find((x) =>
              [
                "accepted",
                "arriving",
                "arrived",
                "in_progress"
              ].includes(x.status)
            );

            if (!active) return;

            try {
              await api.post(
                `/rides/${active._id}/location`,
                {
                  lat:
                    pos.coords.latitude,

                  lng:
                    pos.coords.longitude
                }
              );
            } catch {
              // Ignore location update errors
            }
          },
          (geoError) => {
            console.error(
              "GEOLOCATION ERROR:",
              geoError
            );
          }
        );
    }

    return () => {
      if (watch !== null) {
        navigator.geolocation.clearWatch(
          watch
        );
      }
    };
  }, [d?.online, rides]);

  // ===========================================================
  // DRIVER ONLINE / OFFLINE
  // ===========================================================

  const toggle = async () => {
    if (!d) return;

    try {
      setError("");

      const r = await api.patch(
        "/drivers/status",
        {
          online: !d.online
        }
      );

      setD(r.data.driver);

    } catch (e) {
      setError(
        e.response?.data?.message ||
          "Unable to change status."
      );
    }
  };

  // ===========================================================
  // ACCEPT RIDE
  // ===========================================================

  const accept = async (id) => {
    setBusy(true);
    setError("");

    try {
      await api.post(
        `/rides/${id}/accept`
      );

      await load();

    } catch (e) {
      setError(
        e.response?.data?.message ||
          "Ride already taken."
      );

    } finally {
      setBusy(false);
    }
  };

  // ===========================================================
  // UPDATE RIDE STATUS
  // ===========================================================

  const status = async (id, s) => {
    try {
      setError("");

      await api.patch(
        `/rides/${id}/status`,
        {
          status: s
        }
      );

      await load();

    } catch (e) {
      setError(
        e.response?.data?.message ||
          "Unable to update ride."
      );
    }
  };

  // ===========================================================
  // LOGOUT
  // ===========================================================

  const handleLogout = async () => {
    try {
      setBusy(true);
      setError("");

      await logout();

    } catch (e) {
      console.error(
        "LOGOUT ERROR:",
        e
      );

      setError(
        "Unable to sign out. Please try again."
      );

    } finally {
      setBusy(false);
    }
  };

  // ===========================================================
  // SCROLL TO SECTION
  // ===========================================================

  const goToSection = (id) => {
    setSidebarOpen(false);

    setTimeout(() => {
      const element =
        document.getElementById(id);

      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    }, 50);
  };

  // ===========================================================
  // CURRENT ACTIVE RIDE
  // ===========================================================

  const current = rides.find((x) =>
    [
      "accepted",
      "arriving",
      "arrived",
      "in_progress"
    ].includes(x.status)
  );

  // ===========================================================
  // LOADING
  // ===========================================================

  if (!d) {
    return (
      <div className="loader">
        Loading driver profile…
      </div>
    );
  }

  return (
    <div className="driverLayout">

      {/* ================================================= */}
      {/* SIDEBAR */}
      {/* ================================================= */}

      <aside
        className={`driverSidebar ${
          sidebarOpen
            ? "sidebarOpen"
            : ""
        }`}
      >

        {/* ================================================= */}
        {/* SIDEBAR HEADER */}
        {/* ================================================= */}

        <div className="sidebarHeader">

          <div className="rideFlowLogo">

            <div className="rideFlowLogoIcon">
              <Car size={21} />
            </div>

            <div>
              <strong>
                RideFlow
              </strong>

              <span>
                Driver
              </span>
            </div>

          </div>

          <button
            type="button"
            className="sidebarClose"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            <X size={20} />
          </button>

        </div>

        {/* ================================================= */}
        {/* DRIVER PROFILE */}
        {/* ================================================= */}

        <div className="sidebarDriver">

          <div className="driverAvatar">
            {user?.name
              ?.charAt(0)
              ?.toUpperCase() || "D"}
          </div>

          <div>

            <strong>
              {user?.name ||
                "Driver"}
            </strong>

            <span>
              Driver account
            </span>

          </div>

        </div>

        {/* ================================================= */}
        {/* NAVIGATION */}
        {/* ================================================= */}

        <nav className="driverNav">

          <div className="navLabel">
            MAIN MENU
          </div>

          {/* DASHBOARD */}

          <button
            type="button"
            className="driverNavItem active"
            onClick={() =>
              goToSection("dashboard")
            }
          >
            <LayoutDashboard size={19} />

            <span>
              Dashboard
            </span>
          </button>

          {/* RIDE REQUESTS */}

          <button
            type="button"
            className="driverNavItem"
            onClick={() =>
              goToSection("requests")
            }
          >
            <Car size={19} />

            <span>
              Ride Requests
            </span>

            {available.length > 0 && (
              <em>
                {available.length}
              </em>
            )}
          </button>

          {/* EARNINGS */}

          <button
            type="button"
            className="driverNavItem"
            onClick={() =>
              goToSection("earnings")
            }
          >
            <DollarSign size={19} />

            <span>
              Earnings
            </span>
          </button>

          {/* ACTIVE TRIP */}

          <button
            type="button"
            className="driverNavItem"
            onClick={() =>
              goToSection("active-trip")
            }
          >
            <Navigation size={19} />

            <span>
              Active Trip
            </span>
          </button>

          {/* ACCOUNT */}

          <div className="navLabel second">
            ACCOUNT
          </div>

          {/* MY PROFILE */}

          <button
            type="button"
            className="driverNavItem"
            onClick={() => {
              setSidebarOpen(false);
              navigate("/driver/profile");
            }}
          >
            <User size={19} />

            <span>
              My Profile
            </span>
          </button>

          {/* VERIFICATION */}

          <button
            type="button"
            className="driverNavItem"
            onClick={() => {
              setSidebarOpen(false);
              navigate("/driver/verification");
            }}
          >
            <FileCheck size={19} />

            <span>
              Verification
            </span>
          </button>

          {/* SETTINGS */}

          <button
            type="button"
            className="driverNavItem"
            onClick={() => {
              setSidebarOpen(false);
              navigate("/driver/settings");
            }}
          >
            <Settings size={19} />

            <span>
              Settings
            </span>
          </button>

        </nav>

        {/* ================================================= */}
        {/* SIDEBAR BOTTOM */}
        {/* ================================================= */}

        <div className="sidebarBottom">

          {/* ONLINE STATUS */}

          <div className="sidebarStatus">

            <span
              className={
                d.online
                  ? "statusDot online"
                  : "statusDot"
              }
            />

            <div>

              <strong>
                {d.online
                  ? "You're online"
                  : "You're offline"}
              </strong>

              <span>
                {d.online
                  ? "Ready for rides"
                  : "Not accepting rides"}
              </span>

            </div>

          </div>

          {/* ================================================= */}
          {/* SIGN OUT — SIDEBAR ONLY */}
          {/* ================================================= */}

          <button
            type="button"
            className="sidebarLogout"
            onClick={handleLogout}
            disabled={busy}
          >
            <LogOut size={18} />

            <span>
              {busy
                ? "Signing out..."
                : "Sign out"}
            </span>
          </button>

        </div>

      </aside>

      {/* ================================================= */}
      {/* MOBILE OVERLAY */}
      {/* ================================================= */}

      {sidebarOpen && (
        <div
          className="sidebarOverlay"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      {/* ================================================= */}
      {/* MAIN DASHBOARD */}
      {/* ================================================= */}

      <main
        className="dashPage driverMain"
        id="dashboard"
      >

        {/* MOBILE MENU */}

        <button
          type="button"
          className="mobileMenuBtn"
          onClick={() =>
            setSidebarOpen(true)
          }
        >
          <Menu size={22} />
        </button>

        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <div className="dashTop">

          <div>

            <div className="eyebrow">
              DRIVER DASHBOARD
            </div>

            <h1>
              Drive with RideFlow,{" "}
              {user?.name?.split(" ")[0]}.
            </h1>

            <p>
              Manage your availability,
              requests and active trips.
            </p>

          </div>

          {/* ================================================= */}
          {/* HEADER ACTIONS */}
          {/* SIGN OUT REMOVED FROM HERE */}
          {/* ================================================= */}

          <div className="driverHeaderActions">

            <button
              type="button"
              className={`onlineToggle ${
                d.online
                  ? "on"
                  : ""
              }`}
              onClick={toggle}
              disabled={
                busy ||
                d.applicationStatus !==
                  "approved"
              }
            >
              <Power />

              {d.online
                ? "Online"
                : "Go online"}
            </button>

          </div>

        </div>

        {/* ================================================= */}
        {/* ERROR */}
        {/* ================================================= */}

        {error && (
          <div className="error wideError">
            {error}
          </div>
        )}

        {/* ================================================= */}
        {/* APPLICATION STATUS */}
        {/* ================================================= */}

        {d.applicationStatus !==
          "approved" && (

          <div className="applicationBanner">

            <AlertTriangle />

            <div>

              <b>
                Application:{" "}
                {d.applicationStatus}
              </b>

              <span>
                {d.applicationStatus ===
                "pending"
                  ? "RideFlow admin must review your ID and licence before you can go online."
                  : d.applicationStatus ===
                    "rejected"
                  ? "Your application was rejected. Contact RideFlow support."
                  : "Your driver access is currently suspended."}
              </span>

            </div>

          </div>
        )}

        {/* ================================================= */}
        {/* STATS */}
        {/* ================================================= */}

        <div className="driverStats">

          <Stat
            icon={<Power />}
            label="Availability"
            value={
              d.online
                ? "ONLINE"
                : "OFFLINE"
            }
          />

          <Stat
            icon={<Star />}
            label="Rating"
            value={
              d.rating?.toFixed(1) ||
              "5.0"
            }
          />

          <Stat
            icon={<Car />}
            label="Trips"
            value={
              d.trips || 0
            }
          />

          <Stat
            icon={<Wallet />}
            label="Earnings"
            value={`R ${Number(
              earnings?.total ??
                d.earnings ??
                0
            ).toFixed(2)}`}
          />

        </div>

        {/* ================================================= */}
        {/* EARNINGS */}
        {/* ================================================= */}

        {earnings && (
          <section
            className="panelSection driverEarningsSection"
            id="earnings"
          >

            <div className="sectionTitle">

              <div>

                <small>
                  EARNINGS
                </small>

                <h2>
                  Your earnings
                </h2>

              </div>

            </div>

            <div className="earningsCards">

              <div className="earningsCard">

                <small>
                  TODAY
                </small>

                <strong>
                  R{" "}
                  {Number(
                    earnings.today
                  ).toFixed(2)}
                </strong>

                <span>
                  {earnings.todayTrips ||
                    0} rides
                </span>

              </div>

              <div className="earningsCard">

                <small>
                  THIS WEEK
                </small>

                <strong>
                  R{" "}
                  {Number(
                    earnings.week
                  ).toFixed(2)}
                </strong>

                <span>
                  {earnings.weekTrips ||
                    0} rides
                </span>

              </div>

              <div className="earningsCard">

                <small>
                  THIS MONTH
                </small>

                <strong>
                  R{" "}
                  {Number(
                    earnings.month
                  ).toFixed(2)}
                </strong>

                <span>
                  {earnings.monthTrips ||
                    0} rides
                </span>

              </div>

              <div className="earningsCard">

                <small>
                  AVERAGE / RIDE
                </small>

                <strong>
                  R{" "}
                  {Number(
                    earnings.averagePerRide ||
                      0
                  ).toFixed(2)}
                </strong>

                <span>
                  Completed rides
                </span>

              </div>

            </div>

          </section>
        )}

        {/* ================================================= */}
        {/* DRIVER GRID */}
        {/* ================================================= */}

        <div className="driverGrid">

          {/* ================================================= */}
          {/* RIDE REQUESTS */}
          {/* ================================================= */}

          <section
            className="panelSection"
            id="requests"
          >

            <div className="sectionTitle">

              <div>

                <small>
                  RIDE REQUESTS
                </small>

                <h2>
                  Trips waiting
                </h2>

              </div>

              <button
                type="button"
                className="iconBtn"
                onClick={load}
              >
                <RefreshCw />
              </button>

            </div>

            {available.length ? (

              available.map((r) => (

                <div
                  className="requestCard"
                  key={r._id}
                >

                  <div className="requestTop">

                    <div className="requestAvatar">
                      <MapPin />
                    </div>

                    <div>

                      <b>
                        {r.passenger?.name ||
                          "Passenger"}
                      </b>

                      <span>
                        {r.pickup?.name ||
                          r.pickup}
                      </span>

                    </div>

                    <strong>
                      R{" "}
                      {Number(
                        r.fare
                      ).toFixed(2)}
                    </strong>

                  </div>

                  <div className="requestRoute">

                    <span>
                      {r.pickup?.name ||
                        r.pickup}
                    </span>

                    <Navigation
                      size={14}
                    />

                    <span>
                      {r.destination?.name ||
                        r.destination}
                    </span>

                  </div>

                  <button
                    type="button"
                    disabled={
                      busy ||
                      !d.online
                    }
                    className="btn primary full"
                    onClick={() =>
                      accept(r._id)
                    }
                  >
                    {d.online
                      ? "Accept ride"
                      : "Go online to accept"}
                  </button>

                </div>

              ))

            ) : (

              <div className="empty">
                No ride requests right now.
              </div>

            )}

          </section>

          {/* ================================================= */}
          {/* MAP / ACTIVE TRIP */}
          {/* ================================================= */}

          <section
            className="mapPanel driverMap"
            id="active-trip"
          >

            <RideMap
              pickup={
                current?.pickup
              }
              destination={
                current?.destination
              }
              driverLocation={
                d.location
              }
              height="100%"
            />

            {current && (

              <div className="driverActiveCard">

                <small>
                  ACTIVE TRIP
                </small>

                <b>
                  {current.pickup?.name ||
                    current.pickup}
                </b>

                <span>
                  →{" "}
                  {current.destination?.name ||
                    current.destination}
                </span>

                <div className="statusButtons">

                  {current.status ===
                    "accepted" && (

                    <button
                      type="button"
                      onClick={() =>
                        status(
                          current._id,
                          "arriving"
                        )
                      }
                    >
                      I'm on the way
                    </button>

                  )}

                  {current.status ===
                    "arriving" && (

                    <button
                      type="button"
                      onClick={() =>
                        status(
                          current._id,
                          "arrived"
                        )
                      }
                    >
                      I've arrived
                    </button>

                  )}

                  {current.status ===
                    "arrived" && (

                    <button
                      type="button"
                      onClick={() =>
                        status(
                          current._id,
                          "in_progress"
                        )
                      }
                    >
                      Start trip
                    </button>

                  )}

                  {current.status ===
                    "in_progress" && (

                    <button
                      type="button"
                      onClick={() =>
                        status(
                          current._id,
                          "completed"
                        )
                      }
                    >
                      Complete trip
                    </button>

                  )}

                </div>

              </div>

            )}

          </section>

        </div>

        {/* ================================================= */}
        {/* DRIVER PROFILE */}
        {/* ================================================= */}

        <section
          className="panelSection"
          id="profile"
        >

          <div className="sectionTitle">

            <div>

              <small>
                DRIVER PROFILE
              </small>

              <h2>
                Vehicle & verification
              </h2>

            </div>

          </div>

          <div className="profileFacts">

            <Fact
              label="Vehicle"
              value={`${d.vehicleMake || "—"} ${
                d.vehicleModel || ""
              }`}
            />

            <Fact
              label="Colour"
              value={
                d.vehicleColor ||
                "—"
              }
            />

            <Fact
              label="Registration"
              value={
                d.registration ||
                "—"
              }
            />

            <Fact
              label="Licence"
              value={
                d.licenseNumber ||
                "—"
              }
            />

            <Fact
              label="Verification"
              value={
                d.verified
                  ? "Verified"
                  : "Pending review"
              }
              icon={
                <FileCheck />
              }
            />

          </div>

        </section>

      </main>

    </div>
  );
}

// ===========================================================
// STAT
// ===========================================================

function Stat({
  icon,
  label,
  value
}) {
  return (
    <div className="statCard">

      {icon}

      <small>
        {label}
      </small>

      <b>
        {value}
      </b>

    </div>
  );
}

// ===========================================================
// FACT
// ===========================================================

function Fact({
  label,
  value
}) {
  return (
    <div className="fact">

      <small>
        {label}
      </small>

      <b>
        {value}
      </b>

    </div>
  );
}