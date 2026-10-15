
import mongoose from "mongoose";
import { Router } from "express";

import User from "../models/User.js";
import Driver from "../models/Driver.js";
import Ride from "../models/Ride.js";

import { auth, role } from "../middleware/auth.js";

const r = Router();

r.use(auth, role("admin"));

/*
|--------------------------------------------------------------------------
| ACCOUNT DELETION HELPERS
|--------------------------------------------------------------------------
*/

const ACTIVE_RIDE_STATUSES = [
  "searching",
  "accepted",
  "arriving",
  "arrived",
  "in_progress",
];

const MAX_BULK_DELETE = 100;

async function deletePassengerAccount(userId) {
  if (!mongoose.isValidObjectId(userId)) {
    return {
      success: false,
      reason: "Invalid user ID.",
    };
  }

  const user = await User.findById(userId);

  if (!user) {
    return {
      success: false,
      reason: "User account not found.",
    };
  }

  if (user.role === "admin") {
    return {
      success: false,
      reason: "Admin accounts cannot be deleted here.",
    };
  }

  if (user.role === "driver") {
    return {
      success: false,
      reason: "Delete this account through the Drivers section.",
    };
  }

  if (user.role !== "passenger") {
    return {
      success: false,
      reason: "Only passenger accounts can be deleted here.",
    };
  }

  const activeRide = await Ride.exists({
    passenger: user._id,
    status: { $in: ACTIVE_RIDE_STATUSES },
  });

  if (activeRide) {
    return {
      success: false,
      reason: "This passenger has an active ride.",
    };
  }

  await User.deleteOne({
    _id: user._id,
    role: "passenger",
  });

  return {
    success: true,
    id: String(user._id),
    name: user.name,
  };
}

async function deleteDriverAccount(driverId, req) {
  if (!mongoose.isValidObjectId(driverId)) {
    return {
      success: false,
      reason: "Invalid driver ID.",
    };
  }

  const driver = await Driver.findById(driverId);

  if (!driver) {
    return {
      success: false,
      reason: "Driver profile not found.",
    };
  }

  const linkedUser = driver.user
    ? await User.findById(driver.user)
    : null;

  if (linkedUser?.role === "admin") {
    return {
      success: false,
      reason: "An admin account cannot be deleted as a driver.",
    };
  }

  const activeRide = await Ride.exists({
    driver: driver._id,
    status: { $in: ACTIVE_RIDE_STATUSES },
  });

  if (activeRide) {
    return {
      success: false,
      reason: "This driver has an active ride.",
    };
  }

  if (linkedUser && linkedUser.role !== "driver") {
    return {
      success: false,
      reason:
        "The linked user is not a driver account. The profile was not deleted.",
    };
  }

  const io = req?.app?.get("io");

  if (io) {
    io.emit("driver:presence", {
      driverId: String(driver._id),
      online: false,
      verified: false,
      applicationStatus: "deleted",
      location: null,
    });

    io.to("admins").emit("driver:deleted", {
      driverId: String(driver._id),
      userId: linkedUser
        ? String(linkedUser._id)
        : null,
    });
  }

  await Driver.deleteOne({
    _id: driver._id,
  });

  if (linkedUser) {
    await User.deleteOne({
      _id: linkedUser._id,
      role: "driver",
    });
  }

  return {
    success: true,
    id: String(driver._id),
    userId: linkedUser ? String(linkedUser._id) : null,
    name: linkedUser?.name || "Driver",
  };
}

async function bulkDeleteAccounts(ids, deleteAccount) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return {
      error: "Provide an array of account IDs to delete.",
    };
  }

  if (ids.length > MAX_BULK_DELETE) {
    return {
      error: `You can delete a maximum of ${MAX_BULK_DELETE} accounts per request.`,
    };
  }

  const uniqueIds = [
    ...new Set(
      ids
        .filter((id) => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean)
    ),
  ];

  if (uniqueIds.length === 0) {
    return {
      error: "No valid account IDs were provided.",
    };
  }

  const results = await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const result = await deleteAccount(id);

        return {
          id,
          ...result,
        };
      } catch (error) {
        console.error(
          "BULK ACCOUNT DELETION ERROR:",
          id,
          error
        );

        return {
          id,
          success: false,
          reason: "An unexpected error occurred.",
        };
      }
    })
  );

  return {
    deleted: results.filter((item) => item.success),
    skipped: results.filter((item) => !item.success),
  };
}

