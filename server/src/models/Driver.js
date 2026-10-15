import mongoose from "mongoose";

const DriverSchema = new mongoose.Schema(
  {
    // ==========================================
    // USER ACCOUNT
    // ==========================================
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // ==========================================
    // VEHICLE INFORMATION
    // ==========================================
    vehicleMake: {
      type: String,
      default: "",
      trim: true,
    },

    vehicleModel: {
      type: String,
      default: "",
      trim: true,
    },

    vehicleColor: {
      type: String,
      default: "",
      trim: true,
    },

    registration: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },

    licenseNumber: {
      type: String,
      default: "",
      trim: true,
    },

    // ==========================================
    // DRIVER VERIFICATION DOCUMENTS
    // ==========================================
    // These fields store the actual uploaded
    // file paths, NOT true/false values.
    //
    // Example:
    // /uploads/1790258960887-id.pdf
    // ==========================================

    idDocument: {
      type: String,
      default: "",
      trim: true,
    },

    licenseDocument: {
      type: String,
      default: "",
      trim: true,
    },

    vehicleRegistration: {
      type: String,
      default: "",
      trim: true,
    },

    vehicleProof: {
      type: String,
      default: "",
      trim: true,
    },

    // ==========================================
    // APPLICATION / VERIFICATION STATUS
    // ==========================================
    applicationStatus: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "suspended",
      ],
      default: "pending",
      index: true,
    },

    verified: {
      type: Boolean,
      default: false,
    },

    // ==========================================
    // DRIVER ONLINE STATUS
    // ==========================================
    online: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ==========================================
    // DRIVER LOCATION
    // ==========================================
    location: {
      lat: {
        type: Number,
        default: -25.7479,
      },

      lng: {
        type: Number,
        default: 28.2293,
      },
    },

    // ==========================================
    // RATINGS
    // ==========================================
    rating: {
      type: Number,
      default: 5,
      min: 0,
      max: 5,
    },

    totalRatings: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==========================================
    // EARNINGS
    // ==========================================
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==========================================
    // DRIVER SETTINGS
    // ==========================================
    settings: {
      notifications: {
        rideRequests: {
          type: Boolean,
          default: true,
        },

        earnings: {
          type: Boolean,
          default: true,
        },

        account: {
          type: Boolean,
          default: true,
        },
      },

      privacy: {
        locationSharing: {
          type: Boolean,
          default: true,
        },
      },

      paymentMethod: {
        type: String,
        enum: ["cash", "online"],
        default: "cash",
      },
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================
// INDEXES
// ==========================================

DriverSchema.index({
  online: 1,
  applicationStatus: 1,
});

DriverSchema.index({
  "location.lat": 1,
  "location.lng": 1,
});

// ==========================================
// PREVENT MONGOOSE OverwriteModelError
// ==========================================
//
// This is important because your server currently
// reported:
//
// OverwriteModelError: Cannot overwrite `Driver`
// model once compiled.
//
// Never create Driver again inside drivers.js.
// Import this model instead.
//

const Driver =
  mongoose.models.Driver ||
  mongoose.model("Driver", DriverSchema);

export default Driver;