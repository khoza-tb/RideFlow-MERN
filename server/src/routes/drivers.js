import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import Driver from "../models/Driver.js";
import Ride from "../models/Ride.js";
import User from "../models/User.js";

import { auth, role } from "../middleware/auth.js";

const r = Router();

/*
|--------------------------------------------------------------------------
| UPLOAD CONFIGURATION
|--------------------------------------------------------------------------
*/

const uploadDirectory = path.resolve("uploads");

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (_, file, cb) => {
    const extension = path.extname(
      file.originalname
    );

    const safeName = path
      .basename(
        file.originalname,
        extension
      )
      .replace(
        /[^a-zA-Z0-9-_]/g,
        "-"
      )
      .toLowerCase();

    cb(
      null,
      `${Date.now()}-${safeName}${extension}`
    );
  },
});

/*
|--------------------------------------------------------------------------
| ACCEPTED FILE TYPES
|--------------------------------------------------------------------------
*/

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (_, file, cb) => {
    if (
      allowedMimeTypes.includes(
        file.mimetype
      )
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only JPG, PNG, WEBP and PDF files are allowed."
        )
      );
    }
  },
});

/*
|--------------------------------------------------------------------------
| DOCUMENT HELPERS
|--------------------------------------------------------------------------
*/

/*
 * Get the actual stored document path.
 *
 * This supports the current Driver model as well as
 * older document structures.
 */
function getDocumentPath(...values) {
  for (const value of values) {
    if (!value) continue;

    if (typeof value === "string") {
      const clean = value.trim();

      if (clean) {
        return clean;
      }
    }

    if (typeof value === "object") {
      const nested =
        value.url ||
        value.path ||
        value.file ||
        value.location;

      if (
        typeof nested === "string" &&
        nested.trim()
      ) {
        return nested.trim();
      }
    }
  }

  return "";
}

/*
 * Return the ACTUAL four document paths.
 *
 * IMPORTANT:
 * Do NOT convert these into Boolean values.
 */
function getDriverDocumentPaths(driver) {
  const documentData =
    driver?.documents ||
    driver?.verificationDocuments ||
    {};

  return {
    idDocument: getDocumentPath(
      driver?.idDocument,
      driver?.identityDocument,
      documentData?.idDocument,
      documentData?.identityDocument
    ),

    licenseDocument: getDocumentPath(
      driver?.licenseDocument,
      driver?.driverLicense,
      driver?.license,
      documentData?.licenseDocument,
      documentData?.driverLicense,
      documentData?.license,
      documentData?.driverLicenseDocument
    ),

    vehicleRegistration: getDocumentPath(
      driver?.vehicleRegistration,
      driver?.vehicleRegistrationDocument,
      driver?.registrationDocument,
      documentData?.vehicleRegistration,
      documentData?.vehicleRegistrationDocument,
      documentData?.registration,
      documentData?.registrationDocument
    ),

    vehicleProof: getDocumentPath(
      driver?.vehicleProof,
      driver?.vehicleProofDocument,
      driver?.proofOfVehicle,
      documentData?.vehicleProof,
      documentData?.vehicleProofDocument,
      documentData?.proofOfVehicle
    ),
  };
}

/*
|--------------------------------------------------------------------------
| DOCUMENT STATUS
|--------------------------------------------------------------------------
*/

function getDriverDocuments(driver) {
  const paths =
    getDriverDocumentPaths(driver);

  return {
    idDocument: Boolean(
      paths.idDocument
    ),

    licenseDocument: Boolean(
      paths.licenseDocument
    ),

    vehicleRegistration: Boolean(
      paths.vehicleRegistration
    ),

    vehicleProof: Boolean(
      paths.vehicleProof
    ),
  };
}

function getDocumentCount(driver) {
  const documents =
    getDriverDocuments(driver);

  return Object.values(
    documents
  ).filter(Boolean).length;
}

function documentsComplete(driver) {
  return (
    getDocumentCount(driver) === 4
  );
}