/*
|--------------------------------------------------------------------------
| DOCUMENT HELPERS
|--------------------------------------------------------------------------
*/

/*
 * Return an actual document path instead of Boolean.
 *
 * Supported formats:
 *
 * "/uploads/file.jpg"
 * "https://..."
 * { url: "..." }
 * { path: "..." }
 * { file: "..." }
 */

function getDocumentValue(...values) {
  for (const value of values) {
    if (!value) {
      continue;
    }

    // String document path
    if (typeof value === "string") {
      const cleaned = value.trim();

      if (cleaned.length > 0) {
        return cleaned;
      }
    }

    // Object document
    if (
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      const objectValue =
        value.url ||
        value.path ||
        value.file ||
        value.location ||
        "";

      if (
        typeof objectValue === "string" &&
        objectValue.trim().length > 0
      ) {
        return objectValue.trim();
      }
    }
  }

  return "";
}

/*
|--------------------------------------------------------------------------
| GET DRIVER DOCUMENTS
|--------------------------------------------------------------------------
|
| IMPORTANT:
| This returns the actual file paths.
| It does NOT return true/false.
|
|--------------------------------------------------------------------------
*/

function getDriverDocuments(driver) {
  const documentData =
    driver?.documents ||
    driver?.verificationDocuments ||
    {};

  return {
    // SOUTH AFRICAN ID
    idDocument: getDocumentValue(
      driver?.idDocument,
      driver?.identityDocument,
      documentData?.idDocument,
      documentData?.identityDocument
    ),

    // DRIVER LICENCE
    licenseDocument: getDocumentValue(
      driver?.licenseDocument,
      driver?.driverLicense,
      driver?.license,
      documentData?.licenseDocument,
      documentData?.driverLicense,
      documentData?.license,
      documentData?.driverLicenseDocument
    ),

    // VEHICLE REGISTRATION
    vehicleRegistration: getDocumentValue(
      driver?.vehicleRegistration,
      driver?.vehicleRegistrationDocument,
      driver?.registrationDocument,
      documentData?.vehicleRegistration,
      documentData?.vehicleRegistrationDocument,
      documentData?.registration,
      documentData?.registrationDocument
    ),

    // VEHICLE PROOF
    vehicleProof: getDocumentValue(
      driver?.vehicleProof,
      driver?.vehicleProofDocument,
      driver?.proofOfVehicle,
      documentData?.vehicleProof,
      documentData?.vehicleProofDocument,
      documentData?.proofOfVehicle,
      documentData?.proofOfOwnership,
      documentData?.vehicleOwnership
    ),
  };
}

/*
|--------------------------------------------------------------------------
| DOCUMENT COUNT
|--------------------------------------------------------------------------
*/

function getDocumentCount(driver) {
  const documents = getDriverDocuments(driver);

  return Object.values(documents).filter(Boolean).length;
}

/*
|--------------------------------------------------------------------------
| ALL DOCUMENTS COMPLETE
|--------------------------------------------------------------------------
*/

function isFullyDocumented(driver) {
  return getDocumentCount(driver) === 4;
}

/*
|--------------------------------------------------------------------------
| FORMAT DRIVER
|--------------------------------------------------------------------------
*/

function formatDriver(driver) {
  const documents = getDriverDocuments(driver);

  const documentCount =
    Object.values(documents).filter(Boolean).length;

  const data = driver.toObject();

  return {
    ...data,

    documents,

    idDocument: data.idDocument || "",
    licenseDocument: data.licenseDocument || "",
    vehicleRegistration: data.vehicleRegistration || "",
    vehicleProof: data.vehicleProof || "",

    documentCount,

    documentsComplete: documentCount === 4,

    verificationComplete:
      data.applicationStatus === "approved" &&
      data.verified === true &&
      documentCount === 4,
  };
}

/*
|--------------------------------------------------------------------------
| SOCKET EVENTS
|--------------------------------------------------------------------------
*/

