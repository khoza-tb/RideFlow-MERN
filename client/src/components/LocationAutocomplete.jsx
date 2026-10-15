import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Car,
  CheckCircle2,
  Clock3,
  MapPin,
  ShieldCheck,
  Star,
  Users,
  Zap,
} from "lucide-react";

import api from "../services/api";
import LocationAutocomplete from "../components/LocationAutocomplete";

export default function Home() {
  const navigate = useNavigate();

  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);

  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // =========================================================
  // FIND NEARBY DRIVERS
  // =========================================================

  async function findNearby() {
    setError("");
    setResults(null);

    if (!pickup?.lat || !pickup?.lng) {
      setError("Please select a pickup location from the suggestions.");
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.get("/drivers/nearby", {
        params: {
          lat: pickup.lat,
          lng: pickup.lng,
          limit: 3,
        },
      });

      const drivers = Array.isArray(data)
        ? data
        : data?.drivers || [];

      setResults(drivers);
    } catch (err) {
      console.error("NEARBY DRIVER ERROR:", err);

      setError(
        err.response?.data?.message ||
          "Could not load nearby drivers. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // CONTINUE TO SIGNUP
  // =========================================================

  function continueToSignup() {
    if (pickup) {
      sessionStorage.setItem(
        "rf_pending_pickup",
        JSON.stringify(pickup)
      );
    }

    if (destination) {
      sessionStorage.setItem(
        "rf_pending_destination",
        JSON.stringify(destination)
      );
    }

    navigate("/access?role=passenger&mode=signup");
  }

  // =========================================================
  // PICKUP SELECT
  // =========================================================

  function handlePickupSelect(location) {
    setPickup(location);
    setResults(null);
    setError("");
  }

  // =========================================================
  // DESTINATION SELECT
  // =========================================================

  function handleDestinationSelect(location) {
    setDestination(location);
    setError("");
  }

  return (
    <main>
      {/* =====================================================
          HERO
      ====================================================== */}

      <section className="hero-modern">
        <div className="hero-glow glow-one" />
        <div className="hero-glow glow-two" />

        <div className="hero-content">
          <div className="eyebrow">
            <span className="live-dot" />
            RideFlow is moving
          </div>

          <h1>
            Your city.
            <br />
            <span>Your ride.</span>
            <br />
            Your way.
          </h1>

          <p className="hero-description">
            Fast, reliable rides whenever you need them. Book a trip,
            track your driver and get where you're going without the
            unnecessary hassle.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="hero-primary"
              onClick={() =>
                navigate("/access?role=passenger&mode=signup")
              }
            >
              Book a ride
              <ArrowRight size={18} />
            </button>

            <button
              type="button"
              className="hero-secondary"
              onClick={() =>
                navigate("/access?role=driver&mode=signup")
              }
            >
              Become a driver
            </button>
          </div>

          <div className="hero-trust">
            <div>
              <CheckCircle2 size={16} />
              Verified drivers
            </div>

            <div>
              <ShieldCheck size={16} />
              Secure accounts
            </div>

            <div>
              <Clock3 size={16} />
              Available when you need it
            </div>
          </div>
        </div>

        {/* ===================================================
            BOOKING CARD
        ==================================================== */}

        <div className="booking-card">
          <div className="booking-top">
            <div>
              <span className="booking-label">
                RIDEFLOW
              </span>

              <h2>Where are you going?</h2>
            </div>

            <div className="booking-icon">
              <Car size={22} />
            </div>
          </div>

          {/* =================================================
              ROUTE INPUTS
          ================================================== */}

          <div className="route-input">
            <div className="route-line">
              <span className="route-dot pickup" />
              <span className="route-track" />
              <span className="route-dot destination" />
            </div>

            <div className="route-fields">

              {/* PICKUP */}

              <LocationAutocomplete
                label="Pickup location"
                placeholder="Search anywhere in South Africa"
                value={pickup}
                onSelect={handlePickupSelect}
              />

              <div className="route-divider" />

              {/* DESTINATION */}

              <LocationAutocomplete
                label="Destination"
                placeholder="Where are you going?"
                value={destination}
                onSelect={handleDestinationSelect}
              />

            </div>
          </div>

          {/* =================================================
              SELECTED ROUTE
          ================================================== */}

          {(pickup || destination) && (
            <div className="selected-route">

              {pickup && (
                <div className="selected-location">
                  <div className="selected-location-icon pickup-icon">
                    <MapPin size={15} />
                  </div>

                  <div>
                    <span>Pickup</span>
                    <strong>{pickup.name}</strong>
                  </div>
                </div>
              )}

              {pickup && destination && (
                <div className="selected-route-line" />
              )}

              {destination && (
                <div className="selected-location">
                  <div className="selected-location-icon destination-icon">
                    <MapPin size={15} />
                  </div>

                  <div>
                    <span>Destination</span>
                    <strong>{destination.name}</strong>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* =================================================
              FIND BUTTON
          ================================================== */}

          <button
            type="button"
            className="find-button"
            onClick={findNearby}
            disabled={loading || !pickup?.lat}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Finding drivers...
              </>
            ) : (
              <>
                Find nearby drivers
                <ArrowRight size={17} />
              </>
            )}
          </button>

          {/* =================================================
              ERROR
          ================================================== */}

          {error && (
            <div className="home-message error-message">
              <MapPin size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* =================================================
              NO DRIVERS
          ================================================== */}

          {results && results.length === 0 && (
            <div className="home-message">
              <MapPin size={18} />

              <span>
                No drivers are currently online near this
                location.
              </span>
            </div>
          )}

          {/* =================================================
              DRIVER RESULTS
          ================================================== */}

          {results && results.length > 0 && (
            <div className="driver-results">

              <div className="results-heading">
                <span>Drivers nearby</span>

                <span>
                  {results.length} available
                </span>
              </div>

              {results.map((driver, index) => {
                const driverId =
                  driver.id ||
                  driver._id ||
                  `driver-${index}`;

                const driverName =
                  driver.name ||
                  driver.user?.name ||
                  driver.fullName ||
                  "RideFlow Driver";

                const vehicle =
                  driver.vehicle ||
                  driver.vehicleType ||
                  driver.car ||
                  "Vehicle";

                const rating =
                  driver.rating ??
                  driver.user?.rating ??
                  "5.0";

                const eta =
                  driver.etaMin ??
                  driver.eta ??
                  5;

                const km =
                  driver.km ??
                  driver.distanceKm ??
                  driver.distance ??
                  null;

                return (
                  <div
                    className="driver-result"
                    key={driverId}
                  >
                    <div className="driver-avatar">
                      {driverName
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="driver-info">
                      <strong>
                        {driverName}
                      </strong>

                      <span>
                        {vehicle}
                        {" · "}
                        <Star
                          size={12}
                          fill="currentColor"
                        />
                        {" "}
                        {rating}
                      </span>
                    </div>

                    <div className="driver-eta">
                      <strong>
                        {eta} min
                      </strong>

                      <span>
                        {typeof km === "number"
                          ? `${km.toFixed(1)} km`
                          : "Nearby"}
                      </span>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                className="signup-book-button"
                onClick={continueToSignup}
              >
                Sign up to book this ride
                <ArrowRight size={16} />
              </button>

            </div>
          )}
        </div>
      </section>

      {/* =====================================================
          STATS
      ====================================================== */}

      <section className="stats-section">
        <div className="stats-grid">

          <div className="stat-item">
            <div className="stat-icon">
              <Users size={20} />
            </div>

            <div>
              <strong>3</strong>
              <span>Platform roles</span>
            </div>
          </div>

          <div className="stat-item">
            <div className="stat-icon">
              <Zap size={20} />
            </div>

            <div>
              <strong>24/7</strong>
              <span>Ride availability</span>
            </div>
          </div>

          <div className="stat-item">
            <div className="stat-icon">
              <ShieldCheck size={20} />
            </div>

            <div>
              <strong>Secure</strong>
              <span>Account protection</span>
            </div>
          </div>

          <div className="stat-item">
            <div className="stat-icon">
              <Car size={20} />
            </div>

            <div>
              <strong>4+</strong>
              <span>Ride categories</span>
            </div>
          </div>

        </div>
      </section>

      {/* =====================================================
          RIDE TYPES
      ====================================================== */}

      <section className="ride-types">

        <div className="section-heading">

          <div>
            <span className="section-kicker">
              Choose your ride
            </span>

            <h2>
              There's a RideFlow for every trip.
            </h2>
          </div>

          <p>
            Whether you're heading across town or travelling
            with friends, choose the ride that fits your
            journey.
          </p>

        </div>

        <div className="ride-type-grid">

          <div className="ride-type-card">

            <div className="ride-card-top">
              <div className="ride-type-icon">
                <Car size={24} />
              </div>
            </div>

            <h3>Economy</h3>

            <p>
              Affordable everyday rides for getting around
              the city.
            </p>

            <div className="ride-card-footer">
              <span>Everyday</span>
              <ArrowRight size={16} />
            </div>

          </div>

          <div className="ride-type-card featured">

            <div className="ride-card-top">
              <div className="ride-type-icon">
                <Car size={24} />
              </div>
            </div>

            <h3>Comfort</h3>

            <p>
              Extra comfort when you want a little more from
              your ride.
            </p>

            <div className="ride-card-footer">
              <span>Popular</span>
              <ArrowRight size={16} />
            </div>

          </div>

          <div className="ride-type-card">

            <div className="ride-card-top">
              <div className="ride-type-icon">
                <Users size={24} />
              </div>
            </div>

            <h3>XL</h3>

            <p>
              More space for groups, luggage and bigger
              journeys.
            </p>

            <div className="ride-card-footer">
              <span>Group travel</span>
              <ArrowRight size={16} />
            </div>

          </div>

          <div className="ride-type-card">

            <div className="ride-card-top">
              <div className="ride-type-icon">
                <Star size={24} />
              </div>
            </div>

            <h3>Premium</h3>

            <p>
              A refined ride experience for important
              journeys.
            </p>

            <div className="ride-card-footer">
              <span>Premium</span>
              <ArrowRight size={16} />
            </div>

          </div>

        </div>
      </section>

      {/* =====================================================
          ABOUT
      ====================================================== */}

      <section
        className="about-modern"
        id="about"
      >

        <div className="about-heading">

          <span className="section-kicker">
            One platform
          </span>

          <h2>
            Built around the people who keep the city moving.
          </h2>

          <p>
            RideFlow brings passengers, drivers and platform
            administrators together in one connected
            ecosystem.
          </p>

        </div>

        <div className="role-grid">

          <div className="role-card passenger-card">

            <div className="role-card-icon">
              <Users size={22} />
            </div>

            <h3>Passenger</h3>

            <p>
              Find a ride, follow your driver's journey and
              manage everything from one account.
            </p>

            <ul>
              <li>Book rides</li>
              <li>Track drivers</li>
              <li>Ride history</li>
              <li>Ratings & profile</li>
            </ul>

          </div>

          <div className="role-card driver-card">

            <div className="role-card-icon">
              <Car size={22} />
            </div>

            <h3>Driver</h3>

            <p>
              Take control of your schedule, accept trips and
              keep track of your earnings.
            </p>

            <ul>
              <li>Accept rides</li>
              <li>Manage availability</li>
              <li>Track earnings</li>
              <li>Ride history</li>
            </ul>

          </div>

          <div className="role-card admin-card">

            <div className="role-card-icon">
              <ShieldCheck size={22} />
            </div>

            <h3>Admin</h3>

            <p>
              Keep the platform running with powerful
              management and operational tools.
            </p>

            <ul>
              <li>Manage users</li>
              <li>Approve drivers</li>
              <li>Monitor rides</li>
              <li>Platform reports</li>
            </ul>

          </div>

        </div>
      </section>

      {/* =====================================================
          CTA
      ====================================================== */}

      <section className="final-cta">

        <div>
          <span className="section-kicker">
            Ready when you are
          </span>

          <h2>
            Let's get you moving.
          </h2>

          <p>
            Create your RideFlow account and start your
            journey today.
          </p>
        </div>

        <div className="final-cta-actions">

          <button
            type="button"
            className="hero-primary"
            onClick={() =>
              navigate(
                "/access?role=passenger&mode=signup"
              )
            }
          >
            Get started
            <ArrowRight size={18} />
          </button>

          <button
            type="button"
            className="hero-secondary"
            onClick={() =>
              navigate(
                "/access?role=driver&mode=signup"
              )
            }
          >
            Drive with RideFlow
          </button>

        </div>

      </section>

      {/* =====================================================
          FOOTER
      ====================================================== */}

      <footer className="site-modern">

        <button
          type="button"
          className="brand footer-brand"
          onClick={() => navigate("/")}
        >
          <span className="brand-mark">
            <span />
            <span />
          </span>

          RideFlow
        </button>

        <span>
          RideFlow platform · Built for passengers, drivers and
          administrators.
        </span>

      </footer>

    </main>
  );
}