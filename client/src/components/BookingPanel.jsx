import { useState } from "react";
import { Banknote, CreditCard, Calculator, CheckCircle2 } from "lucide-react";
import api from "../services/api";

export default function BookingPanel({ pickup, destination, onBooked }) {
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [fare, setFare] = useState(null);
  const [loadingFare, setLoadingFare] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");

  const calculateFare = async () => {
    setError("");
    setFare(null);

    if (!pickup?.lat || !pickup?.lng) {
      setError("Please select a valid pickup location.");
      return;
    }

    if (!destination?.lat || !destination?.lng) {
      setError("Please select a valid destination.");
      return;
    }

    try {
      setLoadingFare(true);

      const response = await api.post("/rides/estimate", {
        pickup: {
          name: pickup.name,
          lat: Number(pickup.lat),
          lng: Number(pickup.lng),
        },
        destination: {
          name: destination.name,
          lat: Number(destination.lat),
          lng: Number(destination.lng),
        },
      });

      setFare(response.data);
    } catch (err) {
      console.error("FARE ERROR:", err);

      setError(
        err.response?.data?.message ||
          "Unable to calculate fare."
      );
    } finally {
      setLoadingFare(false);
    }
  };

  const confirmBooking = async () => {
    setError("");

    if (!fare) {
      setError("Please calculate the fare first.");
      return;
    }

    try {
      setBooking(true);

      const response = await api.post("/rides", {
        pickup: {
          name: pickup.name,
          lat: Number(pickup.lat),
          lng: Number(pickup.lng),
        },

        destination: {
          name: destination.name,
          lat: Number(destination.lat),
          lng: Number(destination.lng),
        },

        paymentMethod,
      });

      console.log("RIDE BOOKED:", response.data);

      if (onBooked) {
        onBooked(response.data.ride);
      }
    } catch (err) {
      console.error("BOOKING ERROR:", err);

      setError(
        err.response?.data?.message ||
          "Unable to book ride."
      );
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="bookingPanel">

      <h2>Book your Ride</h2>

      <p className="bookingSubtitle">
        Choose your payment method and calculate your fare.
      </p>

      {/* PAYMENT */}
      <div className="paymentSection">

        <h3>Payment method</h3>

        <div className="paymentOptions">

          <button
            type="button"
            className={`paymentOption ${
              paymentMethod === "cash" ? "active" : ""
            }`}
            onClick={() => setPaymentMethod("cash")}
          >
            <Banknote size={24} />

            <span>
              <strong>Cash</strong>
              <small>Pay the driver</small>
            </span>
          </button>

          <button
            type="button"
            className={`paymentOption ${
              paymentMethod === "card" ? "active" : ""
            }`}
            onClick={() => setPaymentMethod("card")}
          >
            <CreditCard size={24} />

            <span>
              <strong>Card</strong>
              <small>Pay electronically</small>
            </span>
          </button>

        </div>
      </div>

      {/* CALCULATE */}
      <button
        type="button"
        className="calculateFareButton"
        onClick={calculateFare}
        disabled={loadingFare}
      >
        <Calculator size={20} />

        {loadingFare
          ? "Calculating..."
          : "Calculate Fare"}
      </button>

      {/* ERROR */}
      {error && (
        <div className="bookingError">
          {error}
        </div>
      )}

      {/* FARE */}
      {fare && (
        <div className="fareCard">

          <div className="fareHeader">
            <div>
              <small>ESTIMATED FARE</small>
              <h2>
                R{Number(fare.fare).toFixed(2)}
              </h2>
            </div>

            {fare.isNightRate && (
              <span className="nightBadge">
                NIGHT ×2
              </span>
            )}
          </div>

          <div className="fareRows">

            <div>
              <span>Distance</span>
              <strong>
                {fare.distanceKm} km
              </strong>
            </div>

            <div>
              <span>Estimated time</span>
              <strong>
                {fare.durationMin} min
              </strong>
            </div>

            <div>
              <span>Base fare</span>
              <strong>
                R{Number(fare.baseFare).toFixed(2)}
              </strong>
            </div>

            <div>
              <span>
                Distance × R{fare.ratePerKm}
              </span>

              <strong>
                R{Number(fare.distanceFare).toFixed(2)}
              </strong>
            </div>

            {fare.isNightRate && (
              <div>
                <span>Night multiplier</span>
                <strong>×2</strong>
              </div>
            )}

          </div>

          <div className="fareTotal">
            <span>Total</span>

            <strong>
              R{Number(fare.fare).toFixed(2)}
            </strong>
          </div>

        </div>
      )}

      {/* BOOK */}
      <button
        type="button"
        className="confirmBookingButton"
        onClick={confirmBooking}
        disabled={!fare || booking}
      >
        <CheckCircle2 size={21} />

        {booking
          ? "Booking..."
          : "Confirm & Book Ride"}
      </button>

    </div>
  );
}