function emitDriverUpdate(req, driver, message) {
  const io = req.app.get("io");

  if (!io) {
    return;
  }

  const driverId = String(driver._id);

  // Notify admin dashboard
  io.to("admins").emit("driver:verification", {
    driverId,
    applicationStatus: driver.applicationStatus,
    verified: driver.verified,
    online: driver.online,
    documents: getDriverDocuments(driver),
    documentCount: getDocumentCount(driver),
    documentsComplete: isFullyDocumented(driver),
    message,
  });

  // Notify driver
  if (driver.user) {
    io.to(`driver:${String(driver.user)}`).emit(
      "driver:verification",
      {
        driverId,
        applicationStatus: driver.applicationStatus,
        verified: driver.verified,
        online: driver.online,
        documents: getDriverDocuments(driver),
        documentCount: getDocumentCount(driver),
        documentsComplete: isFullyDocumented(driver),
        message,
      }
    );
  }

  // Global driver presence
  io.emit("driver:presence", {
    driverId,
    online: driver.online,
    verified: driver.verified,
    applicationStatus: driver.applicationStatus,
    location: driver.location,
  });
}

/*
|--------------------------------------------------------------------------
| STATS
|--------------------------------------------------------------------------
*/

r.get("/stats", async (_, res) => {
  try {
    const [
      users,
      drivers,
      rides,
      activeDrivers,
      completed,
      pending,
      revenue,
    ] = await Promise.all([
      User.countDocuments({ role: "passenger" }),

      Driver.countDocuments(),

      Ride.countDocuments(),

      Driver.countDocuments({
        online: true,
        applicationStatus: "approved",
        verified: true,
      }),

      Ride.countDocuments({ status: "completed" }),

      Driver.countDocuments({
        applicationStatus: "pending",
      }),

      Ride.aggregate([
        {
          $match: {
            status: "completed",
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $ifNull: ["$fare", 0],
              },
            },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      stats: {
        users,
        drivers,
        rides,
        activeDrivers,
        completed,
        pendingApprovals: pending,
        revenue: Number(revenue[0]?.total || 0),
      },
    });
  } catch (error) {
    console.error("ADMIN STATS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load admin statistics.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| USERS
|--------------------------------------------------------------------------
*/

r.get("/users", async (_, res) => {
  try {
    const users = await User.find()
      .select("-password -resetToken -resetExpires")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("ADMIN USERS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load users.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| DELETE PASSENGER ACCOUNTS
|--------------------------------------------------------------------------
*/

// Register /bulk before /:id.
r.delete("/users/bulk", async (req, res) => {
  try {
    const result = await bulkDeleteAccounts(
      req.body?.ids,
      (id) => deletePassengerAccount(id)
    );

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    res.json({
      success: true,
      message: `Deleted ${result.deleted.length} passenger account(s).`,
      deletedCount: result.deleted.length,
      skippedCount: result.skipped.length,
      deleted: result.deleted,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error("BULK PASSENGER DELETE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete passenger accounts.",
    });
  }
});

r.delete("/users/:id", async (req, res) => {
  try {
    const result = await deletePassengerAccount(req.params.id);

    if (!result.success) {
      return res.status(
        result.reason === "User account not found." ? 404 : 400
      ).json({
        success: false,
        message: result.reason,
      });
    }

    res.json({
      success: true,
      message: "Passenger account deleted successfully.",
      user: result,
    });
  } catch (error) {
    console.error("PASSENGER DELETE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete this passenger account.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| DRIVERS
|--------------------------------------------------------------------------
*/

r.get("/drivers", async (_, res) => {
  try {
    const drivers = await Driver.find()
      .populate("user", "name email phone role")
      .sort({ createdAt: -1 });

    const formattedDrivers = drivers.map((driver) => {
      const formatted = formatDriver(driver);

      console.log("\n================================");
      console.log("ADMIN DRIVER DOCUMENT DATA");
      console.log("DRIVER:", formatted.user?.name);
      console.log("DRIVER ID:", String(formatted._id));
      console.log("ID:", formatted.documents?.idDocument);
      console.log("LICENCE:", formatted.documents?.licenseDocument);
      console.log(
        "VEHICLE REGISTRATION:",
        formatted.documents?.vehicleRegistration
      );
      console.log("VEHICLE PROOF:", formatted.documents?.vehicleProof);
      console.log("DOCUMENT COUNT:", `${formatted.documentCount}/4`);
      console.log("COMPLETE:", formatted.documentsComplete);
      console.log("================================\n");

      return formatted;
    });

    res.json({
      success: true,
      drivers: formattedDrivers,
    });
  } catch (error) {
    console.error("ADMIN DRIVERS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load drivers.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| DELETE DRIVER ACCOUNTS
|--------------------------------------------------------------------------
*/

// Delete selected driver profiles and linked driver accounts.
r.delete("/drivers/bulk", async (req, res) => {
  try {
    const result = await bulkDeleteAccounts(
      req.body?.ids,
      (id) => deleteDriverAccount(id, req)
    );

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    res.json({
      success: true,
      message: `Deleted ${result.deleted.length} driver account(s).`,
      deletedCount: result.deleted.length,
      skippedCount: result.skipped.length,
      deleted: result.deleted,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error("BULK DRIVER DELETE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete driver accounts.",
    });
  }
});

// Delete one driver profile and its associated driver account.
r.delete("/drivers/:id", async (req, res) => {
  try {
    const result = await deleteDriverAccount(req.params.id, req);

    if (!result.success) {
      return res.status(
        result.reason === "Driver profile not found." ? 404 : 400
      ).json({
        success: false,
        message: result.reason,
      });
    }

    res.json({
      success: true,
      message: "Driver account deleted successfully.",
      driver: result,
    });
  } catch (error) {
    console.error("DRIVER DELETE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete this driver account.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET SINGLE DRIVER
|--------------------------------------------------------------------------
*/

r.get("/drivers/:id", async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id).populate(
      "user",
      "name email phone role"
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found.",
      });
    }

    res.json({
      success: true,
      driver: formatDriver(driver),
    });
  } catch (error) {
    console.error("ADMIN DRIVER DETAILS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load driver details.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| APPROVE DRIVER
|--------------------------------------------------------------------------
*/

r.patch("/drivers/:id/approve", async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found.",
      });
    }

    const documents = getDriverDocuments(driver);
    const documentCount = getDocumentCount(driver);

    console.log("\n================================");
    console.log("ADMIN APPROVE DRIVER");
    console.log("DRIVER ID:", String(driver._id));
    console.log("DOCUMENT STATUS:", documents);
    console.log(`DOCUMENT COUNT: ${documentCount}/4`);
    console.log("================================\n");

    if (!isFullyDocumented(driver)) {
      return res.status(400).json({
        success: false,
        message:
          "Driver cannot be approved until all 4 required documents are uploaded.",
        documentCount,
        documents,
        documentsComplete: false,
      });
    }

    driver.applicationStatus = "approved";
    driver.verified = true;
    driver.online = false;

    await driver.save();

    const updatedDriver = await Driver.findById(
      driver._id
    ).populate("user", "name email phone role");

    emitDriverUpdate(
      req,
      updatedDriver,
      "Your RideFlow driver application has been approved."
    );

    res.json({
      success: true,
      message: "Driver approved successfully.",
      driver: formatDriver(updatedDriver),
      documentCount,
      documents: getDriverDocuments(updatedDriver),
      documentsComplete: true,
      verificationComplete: true,
    });
  } catch (error) {
    console.error("APPROVE DRIVER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to approve driver.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| REJECT DRIVER
|--------------------------------------------------------------------------
*/

r.patch("/drivers/:id/reject", async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found.",
      });
    }

    driver.applicationStatus = "rejected";
    driver.verified = false;
    driver.online = false;

    await driver.save();

    const updatedDriver = await Driver.findById(
      driver._id
    ).populate("user", "name email phone role");

    emitDriverUpdate(
      req,
      updatedDriver,
      "Your RideFlow driver application has been rejected."
    );

    res.json({
      success: true,
      message: "Driver application rejected.",
      driver: formatDriver(updatedDriver),
    });
  } catch (error) {
    console.error("REJECT DRIVER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to reject driver.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GENERAL DRIVER STATUS
|--------------------------------------------------------------------------
*/

r.patch("/drivers/:id/status", async (req, res) => {
  try {
    console.log("\n================================");
    console.log("ADMIN DRIVER STATUS UPDATE");
    console.log("DRIVER ID:", req.params.id);
    console.log("BODY:", req.body);
    console.log("================================");

    const allowedStatuses = [
      "approved",
      "rejected",
      "suspended",
      "pending",
    ];

    const status =
      typeof req.body?.status === "string"
        ? req.body.status.trim().toLowerCase()
        : "";

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid driver status. Use approved, rejected, suspended or pending.",
        receivedStatus: req.body?.status || null,
        allowedStatuses,
      });
    }

    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found.",
      });
    }

    const documents = getDriverDocuments(driver);
    const documentCount = getDocumentCount(driver);
    const documentsComplete = documentCount === 4;

    console.log("DOCUMENT STATUS:", documents);
    console.log(`DOCUMENT COUNT: ${documentCount}/4`);
    console.log("COMPLETE:", documentsComplete);

    if (status === "approved" && !documentsComplete) {
      return res.status(400).json({
        success: false,
        message:
          "Driver cannot be approved until all 4 required documents are uploaded.",
        documentCount,
        documents,
        documentsComplete: false,
      });
    }

    driver.applicationStatus = status;

    if (status === "approved") {
      driver.verified = true;
      driver.online = false;
    } else {
      driver.verified = false;
      driver.online = false;
    }

    await driver.save();

    const updatedDriver = await Driver.findById(
      driver._id
    ).populate("user", "name email phone role");

    emitDriverUpdate(
      req,
      updatedDriver,
      `Driver application ${status}.`
    );

    console.log("\nDRIVER STATUS UPDATED");
    console.log("STATUS:", updatedDriver.applicationStatus);
    console.log("VERIFIED:", updatedDriver.verified);
    console.log("ONLINE:", updatedDriver.online);
    console.log("================================\n");

    res.json({
      success: true,
      message: `Driver application ${status} successfully.`,
      driver: formatDriver(updatedDriver),
      documents: getDriverDocuments(updatedDriver),
      documentCount: getDocumentCount(updatedDriver),
      documentsComplete: isFullyDocumented(updatedDriver),
      verificationComplete:
        updatedDriver.applicationStatus === "approved" &&
        updatedDriver.verified === true &&
        isFullyDocumented(updatedDriver),
    });
  } catch (error) {
    console.error("DRIVER STATUS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update driver status.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| SUSPEND DRIVER
|--------------------------------------------------------------------------
*/

r.patch("/drivers/:id/suspend", async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found.",
      });
    }

    driver.applicationStatus = "suspended";
    driver.verified = false;
    driver.online = false;

    await driver.save();

    const updatedDriver = await Driver.findById(
      driver._id
    ).populate("user", "name email phone role");

    emitDriverUpdate(
      req,
      updatedDriver,
      "Your RideFlow driver account has been suspended."
    );

    res.json({
      success: true,
      message: "Driver suspended successfully.",
      driver: formatDriver(updatedDriver),
    });
  } catch (error) {
    console.error("SUSPEND DRIVER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to suspend driver.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| RIDES
|--------------------------------------------------------------------------
*/

r.get("/rides", async (_, res) => {
  try {
    const rides = await Ride.find()
      .populate("passenger", "name email phone")
      .populate({
        path: "driver",
        populate: {
          path: "user",
          select: "name phone email",
        },
      })
      .sort({ createdAt: -1 })
      .limit(250);

    res.json({
      success: true,
      rides,
    });
  } catch (error) {
    console.error("ADMIN RIDES ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load rides.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| DASHBOARD OVERVIEW
|--------------------------------------------------------------------------
*/

r.get("/overview", async (_, res) => {
  try {
    const [
      users,
      drivers,
      rides,
      pendingDrivers,
      approvedDrivers,
      onlineDrivers,
      completedRides,
      cancelledRides,
      revenue,
    ] = await Promise.all([
      User.countDocuments({ role: "passenger" }),

      Driver.countDocuments(),

      Ride.countDocuments(),

      Driver.countDocuments({
        applicationStatus: "pending",
      }),

      Driver.countDocuments({
        applicationStatus: "approved",
        verified: true,
      }),

      Driver.countDocuments({
        applicationStatus: "approved",
        verified: true,
        online: true,
      }),

      Ride.countDocuments({ status: "completed" }),

      Ride.countDocuments({ status: "cancelled" }),

      Ride.aggregate([
        {
          $match: {
            status: "completed",
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $ifNull: ["$fare", 0],
              },
            },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      overview: {
        users,
        drivers,
        rides,
        pendingDrivers,
        approvedDrivers,
        onlineDrivers,
        completedRides,
        cancelledRides,
        revenue: Number(revenue[0]?.total || 0),
      },
    });
  } catch (error) {
    console.error("ADMIN OVERVIEW ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load dashboard overview.",
    });
  }
});

export default r;