/*
|--------------------------------------------------------------------------
| FORMAT DRIVER
|--------------------------------------------------------------------------
|
| Returns both:
|
| documents
|   -> actual paths
|
| documentStatus
|   -> true/false status
|
| This gives the Admin Dashboard everything it needs.
|--------------------------------------------------------------------------
*/

function formatDriver(driver) {
  const documentPaths =
    getDriverDocumentPaths(driver);

  const documentStatus =
    getDriverDocuments(driver);

  const documentCount =
    Object.values(
      documentStatus
    ).filter(Boolean).length;

  return {
    ...driver.toObject(),

    /*
     * ACTUAL DOCUMENT PATHS
     */
    documents: documentPaths,

    /*
     * BOOLEAN DOCUMENT STATUS
     */
    documentStatus,

    /*
     * DOCUMENT COUNT
     */
    documentCount,

    /*
     * COMPLETE
     */
    documentsComplete:
      documentCount === 4,

    /*
     * FULL VERIFICATION
     */
    verificationComplete:
      driver.applicationStatus ===
        "approved" &&
      driver.verified === true &&
      documentCount === 4,
  };
}

/*
|--------------------------------------------------------------------------
| SOCKET EVENTS
|--------------------------------------------------------------------------
*/

function emitDriverUpdate(
  req,
  driver,
  message
) {
  const io =
    req.app.get("io");

  if (!io) return;

  const driverId =
    String(driver._id);

  /*
   * Notify admin dashboard
   */
  io.to("admins").emit(
    "driver:verification",
    {
      driverId,

      applicationStatus:
        driver.applicationStatus,

      verified:
        driver.verified,

      online:
        driver.online,

      documentCount:
        getDocumentCount(driver),

      documentsComplete:
        documentsComplete(driver),

      documents:
        getDriverDocumentPaths(
          driver
        ),

      message,
    }
  );

  /*
   * Notify driver
   */
  if (driver.user) {
    io.to(
      `driver:${String(
        driver.user
      )}`
    ).emit(
      "driver:verification",
      {
        driverId,

        applicationStatus:
          driver.applicationStatus,

        verified:
          driver.verified,

        online:
          driver.online,

        documentCount:
          getDocumentCount(driver),

        documentsComplete:
          documentsComplete(driver),

        documents:
          getDriverDocumentPaths(
            driver
          ),

        message,
      }
    );
  }

  /*
   * Global driver presence
   */
  io.emit(
    "driver:presence",
    {
      driverId,

      online:
        driver.online,

      verified:
        driver.verified,

      applicationStatus:
        driver.applicationStatus,

      location:
        driver.location,
    }
  );
}

/*
|--------------------------------------------------------------------------
| GET NEARBY DRIVERS
|--------------------------------------------------------------------------
*/

