
import mongoose from "mongoose";

const place = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    lat: {
      type: Number,
      required: true,
    },

    lng: {
      type: Number,
      required: true,
    },
  },
  {
    _id: false,
  }
);

const driverLocation = new mongoose.Schema(
  {
    lat: {
      type: Number,
    },

    lng: {
      type: Number,
    },

    updatedAt: {
      type: Date,
    },
  },
  {
    _id: false,
  }
);

const schema = new mongoose.Schema(
  {
    // ==============================
    // PASSENGER
    // ==============================

    passenger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ==============================
    // DRIVER
    // ==============================

    /*
     * This references the Driver document.
     *
     * Driver document should contain:
     *
     * user
     * vehicleMake
     * vehicleModel
     * vehicleColor
     * registration
     * licenseNumber
     * rating
     * location
     *
     * The Driver.user field references the User
     * document containing the driver's name,
     * phone and profile photo.
     */

    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
      index: true,
    },

    // ==============================
    // LOCATIONS
    // ==============================

    pickup: {
      type: place,
      required: true,
    },

    destination: {
      type: place,
      required: true,
    },

    // ==============================
    // TRIP INFORMATION
    // ==============================

    distanceKm: {
      type: Number,
      default: 0,
      min: 0,
    },

    durationMin: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==============================
    // FARE INFORMATION
    // ==============================

    baseFare: {
      type: Number,
      default: 25,
      min: 0,
    },

    ratePerKm: {
      type: Number,
      default: 25,
      min: 0,
    },

    distanceFare: {
      type: Number,
      default: 0,
      min: 0,
    },

    normalFare: {
      type: Number,
      default: 0,
      min: 0,
    },

    nightMultiplier: {
      type: Number,
      default: 1,
      min: 1,
    },

    fare: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==============================
    // PAYMENT
    // ==============================

    paymentMethod: {
      type: String,
      enum: ["cash", "card"],
      default: "cash",
    },

    // ==============================
    // RIDE STATUS
    // ==============================

    status: {
      type: String,
      enum: [
        "searching",
        "accepted",
        "arriving",
        "arrived",
        "in_progress",
        "completed",
        "cancelled",
      ],
      default: "searching",
      index: true,
    },

    // ==============================
    // LIVE DRIVER LOCATION
    // ==============================

    driverLocation: {
      type: driverLocation,
      default: null,
    },

    // ==============================
    // RATING
    // ==============================

    rated: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================================
// INDEXES
// ==========================================================
//
// These make finding passenger/driver rides faster,
// especially for active ride checks.
// ==========================================================

schema.index({
  passenger: 1,
  status: 1,
  createdAt: -1,
});

schema.index({
  driver: 1,
  status: 1,
  createdAt: -1,
});

export default mongoose.model("Ride", schema);

