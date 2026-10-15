
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  MapPin,
  Navigation,
  Car,
  Wallet,
  RefreshCw,
  MessageCircle,
  Phone,
  ShieldAlert,
  XCircle,
  LogOut,
  LocateFixed,
} from "lucide-react";

import api from "../services/api";
import socket from "../services/socket";
import { useAuth } from "../context/AuthContext";
import RideMap from "../components/RideMap";
import { searchPlace } from "../services/geocoding";

// =========================================================
// CONFIGURATION
// =========================================================

const ACTIVE_RIDE_STATUSES = [
  "searching",
  "accepted",
  "arriving",
  "arrived",
  "in_progress",
];

const MAX_ACCEPTABLE_GPS_ACCURACY = 5000;
const GPS_TIMEOUT = 30000;
const GPS_MAX_AGE = 15000;
const GPS_FALLBACK_MAX_AGE = 60000;

// =========================================================
// HELPERS
// =========================================================

function getUserId(user) {
  return user?.id || user?._id || null;
}

function getPassengerId(ride) {
  return (
    ride?.passenger?._id ||
    ride?.passenger?.id ||
    ride?.passenger ||
    null
  );
}

function getRideId(ride) {
  return ride?._id || ride?.id || null;
}

function getDriverLocation(ride) {
  return (
    ride?.driverLocation ||
    ride?.driver?.location ||
    null
  );
}