r.get(
  "/nearby",
  async (_, res) => {
    try {
      const drivers =
        await Driver.find({
          online: true,
          applicationStatus:
            "approved",
          verified: true,
        }).populate(
          "user",
          "name phone email"
        );

      res.json({
        success: true,
        drivers,
      });
    } catch (error) {
      console.error(
        "Nearby drivers error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to load nearby drivers.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET DRIVER PROFILE
|--------------------------------------------------------------------------
*/

r.get(
  "/profile",
  auth,
  role("driver"),
  async (req, res) => {
    try {
      const driver =
        await Driver.findOne({
          user: req.user.id,
        }).populate(
          "user",
          "name email phone"
        );

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver profile not found.",
        });
      }

      const documents =
        getDriverDocuments(driver);

      const documentPaths =
        getDriverDocumentPaths(
          driver
        );

      const documentCount =
        Object.values(
          documents
        ).filter(Boolean).length;

      res.json({
        success: true,

        driver,

        /*
         * ACTUAL PATHS
         */
        documents:
          documentPaths,

        /*
         * BOOLEAN STATUS
         */
        documentStatus:
          documents,

        documentCount,

        documentsComplete:
          documentCount === 4,
      });
    } catch (error) {
      console.error(
        "Driver profile error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to load driver profile.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| DRIVER VERIFICATION
|--------------------------------------------------------------------------
*/

r.patch(
  "/verification",
  auth,
  role("driver"),

  upload.fields([
    {
      name: "idDocument",
      maxCount: 1,
    },

    {
      name: "driverLicense",
      maxCount: 1,
    },

    {
      name: "licenseDocument",
      maxCount: 1,
    },

    {
      name: "vehicleRegistration",
      maxCount: 1,
    },

    {
      name: "vehicleProof",
      maxCount: 1,
    },
  ]),

  async (req, res) => {
    try {
      console.log(
        "\n================================"
      );

      console.log(
        "DRIVER VERIFICATION REQUEST"
      );

      console.log(
        "BODY:",
        req.body
      );

      console.log(
        "FILES:",
        Object.keys(
          req.files || {}
        )
      );

      console.log(
        "================================\n"
      );

      /*
       * FIND DRIVER
       */

      const driver =
        await Driver.findOne({
          user: req.user.id,
        });

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver profile not found.",
        });
      }

      /*
       * VEHICLE INFORMATION
       */

      const {
        vehicleMake,
        vehicleModel,
        vehicleColor,
        registration,
        licenseNumber,
      } = req.body;

      if (
        vehicleMake !==
        undefined
      ) {
        driver.vehicleMake =
          String(
            vehicleMake
          ).trim();
      }

      if (
        vehicleModel !==
        undefined
      ) {
        driver.vehicleModel =
          String(
            vehicleModel
          ).trim();
      }

      if (
        vehicleColor !==
        undefined
      ) {
        driver.vehicleColor =
          String(
            vehicleColor
          ).trim();
      }

      if (
        registration !==
        undefined
      ) {
        driver.registration =
          String(
            registration
          )
            .trim()
            .toUpperCase();
      }

      if (
        licenseNumber !==
        undefined
      ) {
        driver.licenseNumber =
          String(
            licenseNumber
          ).trim();
      }

      /*
       * FILES
       */

      const files =
        req.files || {};

      /*
       * ID DOCUMENT
       */

      if (
        files.idDocument?.[0]
      ) {
        const file =
          files.idDocument[0];

        driver.idDocument =
          `/uploads/${file.filename}`;

        console.log(
          "ID DOCUMENT SAVED:",
          driver.idDocument
        );
      }

      /*
       * DRIVER LICENCE
       */

      const licenseFile =
        files.licenseDocument?.[0] ||
        files.driverLicense?.[0];

      if (licenseFile) {
        driver.licenseDocument =
          `/uploads/${licenseFile.filename}`;

        console.log(
          "LICENSE DOCUMENT SAVED:",
          driver.licenseDocument
        );
      }

      /*
       * VEHICLE REGISTRATION
       */

      if (
        files.vehicleRegistration?.[0]
      ) {
        const file =
          files.vehicleRegistration[0];

        driver.vehicleRegistration =
          `/uploads/${file.filename}`;

        console.log(
          "VEHICLE REGISTRATION SAVED:",
          driver.vehicleRegistration
        );
      }

      /*
       * VEHICLE PROOF
       */

      if (
        files.vehicleProof?.[0]
      ) {
        const file =
          files.vehicleProof[0];

        driver.vehicleProof =
          `/uploads/${file.filename}`;

        console.log(
          "VEHICLE PROOF SAVED:",
          driver.vehicleProof
        );
      }

      /*
       * RESET VERIFICATION STATUS
       */

      driver.applicationStatus =
        "pending";

      driver.verified = false;

      driver.online = false;

      /*
       * SAVE
       */

      await driver.save();

      /*
       * DOCUMENT STATUS
       */

      const documentStatus =
        getDriverDocuments(driver);

      const documentPaths =
        getDriverDocumentPaths(
          driver
        );

      const documentCount =
        Object.values(
          documentStatus
        ).filter(Boolean).length;

      const complete =
        documentCount === 4;

      console.log(
        "\n================================"
      );

      console.log(
        "DOCUMENT STATUS AFTER UPLOAD"
      );

      console.log(
        documentPaths
      );

      console.log(
        "DOCUMENT STATUS:",
        documentStatus
      );

      console.log(
        `DOCUMENT COUNT: ${documentCount}/4`
      );

      console.log(
        `COMPLETE: ${complete}`
      );

      console.log(
        "================================\n"
      );

      /*
       * UPDATED DRIVER
       */

      const updatedDriver =
        await Driver.findById(
          driver._id
        ).populate(
          "user",
          "name email phone"
        );

      /*
       * ADMIN NOTIFICATION
       */

      req.app
        .get("io")
        ?.to("admins")
        .emit(
          "driver:verification",
          {
            driverId:
              String(
                driver._id
              ),

            applicationStatus:
              "pending",

            documentCount,

            documentsComplete:
              complete,

            documents:
              documentPaths,

            message:
              "Driver verification documents submitted.",
          }
        );

      /*
       * RESPONSE
       */

      res.status(200).json({
        success: true,

        message:
          "Verification documents submitted successfully. Your application is now pending admin review.",

        driver:
          updatedDriver,

        /*
         * ACTUAL PATHS
         */
        documents:
          documentPaths,

        /*
         * BOOLEAN STATUS
         */
        documentStatus,

        documentCount,

        documentsComplete:
          complete,
      });
    } catch (error) {
      console.error(
        "\n================================"
      );

      console.error(
        "VERIFICATION BACKEND ERROR:"
      );

      console.error(error);

      console.error(
        "================================\n"
      );

      res.status(500).json({
        success: false,

        message:
          error.message ||
          "Verification upload failed.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| DRIVER ONLINE / OFFLINE STATUS
|--------------------------------------------------------------------------
*/

r.patch(
  "/status",
  auth,
  role("driver"),
  async (req, res) => {
    try {
      const driver =
        await Driver.findOne({
          user: req.user.id,
        });

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver profile not found.",
        });
      }

      if (
        driver.applicationStatus !==
        "approved"
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Your driver application must be approved before going online.",
        });
      }

      if (!driver.verified) {
        return res.status(403).json({
          success: false,
          message:
            "Your driver account must be verified before going online.",
        });
      }

      if (
        !documentsComplete(driver)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "All 4 verification documents are required before going online.",

          documentCount:
            getDocumentCount(
              driver
            ),

          documents:
            getDriverDocuments(
              driver
            ),
        });
      }

      driver.online =
        Boolean(
          req.body.online
        );

      await driver.save();

      req.app
        .get("io")
        ?.emit(
          "driver:presence",
          {
            driverId:
              String(
                driver._id
              ),

            online:
              driver.online,

            location:
              driver.location,
          }
        );

      res.json({
        success: true,
        driver,
      });
    } catch (error) {
      console.error(
        "Driver status error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to update driver status.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| UPDATE DRIVER LOCATION
|--------------------------------------------------------------------------
*/

r.patch(
  "/location",
  auth,
  role("driver"),
  async (req, res) => {
    try {
      const lat =
        Number(
          req.body.lat
        );

      const lng =
        Number(
          req.body.lng
        );

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Valid latitude and longitude are required.",
        });
      }

      if (
        lat < -90 ||
        lat > 90
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid latitude.",
        });
      }

      if (
        lng < -180 ||
        lng > 180
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid longitude.",
        });
      }

      const driver =
        await Driver.findOne({
          user: req.user.id,
        });

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver profile not found.",
        });
      }

      driver.location = {
        lat,
        lng,
      };

      await driver.save();

      req.app
        .get("io")
        ?.emit(
          "driver:location",
          {
            driverId:
              String(
                driver._id
              ),

            location: {
              lat,
              lng,
            },
          }
        );

      const activeRide =
        await Ride.findOne({
          driver:
            driver._id,

          status: {
            $in: [
              "accepted",
              "arriving",
              "in_progress",
            ],
          },
        });

      if (activeRide) {
        req.app
          .get("io")
          ?.to(
            `ride:${activeRide._id}`
          )
          .emit(
            "driver:location",
            {
              rideId:
                String(
                  activeRide._id
                ),

              driverId:
                String(
                  driver._id
                ),

              lat,

              lng,
            }
          );
      }

      res.json({
        success: true,

        message:
          "Driver location updated.",

        location:
          driver.location,
      });
    } catch (error) {
      console.error(
        "Driver location error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to update driver location.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| DRIVER EARNINGS
|--------------------------------------------------------------------------
*/

r.get(
  "/earnings",
  auth,
  role("driver"),
  async (req, res) => {
    try {
      const driver =
        await Driver.findOne({
          user: req.user.id,
        });

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver profile not found.",
        });
      }

      const rides =
        await Ride.find({
          driver:
            driver._id,

          status:
            "completed",
        }).sort({
          updatedAt: -1,
        });

      const now =
        new Date();

      const startOfDay =
        new Date(now);

      startOfDay.setHours(
        0,
        0,
        0,
        0
      );

      const startOfWeek =
        new Date(now);

      const day =
        startOfWeek.getDay();

      const daysFromMonday =
        day === 0
          ? 6
          : day - 1;

      startOfWeek.setDate(
        startOfWeek.getDate() -
          daysFromMonday
      );

      startOfWeek.setHours(
        0,
        0,
        0,
        0
      );

      const startOfMonth =
        new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        );

      let today = 0;
      let week = 0;
      let month = 0;
      let total = 0;

      let todayTrips = 0;
      let weekTrips = 0;
      let monthTrips = 0;

      let cash = 0;
      let online = 0;

      const daily = {};

      rides.forEach(
        (ride) => {
          const amount =
            Number(
              ride.fare || 0
            );

          const completedAt =
            ride.updatedAt ||
            ride.createdAt ||
            now;

          const date =
            new Date(
              completedAt
            );

          total += amount;

          if (
            date >= startOfDay
          ) {
            today += amount;
            todayTrips++;
          }

          if (
            date >= startOfWeek
          ) {
            week += amount;
            weekTrips++;
          }

          if (
            date >= startOfMonth
          ) {
            month += amount;
            monthTrips++;
          }

          const paymentMethod =
            String(
              ride.paymentMethod ||
                "cash"
            ).toLowerCase();

          if (
            paymentMethod ===
            "cash"
          ) {
            cash += amount;
          } else {
            online += amount;
          }

          const dateKey =
            date
              .toISOString()
              .split("T")[0];

          if (!daily[dateKey]) {
            daily[dateKey] = {
              date: dateKey,
              earnings: 0,
              trips: 0,
            };
          }

          daily[dateKey].earnings +=
            amount;

          daily[dateKey].trips++;
        }
      );

      const dailyHistory =
        Object.values(daily)
          .sort((a, b) =>
            a.date.localeCompare(
              b.date
            )
          )
          .slice(-30)
          .map((item) => ({
            date:
              item.date,

            earnings:
              Number(
                item.earnings.toFixed(
                  2
                )
              ),

            trips:
              item.trips,
          }));

      const averagePerRide =
        rides.length > 0
          ? total /
            rides.length
          : 0;

      res.json({
        success: true,

        today:
          Number(
            today.toFixed(2)
          ),

        week:
          Number(
            week.toFixed(2)
          ),

        month:
          Number(
            month.toFixed(2)
          ),

        total:
          Number(
            total.toFixed(2)
          ),

        todayTrips,

        weekTrips,

        monthTrips,

        totalTrips:
          rides.length,

        averagePerRide:
          Number(
            averagePerRide.toFixed(
              2
            )
          ),

        cash:
          Number(
            cash.toFixed(2)
          ),

        online:
          Number(
            online.toFixed(2)
          ),

        daily:
          dailyHistory,

        rides,
      });
    } catch (error) {
      console.error(
        "Driver earnings error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to load driver earnings.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| DRIVER STATS
|--------------------------------------------------------------------------
*/

r.get(
  "/stats",
  auth,
  role("driver"),
  async (req, res) => {
    try {
      const driver =
        await Driver.findOne({
          user: req.user.id,
        });

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver profile not found.",
        });
      }

      const [
        completedRides,
        cancelledRides,
        activeRides,
        searchingRides,
      ] =
        await Promise.all([
          Ride.countDocuments({
            driver:
              driver._id,

            status:
              "completed",
          }),

          Ride.countDocuments({
            driver:
              driver._id,

            status:
              "cancelled",
          }),

          Ride.countDocuments({
            driver:
              driver._id,

            status: {
              $in: [
                "accepted",
                "arriving",
                "in_progress",
              ],
            },
          }),

          Ride.countDocuments({
            status:
              "searching",
          }),
        ]);

      const completedRideData =
        await Ride.find({
          driver:
            driver._id,

          status:
            "completed",
        }).select(
          "fare"
        );

      const totalEarnings =
        completedRideData.reduce(
          (
            sum,
            ride
          ) =>
            sum +
            Number(
              ride.fare || 0
            ),
          0
        );

      res.json({
        success: true,

        online:
          Boolean(
            driver.online
          ),

        verified:
          Boolean(
            driver.verified
          ),

        applicationStatus:
          driver.applicationStatus ||
          "pending",

        rating:
          Number(
            driver.rating || 0
          ),

        completedRides,

        cancelledRides,

        activeRides,

        availableRequests:
          searchingRides,

        totalEarnings:
          Number(
            totalEarnings.toFixed(
              2
            )
          ),

        documentCount:
          getDocumentCount(
            driver
          ),

        documentsComplete:
          documentsComplete(
            driver
          ),
      });
    } catch (error) {
      console.error(
        "Driver stats error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to load driver statistics.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| DRIVER RIDES
|--------------------------------------------------------------------------
*/

r.get(
  "/rides",
  auth,
  role("driver"),
  async (req, res) => {
    try {
      const driver =
        await Driver.findOne({
          user: req.user.id,
        });

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver profile not found.",
        });
      }

      const rides =
        await Ride.find({
          driver:
            driver._id,
        })
          .populate(
            "passenger",
            "name email phone"
          )
          .sort({
            updatedAt: -1,
          })
          .limit(100);

      res.json({
        success: true,
        rides,
      });
    } catch (error) {
      console.error(
        "Driver rides error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to load driver rides.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET DRIVER SETTINGS
|--------------------------------------------------------------------------
*/

r.get(
  "/settings",
  auth,
  role("driver"),
  async (req, res) => {
    try {
      const driver =
        await Driver.findOne({
          user: req.user.id,
        }).populate(
          "user",
          "name email phone"
        );

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver profile not found.",
        });
      }

      res.json({
        success: true,

        profile: {
          name:
            driver.user?.name ||
            "",

          email:
            driver.user?.email ||
            "",

          phone:
            driver.user?.phone ||
            "",
        },

        notifications:
          driver.settings
            ?.notifications || {
            rideRequests: true,
            earnings: true,
            account: true,
          },

        privacy:
          driver.settings
            ?.privacy || {
            locationSharing: true,
          },

        vehicle: {
          vehicleMake:
            driver.vehicleMake ||
            "",

          vehicleModel:
            driver.vehicleModel ||
            "",

          vehicleColor:
            driver.vehicleColor ||
            "",

          registration:
            driver.registration ||
            "",

          licenseNumber:
            driver.licenseNumber ||
            "",
        },

        paymentMethod:
          driver.settings
            ?.paymentMethod ||
          "cash",
      });
    } catch (error) {
      console.error(
        "Driver settings error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to load driver settings.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| UPDATE DRIVER SETTINGS / PROFILE
|--------------------------------------------------------------------------
*/

r.patch(
  "/settings",
  auth,
  role("driver"),
  async (req, res) => {
    try {
      const driver =
        await Driver.findOne({
          user: req.user.id,
        });

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver profile not found.",
        });
      }

      const user =
        await User.findById(
          req.user.id
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User account not found.",
        });
      }

      const {
        name,
        phone,
        email,

        vehicleMake,
        vehicleModel,
        vehicleColor,
        registration,
        licenseNumber,

        notifications,
        privacy,
        vehicle,
        paymentMethod,
      } = req.body;

      /*
       * PERSONAL INFORMATION
       */

      if (
        name !== undefined
      ) {
        const cleanName =
          String(
            name
          ).trim();

        if (!cleanName) {
          return res.status(400).json({
            success: false,
            message:
              "Full name cannot be empty.",
          });
        }

        user.name =
          cleanName;
      }

      if (
        phone !== undefined
      ) {
        user.phone =
          String(
            phone
          ).trim();
      }

      if (
        email !== undefined
      ) {
        const cleanEmail =
          String(
            email
          )
            .trim()
            .toLowerCase();

        if (!cleanEmail) {
          return res.status(400).json({
            success: false,
            message:
              "Email address cannot be empty.",
          });
        }

        user.email =
          cleanEmail;
      }

      await user.save();

      /*
       * VEHICLE INFORMATION
       */

      if (
        vehicleMake !==
        undefined
      ) {
        driver.vehicleMake =
          String(
            vehicleMake
          ).trim();
      }

      if (
        vehicleModel !==
        undefined
      ) {
        driver.vehicleModel =
          String(
            vehicleModel
          ).trim();
      }

      if (
        vehicleColor !==
        undefined
      ) {
        driver.vehicleColor =
          String(
            vehicleColor
          ).trim();
      }

      if (
        registration !==
        undefined
      ) {
        driver.registration =
          String(
            registration
          )
            .trim()
            .toUpperCase();
      }

      if (
        licenseNumber !==
        undefined
      ) {
        driver.licenseNumber =
          String(
            licenseNumber
          ).trim();
      }

      /*
       * NESTED VEHICLE SUPPORT
       */

      if (vehicle) {
        if (
          vehicle.vehicleMake !==
          undefined
        ) {
          driver.vehicleMake =
            String(
              vehicle.vehicleMake
            ).trim();
        }

        if (
          vehicle.vehicleModel !==
          undefined
        ) {
          driver.vehicleModel =
            String(
              vehicle.vehicleModel
            ).trim();
        }

        if (
          vehicle.vehicleColor !==
          undefined
        ) {
          driver.vehicleColor =
            String(
              vehicle.vehicleColor
            ).trim();
        }

        if (
          vehicle.registration !==
          undefined
        ) {
          driver.registration =
            String(
              vehicle.registration
            )
              .trim()
              .toUpperCase();
        }

        if (
          vehicle.licenseNumber !==
          undefined
        ) {
          driver.licenseNumber =
            String(
              vehicle.licenseNumber
            ).trim();
        }
      }

      /*
       * NOTIFICATIONS
       */

      if (notifications) {
        driver.settings =
          driver.settings || {};

        driver.settings.notifications = {
          rideRequests:
            notifications.rideRequests !==
            false,

          earnings:
            notifications.earnings !==
            false,

          account:
            notifications.account !==
            false,
        };
      }

      /*
       * PRIVACY
       */

      if (privacy) {
        driver.settings =
          driver.settings || {};

        driver.settings.privacy = {
          locationSharing:
            privacy.locationSharing !==
            false,
        };
      }

      /*
       * PAYMENT METHOD
       */

      if (
        paymentMethod ===
          "cash" ||
        paymentMethod ===
          "online"
      ) {
        driver.settings =
          driver.settings || {};

        driver.settings.paymentMethod =
          paymentMethod;
      }

      await driver.save();

      const updatedDriver =
        await Driver.findById(
          driver._id
        ).populate(
          "user",
          "name email phone"
        );

      res.json({
        success: true,

        message:
          "Profile updated successfully.",

        driver:
          updatedDriver,

        profile: {
          name:
            updatedDriver.user?.name ||
            "",

          email:
            updatedDriver.user?.email ||
            "",

          phone:
            updatedDriver.user?.phone ||
            "",
        },

        vehicle: {
          vehicleMake:
            updatedDriver.vehicleMake ||
            "",

          vehicleModel:
            updatedDriver.vehicleModel ||
            "",

          vehicleColor:
            updatedDriver.vehicleColor ||
            "",

          registration:
            updatedDriver.registration ||
            "",

          licenseNumber:
            updatedDriver.licenseNumber ||
            "",
        },
      });
    } catch (error) {
      console.error(
        "================================"
      );

      console.error(
        "DRIVER SETTINGS UPDATE ERROR:"
      );

      console.error(error);

      console.error(
        "================================"
      );

      if (
        error?.code === 11000
      ) {
        return res.status(400).json({
          success: false,
          message:
            "That email address is already being used.",
        });
      }

      if (
        error?.name ===
        "ValidationError"
      ) {
        return res.status(400).json({
          success: false,
          message:
            error.message ||
            "Please check the information you entered.",
        });
      }

      res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to update driver profile.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| CHANGE PASSWORD
|--------------------------------------------------------------------------
*/

r.patch(
  "/change-password",
  auth,
  role("driver"),
  async (req, res) => {
    try {
      const {
        currentPassword,
        newPassword,
      } = req.body;

      if (
        !currentPassword ||
        !newPassword
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Current password and new password are required.",
        });
      }

      if (
        newPassword.length < 8
      ) {
        return res.status(400).json({
          success: false,
          message:
            "New password must contain at least 8 characters.",
        });
      }

      const user =
        await User.findById(
          req.user.id
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User account not found.",
        });
      }

      let validPassword =
        false;

      if (
        typeof user.comparePassword ===
        "function"
      ) {
        validPassword =
          await user.comparePassword(
            currentPassword
          );
      }

      if (
        typeof user.matchPassword ===
          "function" &&
        !validPassword
      ) {
        validPassword =
          await user.matchPassword(
            currentPassword
          );
      }

      if (!validPassword) {
        return res.status(400).json({
          success: false,
          message:
            "Current password is incorrect.",
        });
      }

      user.password =
        newPassword;

      await user.save();

      res.json({
        success: true,

        message:
          "Password changed successfully.",
      });
    } catch (error) {
      console.error(
        "Change password error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to change password.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| DEACTIVATE ACCOUNT
|--------------------------------------------------------------------------
*/

r.patch(
  "/deactivate",
  auth,
  role("driver"),
  async (req, res) => {
    try {
      const driver =
        await Driver.findOne({
          user: req.user.id,
        });

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver profile not found.",
        });
      }

      driver.online = false;

      await driver.save();

      req.app
        .get("io")
        ?.to("admins")
        .emit(
          "driver:presence",
          {
            driverId:
              String(
                driver._id
              ),

            online: false,
          }
        );

      res.json({
        success: true,

        message:
          "Driver account deactivated successfully.",
      });
    } catch (error) {
      console.error(
        "Account deactivation error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to deactivate account.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| MULTER ERROR HANDLER
|--------------------------------------------------------------------------
*/

r.use(
  (
    error,
    req,
    res,
    next
  ) => {
    if (
      error instanceof
      multer.MulterError
    ) {
      console.error(
        "MULTER ERROR:",
        error
      );

      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "File is too large. Maximum file size is 10MB.",
        });
      }

      return res.status(400).json({
        success: false,

        message:
          error.message ||
          "File upload failed.",
      });
    }

    if (error) {
      console.error(
        "UPLOAD ERROR:",
        error
      );

      return res.status(400).json({
        success: false,

        message:
          error.message ||
          "File upload failed.",
      });
    }

    next();
  }
);

export default r;