function validCoordinates(location) {
  if (!location) return false;

  const lat = Number(location.lat);
  const lng = Number(location.lng);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function upsertRide(list, ride) {
  if (!ride) return list;

  const id = getRideId(ride);

  return [
    ride,
    ...list.filter(
      (item) =>
        String(getRideId(item)) !== String(id)
    ),
  ];
}

function labelStatus(status) {
  return (
    {
      searching: "Searching for a driver",
      accepted: "Driver assigned",
      arriving: "Driver is on the way",
      arrived: "Driver has arrived",
      in_progress: "Trip in progress",
      completed: "Trip completed",
      cancelled: "Trip cancelled",
    }[status] || status
  );
}

// =========================================================
// PASSENGER DASHBOARD
// =========================================================

export default function PassengerDashboard() {
  const { user, logout } = useAuth();
  const userId = getUserId(user);

  // General
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Pickup and destination
  const [pickup, setPickup] = useState(null);
  const [dest, setDest] = useState(null);
  const [pText, setPText] = useState("");
  const [dText, setDText] = useState("");
  const [pResults, setPResults] = useState([]);
  const [dResults, setDResults] = useState([]);

  // GPS
  const [liveLocation, setLiveLocation] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationWatching, setLocationWatching] = useState(false);
  const [locationError, setLocationError] = useState("");

  // Rides
  const [estimate, setEstimate] = useState(null);
  const [payment, setPayment] = useState("cash");
  const [rides, setRides] = useState([]);
  const [active, setActive] = useState(null);

  // Driver
  const [driverLoc, setDriverLoc] = useState(null);

  // Socket
  const [socketConnected, setSocketConnected] = useState(
    socket.connected
  );

  // Refs
  const activeRideRef = useRef(null);
  const poorAccuracyLogRef = useRef(0);
  const pickupSearchRequestRef = useRef(0);
  const destinationSearchRequestRef = useRef(0);
  const locationRequestRef = useRef(0);

  // Keep latest ride available to socket reconnect handler.
  useEffect(() => {
    activeRideRef.current = active;
  }, [active]);

  // =======================================================
  // SOCKET ROOM
  // =======================================================

  const joinRideRoom = useCallback((rideId) => {
    if (!rideId) return;

    const id = String(rideId);

    if (!socket.connected) {
      console.log(
        "Socket not connected; ride room will be joined after reconnect:",
        id
      );
      return;
    }

    socket.emit("join:ride", id);
    console.log("Passenger joined ride room:", id);
  }, []);

  // =======================================================
  // SOCKET CONNECTION
  // =======================================================

  useEffect(() => {
    if (!userId) return;

    const handleConnect = () => {
      console.log("Passenger socket connected:", socket.id);
      setSocketConnected(true);

      socket.emit("join:user", String(userId));

      const currentRideId = getRideId(activeRideRef.current);

      if (currentRideId) {
        socket.emit("join:ride", String(currentRideId));
      }
    };

    const handleDisconnect = (reason) => {
      console.warn("Passenger socket disconnected:", reason);
      setSocketConnected(false);
    };

    const handleConnectError = (socketError) => {
      console.error(
        "Passenger socket connection error:",
        socketError?.message || socketError
      );
      setSocketConnected(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
    };
  }, [userId]);

  // =======================================================
  // LOAD RIDES
  // =======================================================

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);

        setError("");

        const response = await api.get("/rides/mine");
        const rideList = response.data?.rides || [];

        setRides(rideList);

        const activeRides = rideList
          .filter((ride) =>
            ACTIVE_RIDE_STATUSES.includes(ride.status)
          )
          .sort(
            (a, b) =>
              new Date(b.createdAt || 0) -
              new Date(a.createdAt || 0)
          );

        const currentRide = activeRides[0] || null;

        setActive(currentRide);
        activeRideRef.current = currentRide;

        if (currentRide) {
          setDriverLoc(getDriverLocation(currentRide) || null);
          joinRideRoom(getRideId(currentRide));
        } else {
          setDriverLoc(null);
        }
      } catch (e) {
        console.error("LOAD RIDES ERROR:", e);
        setError(
          e.response?.data?.message ||
            "Could not refresh your rides."
        );
      } finally {
        if (isRefresh) setRefreshing(false);
      }
    },
    [joinRideRoom]
  );

  useEffect(() => {
    if (userId) load();
  }, [userId, load]);

  useEffect(() => {
    const rideId = getRideId(active);

    if (rideId) {
      joinRideRoom(rideId);
    }
  }, [active, joinRideRoom, socketConnected]);

  // =======================================================
  // SOCKET RIDE EVENTS
  // =======================================================

  useEffect(() => {
    if (!userId) return;

    const belongsToPassenger = (ride) =>
      String(getPassengerId(ride)) === String(userId);

    const handleRideCreated = (ride) => {
      if (!belongsToPassenger(ride)) return;

      setActive(ride);
      activeRideRef.current = ride;
      setRides((old) => upsertRide(old, ride));
      setDriverLoc(getDriverLocation(ride));
      joinRideRoom(getRideId(ride));
    };

    const handleRideAccepted = (ride) => {
      if (!belongsToPassenger(ride)) return;

      setActive(ride);
      activeRideRef.current = ride;
      setRides((old) => upsertRide(old, ride));
      setDriverLoc(getDriverLocation(ride));
      joinRideRoom(getRideId(ride));

      // Reload populated driver details.
      load();
    };

    const handleRideStatus = (ride) => {
      if (!belongsToPassenger(ride)) return;

      setRides((old) => upsertRide(old, ride));

      if (
        ride.status === "completed" ||
        ride.status === "cancelled"
      ) {
        setActive(null);
        activeRideRef.current = null;
        setDriverLoc(null);
        return;
      }

      setActive(ride);
      activeRideRef.current = ride;

      const location = getDriverLocation(ride);

      if (location) setDriverLoc(location);

      joinRideRoom(getRideId(ride));
    };

    const handleDriverLocation = (data) => {
      if (
        !data?.rideId ||
        data.lat == null ||
        data.lng == null
      ) {
        console.warn("Invalid driver location event:", data);
        return;
      }

      const lat = Number(data.lat);
      const lng = Number(data.lng);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        console.warn("Invalid driver coordinates:", data);
        return;
      }

      const currentRide = activeRideRef.current;

      if (
        !currentRide ||
        String(getRideId(currentRide)) !== String(data.rideId)
      ) {
        return;
      }

      const newLocation = {
        lat,
        lng,
        updatedAt: data.updatedAt || new Date().toISOString(),
      };

      setDriverLoc(newLocation);

      setActive((old) => {
        if (
          !old ||
          String(getRideId(old)) !== String(data.rideId)
        ) {
          return old;
        }

        const updatedRide = {
          ...old,
          driverLocation: newLocation,
        };

        activeRideRef.current = updatedRide;
        return updatedRide;
      });
    };

    socket.on("ride:created", handleRideCreated);
    socket.on("ride:accepted", handleRideAccepted);
    socket.on("ride:status", handleRideStatus);
    socket.on("driver:location", handleDriverLocation);

    return () => {
      socket.off("ride:created", handleRideCreated);
      socket.off("ride:accepted", handleRideAccepted);
      socket.off("ride:status", handleRideStatus);
      socket.off("driver:location", handleDriverLocation);
    };
  }, [userId, joinRideRoom, load]);

  // =======================================================
  // PASSENGER GPS WATCH
  // =======================================================

  useEffect(() => {
    if (!userId) return;

    if (!navigator.geolocation) {
      setLocationError(
        "Your browser does not support location services. Search for your pickup manually."
      );
      return;
    }

    let mounted = true;
    let watchId = null;

    const handlePosition = (position) => {
      if (!mounted) return;

      const lat = Number(position.coords.latitude);
      const lng = Number(position.coords.longitude);
      const accuracy = Number(position.coords.accuracy);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return;
      }

      if (Number.isFinite(accuracy) && accuracy >= 0) {
        setLocationAccuracy(accuracy);
      }

      const location = {
        name: "My current location",
        lat,
        lng,
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
        updatedAt: new Date().toISOString(),
      };

      // Retain the latest reading, even if approximate.
      setLiveLocation(location);

      if (
        Number.isFinite(accuracy) &&
        accuracy > MAX_ACCEPTABLE_GPS_ACCURACY
      ) {
        setLocationWatching(false);
        setLocationError(
          `Your location is approximate (±${Math.round(
            accuracy
          )}m). Waiting for a better reading. You can search for your pickup manually.`
        );

        const now = Date.now();

        if (now - poorAccuracyLogRef.current > 10000) {
          console.warn(
            "Passenger GPS accuracy is poor:",
            Math.round(accuracy),
            "metres"
          );
          poorAccuracyLogRef.current = now;
        }

        // Do not stop the watcher. A better reading may arrive.
        return;
      }

      setLocationWatching(true);
      setLocationError("");
      poorAccuracyLogRef.current = 0;

      console.log("PASSENGER LIVE GPS:", location);
    };

    const handleError = (geoError) => {
      if (!mounted) return;

      console.warn(
        "PASSENGER GEOLOCATION ERROR:",
        geoError.code,
        geoError.message
      );

      switch (geoError.code) {
        case 1:
          setLocationWatching(false);
          setLocationError(
            "Location permission was denied. Allow location access for localhost in your browser settings."
          );
          break;

        case 2:
          setLocationWatching(false);
          setLocationError(
            "Your device cannot determine your location yet. Check device location services or search for your pickup."
          );
          break;

        case 3:
          // A watchPosition timeout does not automatically
          // mean the watch has stopped.
          setLocationError(
            "Location is taking longer than expected. Keep this page open while RideFlow continues trying."
          );
          break;

        default:
          setLocationError(
            "Unable to determine your location. Search for your pickup manually."
          );
      }
    };

    setLocationError("");
    setLocationWatching(false);

    watchId = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: GPS_TIMEOUT,
        maximumAge: GPS_MAX_AGE,
      }
    );

    console.log("Passenger GPS watcher started.");

    return () => {
      mounted = false;

      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [userId]);

  // =======================================================
  // USE MY LOCATION
  // =======================================================

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError(
        "Your browser does not support location services."
      );
      setError("Search for your pickup manually.");
      return;
    }

    const requestId = ++locationRequestRef.current;
    let finished = false;

    const isCurrentRequest = () =>
      requestId === locationRequestRef.current;

    const finish = () => {
      if (!isCurrentRequest() || finished) return;

      finished = true;
      setLocating(false);
    };

    setLocating(true);
    setError("");
    setLocationError("");

    const handleSuccess = (position) => {
      if (!isCurrentRequest() || finished) return;

      const lat = Number(position.coords.latitude);
      const lng = Number(position.coords.longitude);
      const accuracy = Number(position.coords.accuracy);

      console.log("CURRENT LOCATION RESULT:", {
        lat,
        lng,
        accuracy,
      });

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        setError("Your device returned invalid location coordinates.");
        setLocationError(
          "Unable to use this location. Search for your pickup manually."
        );
        finish();
        return;
      }

      const location = {
        name: "My current location",
        lat,
        lng,
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
        updatedAt: new Date().toISOString(),
      };

      setLocationAccuracy(
        Number.isFinite(accuracy) ? accuracy : null
      );

      setLiveLocation(location);
      setPickup(location);
      setPText(location.name);
      setPResults([]);
      setEstimate(null);
      setError("");
      poorAccuracyLogRef.current = 0;

      if (
        Number.isFinite(accuracy) &&
        accuracy > MAX_ACCEPTABLE_GPS_ACCURACY
      ) {
        setLocationWatching(false);
        setLocationError(
          `Pickup selected, but your location is approximate (±${Math.round(
            accuracy
          )}m). Verify the pickup on the map or choose a nearby address from search.`
        );
      } else {
        setLocationWatching(true);
        setLocationError("");
      }

      console.log("USING PASSENGER PICKUP:", location);
      finish();
    };

    const handleFallbackError = (geoError) => {
      if (!isCurrentRequest() || finished) return;

      console.warn(
        "FALLBACK LOCATION ERROR:",
        geoError.code,
        geoError.message
      );

      if (geoError.code === 1) {
        setError(
          "Location permission was denied. Allow location access for RideFlow."
        );
        setLocationError("Location permission was denied.");
      } else if (geoError.code === 2) {
        setError(
          "Your device cannot determine your location. Check device location settings or search for your pickup manually."
        );
        setLocationError("Your current location is unavailable.");
      } else if (geoError.code === 3) {
        setError(
          "Location detection timed out. Check device location settings and try again, or search for your pickup manually."
        );
        setLocationError("Location detection timed out.");
      } else {
        setError(
          "Unable to determine your location. Search for your pickup manually."
        );
        setLocationError("Location could not be determined.");
      }

      setLocationWatching(false);
      finish();
    };

    const handleFirstError = (geoError) => {
      if (!isCurrentRequest() || finished) return;

      console.warn(
        "HIGH-ACCURACY LOCATION ERROR:",
        geoError.code,
        geoError.message
      );

      if (geoError.code === 1) {
        setError(
          "Location permission was denied. Allow location access for RideFlow."
        );
        setLocationError("Location permission was denied.");
        setLocationWatching(false);
        finish();
        return;
      }

      setLocationError(
        "Precise location is taking too long. Trying another location method..."
      );

      console.log(
        "High-accuracy location failed. Trying fallback location..."
      );

      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        handleFallbackError,
        {
          enableHighAccuracy: false,
          timeout: GPS_TIMEOUT,
          maximumAge: GPS_FALLBACK_MAX_AGE,
        }
      );
    };

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleFirstError,
      {
        enableHighAccuracy: true,
        timeout: GPS_TIMEOUT,
        maximumAge: 0,
      }
    );
  }, []);

  // =======================================================
  // PICKUP / DESTINATION INPUTS
  // =======================================================

  const handlePickupChange = (value) => {
    setPText(value);
    setPResults([]);
    setError("");

    if (value.trim() !== "My current location") {
      setPickup(null);
      setEstimate(null);
    }
  };

  const handleDestinationChange = (value) => {
    setDText(value);
    setDResults([]);
    setDest(null);
    setEstimate(null);
    setError("");
  };

  // =======================================================
  // PICKUP SEARCH
  // =======================================================

  useEffect(() => {
    const cleanText = pText.trim();

    if (
      cleanText === "My current location" ||
      cleanText.length < 3
    ) {
      setPResults([]);
      return;
    }

    const requestId = ++pickupSearchRequestRef.current;
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const results = await searchPlace(cleanText);

        if (
          cancelled ||
          requestId !== pickupSearchRequestRef.current
        ) {
          return;
        }

        setPResults(results || []);
      } catch (e) {
        if (!cancelled) {
          console.error("PICKUP SEARCH ERROR:", e);
          setPResults([]);
        }
      }
    }, 700);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pText]);

  // =======================================================
  // DESTINATION SEARCH
  // =======================================================

  useEffect(() => {
    const cleanText = dText.trim();

    if (cleanText.length < 3) {
      setDResults([]);
      return;
    }

    const requestId = ++destinationSearchRequestRef.current;
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const results = await searchPlace(cleanText);

        if (
          cancelled ||
          requestId !== destinationSearchRequestRef.current
        ) {
          return;
        }

        setDResults(results || []);
      } catch (e) {
        if (!cancelled) {
          console.error("DESTINATION SEARCH ERROR:", e);
          setDResults([]);
        }
      }
    }, 700);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dText]);

  // =======================================================
  // SELECT LOCATIONS
  // =======================================================

  const selectPickup = (location) => {
    setPickup(location);
    setPText(location.name);
    setPResults([]);
    setEstimate(null);
    setError("");
  };

  const selectDestination = (location) => {
    setDest(location);
    setDText(location.name);
    setDResults([]);
    setEstimate(null);
    setError("");
  };

  // =======================================================
  // FARE ESTIMATE
  // =======================================================

  const doEstimate = async (event) => {
    event?.preventDefault();

    setError("");
    setEstimate(null);

    if (!pickup || !dest) {
      setError("Please select both pickup and destination.");
      return;
    }

    if (
      !validCoordinates(pickup) ||
      !validCoordinates(dest)
    ) {
      setError(
        "Please select valid pickup and destination locations from the suggestions."
      );
      return;
    }

    try {
      setBusy(true);

      const response = await api.post("/rides/estimate", {
        pickup: {
          name: pickup.name || "Pickup location",
          lat: Number(pickup.lat),
          lng: Number(pickup.lng),
        },
        destination: {
          name: dest.name || "Destination",
          lat: Number(dest.lat),
          lng: Number(dest.lng),
        },
      });

      console.log("FARE RESPONSE:", response.data);
      setEstimate(response.data);
    } catch (e) {
      console.error("FARE ERROR:", e);
      setError(
        e.response?.data?.message ||
          "Unable to calculate fare."
      );
    } finally {
      setBusy(false);
    }
  };

  // =======================================================
  // BOOK RIDE
  // =======================================================

  const book = async (event) => {
    event?.preventDefault();

    setError("");

    if (active) {
      setError("You already have an active ride.");
      return;
    }

    if (!estimate) {
      setError("Please calculate your fare before booking.");
      return;
    }

    if (
      !pickup ||
      !dest ||
      !validCoordinates(pickup) ||
      !validCoordinates(dest)
    ) {
      setError(
        "Please select valid pickup and destination locations."
      );
      return;
    }

    try {
      setBusy(true);

      const response = await api.post("/rides", {
        pickup: {
          name: pickup.name || "Pickup location",
          lat: Number(pickup.lat),
          lng: Number(pickup.lng),
        },
        destination: {
          name: dest.name || "Destination",
          lat: Number(dest.lat),
          lng: Number(dest.lng),
        },
        paymentMethod: payment,
      });

      const ride = response.data?.ride;

      if (!ride) {
        throw new Error("Ride was not returned by the server.");
      }

      setActive(ride);
      activeRideRef.current = ride;
      setRides((old) => upsertRide(old, ride));
      setDriverLoc(getDriverLocation(ride));
      joinRideRoom(getRideId(ride));
      setEstimate(null);

      console.log("Ride booked successfully:", getRideId(ride));
    } catch (e) {
      console.error("BOOKING ERROR:", e);
      setError(
        e.response?.data?.message ||
          e.message ||
          "Unable to book ride."
      );
    } finally {
      setBusy(false);
    }
  };

  // =======================================================
  // PAYMENT
  // =======================================================

  const selectPayment = (method) => {
    setPayment(method);
    setError("");
  };

  // =======================================================
  // RATE RIDE
  // =======================================================

  const rate = async (id, rating) => {
    try {
      await api.post(`/rides/${id}/rating`, { rating });

      setRides((old) =>
        old.map((ride) =>
          String(getRideId(ride)) === String(id)
            ? { ...ride, rated: true }
            : ride
        )
      );
    } catch (e) {
      console.error("RATING ERROR:", e);
      setError(
        e.response?.data?.message || "Unable to rate ride."
      );
    }
  };

  // =======================================================
  // CANCEL RIDE
  // =======================================================

  const cancel = async () => {
    if (!active) return;

    if (
      !window.confirm(
        "Are you sure you want to cancel this ride?"
      )
    ) {
      return;
    }

    try {
      setBusy(true);
      setError("");

      await api.patch(`/rides/${getRideId(active)}/status`, {
        status: "cancelled",
      });

      setActive(null);
      activeRideRef.current = null;
      setDriverLoc(null);

      await load();
    } catch (e) {
      console.error("CANCEL ERROR:", e);
      setError(
        e.response?.data?.message || "Unable to cancel ride."
      );
    } finally {
      setBusy(false);
    }
  };

  // =======================================================
  // SOS
  // =======================================================

  const handleSOS = () => {
    if (!active) {
      setError("SOS is only available during an active ride.");
      return;
    }

    if (
      !window.confirm(
        "This will open your phone's emergency dialer for 112. Continue?"
      )
    ) {
      return;
    }

    window.location.href = "tel:112";
  };

  // =======================================================
  // LOGOUT
  // =======================================================

  const handleLogout = async () => {
    try {
      setBusy(true);
      setError("");
      await logout();
    } catch (e) {
      console.error("LOGOUT ERROR:", e);
      setError("Unable to sign out. Please try again.");
      setBusy(false);
    }
  };

  const accuracyText = Number.isFinite(locationAccuracy)
    ? `±${Math.round(locationAccuracy)}m`
    : "";

  // =======================================================
  // RENDER
  // =======================================================

  return (
    <main className="dashPage">
      <div className="dashTop">
        <div>
          <div className="eyebrow">PASSENGER DASHBOARD</div>

          <h1>
            Where are you going,{" "}
            {user?.name?.split(" ")[0] || "Passenger"}?
          </h1>

          <p>Choose your route and follow your driver live.</p>
        </div>

        <div
          className="dashActions"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            gap: "10px",
            minWidth: "150px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "7px",
              fontSize: "12px",
              opacity: 0.8,
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: socketConnected ? "#16a34a" : "#dc2626",
              }}
            />

            {socketConnected ? "Live connection" : "Connecting..."}
          </div>

          <button
            type="button"
            className="logoutBtn"
            onClick={handleLogout}
            disabled={busy}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              width: "100%",
            }}
          >
            <LogOut size={18} />
            {busy ? "Signing out..." : "Sign out"}
          </button>

          <button
            type="button"
            className="iconBtn"
            onClick={() => load(true)}
            disabled={busy || refreshing}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              width: "100%",
            }}
          >
            <RefreshCw
              size={20}
              className={refreshing ? "refreshSpin" : ""}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="passengerGrid">
        {/* BOOKING */}
        <section className="bookPanel">
          <div className="panelHead">
            <div>
              <small>BOOK A RIDE</small>
              <h2>Your journey</h2>
            </div>

            <span className="saPill">🇿🇦 South Africa</span>
          </div>

          <PlaceInput
            icon={<MapPin />}
            value={pText}
            setValue={handlePickupChange}
            results={pResults}
            choose={selectPickup}
            green
            onUseLocation={useMyLocation}
            locating={locating}
          />

          {(liveLocation || locationError || locating) && (
            <div
              className="liveLocationStatus"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                marginTop: "8px",
                marginBottom: "12px",
                fontSize: "12px",
                opacity: 0.9,
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  minWidth: "8px",
                  marginTop: "4px",
                  borderRadius: "50%",
                  background: locating
                    ? "#f59e0b"
                    : locationWatching
                    ? "#16a34a"
                    : "#dc2626",
                  display: "inline-block",
                }}
              />

              <span>
                {locating
                  ? "Finding your location..."
                  : locationError ||
                    (locationWatching
                      ? `Location available${accuracyText ? ` • ${accuracyText}` : ""}`
                      : "Location services ready")}
              </span>
            </div>
          )}

          <PlaceInput
            icon={<Navigation />}
            value={dText}
            setValue={handleDestinationChange}
            results={dResults}
            choose={selectDestination}
          />

          <div className="ride-actions">
            <div
              className="payRow"
              style={{
                width: "100%",
                margin: 0,
                display: "flex",
                gap: "8px",
              }}
            >
              <button
                type="button"
                className={payment === "cash" ? "selected" : ""}
                onClick={() => selectPayment("cash")}
                style={{ flex: "1 1 0" }}
              >
                <Wallet />
                <span>Cash</span>
              </button>

              <button
                type="button"
                className={payment === "card" ? "selected" : ""}
                onClick={() => selectPayment("card")}
                style={{ flex: "1 1 0" }}
              >
                <Car />
                <span>Card</span>
              </button>
            </div>

            <div className="fare-book-row">
              <div className="fare-action">
                {estimate ? (
                  <div className="estimate">
                    <div>
                      <small>ESTIMATED FARE</small>

                      <b>
                        R {Number(estimate.fare || 0).toFixed(2)}
                      </b>

                      <span>
                        {estimate.distanceKm ?? "-"} km
                        {" • "}
                        {estimate.durationMin ?? "-"} min
                      </span>
                    </div>

                    {Number(estimate.multiplier) === 2 && (
                      <strong>2× NIGHT FARE</strong>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setEstimate(null);
                        setError("");
                      }}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn primary full"
                    onClick={doEstimate}
                    disabled={busy || !pickup || !dest}
                  >
                    {busy ? "Calculating..." : "Calculate fare"}
                  </button>
                )}
              </div>

              <div className="book-action">
                <button
                  type="button"
                  className="btn dark full"
                  disabled={!estimate || busy || Boolean(active)}
                  onClick={book}
                >
                  {active
                    ? "Active ride"
                    : busy
                    ? "Finding driver..."
                    : "Confirm & book ride"}
                </button>
              </div>
            </div>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="safetyMini">
            <ShieldAlert />
            <span>
              <b>Safety</b> Your assigned driver, vehicle details and
              live driver location are shown during the ride.
            </span>
          </div>

          {/* DRIVER DETAILS */}
          {active?.driver && (
            <div className="passengerDriverCard">
              <div className="passengerDriverHeader">
                <div>
                  <small>YOUR DRIVER</small>
                  <h3>Driver details</h3>
                </div>

                <div className="driverVerifiedBadge">
                  <ShieldAlert size={13} />
                  Verified
                </div>
              </div>

              <div className="passengerDriverMain">
                <div className="passengerDriverAvatar">
                  {active.driver?.user?.photo ||
                  active.driver?.user?.avatar ? (
                    <img
                      src={
                        active.driver.user.photo ||
                        active.driver.user.avatar
                      }
                      alt={active.driver?.user?.name || "Driver"}
                    />
                  ) : (
                    <Car size={20} />
                  )}
                </div>

                <div className="passengerDriverIdentity">
                  <strong>
                    {active.driver?.user?.name || "Assigned driver"}
                  </strong>

                  <span>
                    ⭐{" "}
                    {Number(active.driver?.rating || 5).toFixed(1)}
                  </span>
                </div>
              </div>

              <div className="passengerVehicle">
                <Car size={17} />

                <div>
                  <small>VEHICLE</small>

                  <strong>
                    {active.driver?.vehicleMake || "Vehicle"}{" "}
                    {active.driver?.vehicleModel || ""}
                  </strong>

                  <span>
                    {active.driver?.vehicleColor ||
                      "Colour not provided"}
                    {" · "}
                    {active.driver?.registration ||
                      "Registration unavailable"}
                  </span>
                </div>
              </div>

              {active.driver?.user?.phone && (
                <div className="driverContactActions">
                  <a
                    href={`tel:${active.driver.user.phone}`}
                    className="driverContactButton call"
                  >
                    <Phone size={16} />
                    Call
                  </a>

                  <a
                    href={`https://wa.me/${String(
                      active.driver.user.phone
                    )
                      .replace(/\D/g, "")
                      .replace(/^0/, "27")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="driverContactButton whatsapp"
                  >
                    <MessageCircle size={16} />
                    WhatsApp
                  </a>
                </div>
              )}
            </div>
          )}
        </section>

        {/* MAP */}
        <section className="mapPanel">
          <RideMap
            pickup={active?.pickup || pickup}
            destination={active?.destination || dest}
            driverLocation={
              driverLoc || active?.driverLocation || null
            }
            passengerLocation={liveLocation}
            height="100%"
          />

          {active && (
            <div className="activeRideCard">
              <div className="statusLine">
                <span className="statusDot" />
                <b>{labelStatus(active.status)}</b>
                <small>Live trip</small>
              </div>

              <div className="activeActions">
                <button
                  type="button"
                  onClick={cancel}
                  disabled={
                    busy ||
                    ["completed", "cancelled"].includes(active.status)
                  }
                >
                  <XCircle />
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSOS}
                  disabled={
                    busy ||
                    ["completed", "cancelled"].includes(active.status)
                  }
                >
                  <ShieldAlert />
                  SOS
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* RIDE HISTORY */}
      <section className="panelSection">
        <div className="sectionTitle">
          <div>
            <small>RIDE HISTORY</small>
            <h2>Your journeys</h2>
          </div>
        </div>

        {rides.length ? (
          rides.slice(0, 12).map((ride) => (
            <div className="rideRow" key={getRideId(ride)}>
              <div className="rideIcon">
                <Car />
              </div>

              <div className="rideRoute">
                <b>
                  {ride.pickup?.name || ride.pickup}
                  {" → "}
                  {ride.destination?.name || ride.destination}
                </b>

                <span>
                  {ride.createdAt
                    ? new Date(ride.createdAt).toLocaleString()
                    : ""}
                  {" • "}
                  {ride.status}
                </span>
              </div>

              <strong>
                R {Number(ride.fare || 0).toFixed(2)}
              </strong>

              {ride.status === "completed" && (
                <div className="ratingStars">
                  {ride.rated ? (
                    <span>Rated ✓</span>
                  ) : (
                    [1, 2, 3, 4, 5].map((number) => (
                      <button
                        type="button"
                        key={number}
                        onClick={() => rate(getRideId(ride), number)}
                        title={`Rate ${number}`}
                      >
                        ★
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="empty">Your rides will appear here.</div>
        )}
      </section>
    </main>
  );
}

// =========================================================
// PLACE INPUT
// =========================================================

function PlaceInput({
  icon,
  value,
  setValue,
  results,
  choose,
  green,
  onUseLocation,
  locating,
}) {
  return (
    <div className="placeWrap">
      <div
        className={`placeInput ${green ? "green" : ""}`}
        style={{ position: "relative" }}
      >
        {icon}

        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search place, road, suburb or address"
        />

        {onUseLocation && (
          <button
            type="button"
            onClick={onUseLocation}
            disabled={locating}
            title="Use my current location"
            aria-label="Use my current location"
            style={{
              border: "none",
              background: "transparent",
              cursor: locating ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "6px",
            }}
          >
            <LocateFixed
              size={20}
              className={locating ? "locationSpin" : ""}
            />
          </button>
        )}
      </div>

      {results.length > 0 && (
        <div className="suggestions">
          {results.map((location, index) => (
            <button
              type="button"
              key={`${location.name}-${location.lat}-${location.lng}-${index}`}
              onClick={() => choose(location)}
            >
              <MapPin size={15} />
              <span>{location.name}</span>
            </button>
          ))}
        </div>
      )}

      {onUseLocation && (
        <button
          type="button"
          onClick={onUseLocation}
          disabled={locating}
          className="useLocationButton"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "7px",
            width: "100%",
            marginTop: "7px",
            padding: "9px 12px",
            border: "1px solid #dfe6df",
            borderRadius: "10px",
            background: "#f7faf7",
            cursor: locating ? "wait" : "pointer",
          }}
        >
          <LocateFixed size={16} />
          {locating
            ? "Finding your location..."
            : "Use my current location"}
        </button>
      )}
    </div>
  );
}
