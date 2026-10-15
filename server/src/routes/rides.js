import { Router } from "express";

import Ride from "../models/Ride.js";
import Driver from "../models/Driver.js";

import { auth, role } from "../middleware/auth.js";
import { calculateFare } from "../utils/fare.js";
import { haversineKm, etaMinutes } from "../utils/geo.js";

const r = Router();

// ======================================================
// ACTIVE RIDE STATUSES
// ======================================================
//
// A passenger CANNOT create another booking while the
// current ride has one of these statuses.
//
// IMPORTANT:
// "cancelled" and "completed" are NOT active.
//
const ACTIVE_RIDE_STATUSES = [
  "searching",
  "accepted",
  "arriving",
  "arrived",
  "in_progress",
];

// Driver cannot accept another ride while in one of
// these states.
const DRIVER_ACTIVE_RIDE_STATUSES = [
  "accepted",
  "arriving",
  "arrived",
  "in_progress",
];

// ======================================================
// SOCKET HELPER
// ======================================================

const emit = (req, event, payload) => {
  req.app.get("io")?.emit(event, payload);
};

// ======================================================
// POPULATE RIDE
// ======================================================
//
// This gives the passenger access to:
//
// driver.user.name
// driver.user.phone
// driver.user.email
// driver.user.photo
// driver.user.avatar
//
// and the driver's vehicle information remains on
// the Driver document.
//
const populateRide = async (id) => {
  return Ride.findById(id)
    .populate(
      "passenger",
      "name email phone photo avatar"
    )
    .populate({
      path: "driver",
      populate: {
        path: "user",
        select:
          "name phone email photo avatar",
      },
    });
};

// ======================================================
// CALCULATE FARE
// ======================================================

r.post(
  "/estimate",
  auth,
  role("passenger"),
  async (req, res) => {
    try {
      const {
        pickup,
        destination,
      } = req.body;

      // -----------------------------------------------
      // Validate locations
      // -----------------------------------------------

      if (!pickup || !destination) {
        return res.status(400).json({
          success: false,
          message:
            "Pickup and destination are required.",
        });
      }

      // -----------------------------------------------
      // Validate coordinates
      // -----------------------------------------------

      if (
        !Number.isFinite(
          Number(pickup.lat)
        ) ||
        !Number.isFinite(
          Number(pickup.lng)
        ) ||
        !Number.isFinite(
          Number(destination.lat)
        ) ||
        !Number.isFinite(
          Number(destination.lng)
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Pickup and destination coordinates are invalid.",
        });
      }

      // -----------------------------------------------
      // Calculate distance
      // -----------------------------------------------

      const km = haversineKm(
        Number(pickup.lat),
        Number(pickup.lng),
        Number(destination.lat),
        Number(destination.lng)
      );

      // -----------------------------------------------
      // Calculate ETA
      // -----------------------------------------------

      const mins = etaMinutes(km);

      // -----------------------------------------------
      // Calculate fare
      // -----------------------------------------------

      const fare = calculateFare(
        km,
        mins
      );

      return res.json({
        success: true,
        distanceKm:
          Number(km.toFixed(1)),
        durationMin: mins,
        ...fare,
      });
    } catch (error) {
      console.error(
        "FARE ESTIMATE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Could not calculate fare.",
      });
    }
  }
);

// ======================================================
// CREATE BOOKING
// ======================================================

r.post(
  "/",
  auth,
  role("passenger"),
  async (req, res) => {
    try {
      const {
        pickup,
        destination,
        paymentMethod = "cash",
      } = req.body;

      // ==================================================
      // ONLY ONE ACTIVE BOOKING PER PASSENGER
      // ==================================================

      const existingActiveRide =
        await Ride.findOne({
          passenger: req.user.id,

          status: {
            $in:
              ACTIVE_RIDE_STATUSES,
          },
        }).sort({
          createdAt: -1,
        });

      // -----------------------------------------------
      // BLOCK SECOND ACTIVE BOOKING
      // -----------------------------------------------

      if (existingActiveRide) {
        return res.status(409).json({
          success: false,
          message:
            "You already have an active booking. Complete or cancel your current ride before making another booking.",
          rideId:
            existingActiveRide._id,
          status:
            existingActiveRide.status,
        });
      }

      // ==================================================
      // VALIDATE PICKUP
      // ==================================================

      if (!pickup || !destination) {
        return res.status(400).json({
          success: false,
          message:
            "Pickup and destination are required.",
        });
      }

      // ==================================================
      // VALIDATE COORDINATES
      // ==================================================

      if (
        !Number.isFinite(
          Number(pickup.lat)
        ) ||
        !Number.isFinite(
          Number(pickup.lng)
        ) ||
        !Number.isFinite(
          Number(destination.lat)
        ) ||
        !Number.isFinite(
          Number(destination.lng)
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid pickup or destination coordinates.",
        });
      }

      // ==================================================
      // CALCULATE DISTANCE
      // ==================================================

      const km = haversineKm(
        Number(pickup.lat),
        Number(pickup.lng),
        Number(destination.lat),
        Number(destination.lng)
      );

      // ==================================================
      // CALCULATE ETA
      // ==================================================

      const mins = etaMinutes(km);

      // ==================================================
      // SERVER-SIDE FARE
      // ==================================================

      const fare =
        calculateFare(
          km,
          mins
        );

      // ==================================================
      // CREATE RIDE
      // ==================================================

      const ride =
        await Ride.create({
          passenger:
            req.user.id,

          driver: null,

          pickup: {
            name:
              pickup.name ||
              "Pickup",
            lat: Number(
              pickup.lat
            ),
            lng: Number(
              pickup.lng
            ),
          },

          destination: {
            name:
              destination.name ||
              "Destination",
            lat: Number(
              destination.lat
            ),
            lng: Number(
              destination.lng
            ),
          },

          distanceKm:
            Number(
              km.toFixed(1)
            ),

          durationMin:
            mins,

          baseFare:
            fare.baseFare,

          ratePerKm:
            fare.ratePerKm,

          distanceFare:
            fare.distanceFare,

          normalFare:
            fare.normalFare,

          nightMultiplier:
            fare.nightMultiplier,

          fare:
            fare.fare,

          paymentMethod,

          status:
            "searching",
        });

      // ==================================================
      // GET FULL RIDE
      // ==================================================

      const full =
        await populateRide(
          ride._id
        );

      // ==================================================
      // SOCKET: NEW RIDE
      // ==================================================

      emit(
        req,
        "ride:created",
        full
      );

      // ==================================================
      // ADMIN
      // ==================================================

      req.app
        .get("io")
        ?.to("admins")
        .emit(
          "admin:ride:new",
          full
        );

      // ==================================================
      // DRIVERS
      // ==================================================

      req.app
        .get("io")
        ?.emit(
          "driver:ride:new",
          full
        );

      // ==================================================
      // RESPONSE
      // ==================================================

      return res.status(201).json({
        success: true,
        ride: full,
      });
    } catch (error) {
      console.error(
        "CREATE RIDE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Could not create ride.",
      });
    }
  }
);

// ======================================================
// GET MY RIDES
// ======================================================

r.get(
  "/mine",
  auth,
  async (req, res) => {
    try {
      let rides;

      // =================================================
      // DRIVER RIDES
      // =================================================

      if (
        req.user.role ===
        "driver"
      ) {
        const driver =
          await Driver.findOne({
            user:
              req.user.id,
          });

        rides =
          await Ride.find({
            driver:
              driver
                ? driver._id
                : null,
          })
            .populate(
              "passenger",
              "name email phone photo avatar"
            )
            .populate({
              path: "driver",
              populate: {
                path: "user",
                select:
                  "name phone email photo avatar",
              },
            })
            .sort({
              createdAt: -1,
            });
      }

      // =================================================
      // PASSENGER RIDES
      // =================================================

      else {
        rides =
          await Ride.find({
            passenger:
              req.user.id,
          })
            .populate(
              "passenger",
              "name email phone photo avatar"
            )
            .populate({
              path: "driver",
              populate: {
                path: "user",
                select:
                  "name phone email photo avatar",
              },
            })
            .sort({
              createdAt: -1,
            });
      }

      return res.json({
        success: true,
        rides,
      });
    } catch (error) {
      console.error(
        "GET MY RIDES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Unable to load rides.",
      });
    }
  }
);

// ======================================================
// GET SINGLE RIDE
// ======================================================

r.get(
  "/:id",
  auth,
  async (req, res) => {
    try {
      const ride =
        await populateRide(
          req.params.id
        );

      if (!ride) {
        return res.status(404).json({
          success: false,
          message:
            "Ride not found.",
        });
      }

      // =================================================
      // PASSENGER AUTHORIZATION
      // =================================================

      if (
        req.user.role ===
          "passenger" &&
        String(
          ride.passenger._id
        ) !==
          String(req.user.id)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Not your ride.",
        });
      }

      // =================================================
      // DRIVER AUTHORIZATION
      // =================================================

      if (
        req.user.role ===
        "driver"
      ) {
        const driver =
          await Driver.findOne({
            user:
              req.user.id,
          });

        if (
          ride.driver &&
          (!driver ||
            String(
              ride.driver._id
            ) !==
              String(
                driver._id
              ))
        ) {
          return res.status(403).json({
            success: false,
            message:
              "Not your ride.",
          });
        }
      }

      return res.json({
        success: true,
        ride,
      });
    } catch (error) {
      console.error(
        "GET SINGLE RIDE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Unable to load ride.",
      });
    }
  }
);

// ======================================================
// AVAILABLE RIDES FOR DRIVER
// ======================================================

r.get(
  "/available/list",
  auth,
  role("driver"),
  async (req, res) => {
    try {
      const driver =
        await Driver.findOne({
          user:
            req.user.id,
        });

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver profile not found.",
        });
      }

      // =================================================
      // DRIVER MUST BE APPROVED
      // =================================================

      if (
        driver.applicationStatus !==
        "approved"
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Driver is not approved.",
        });
      }

      // =================================================
      // CHECK DRIVER ACTIVE RIDE
      // =================================================

      const activeRide =
        await Ride.findOne({
          driver:
            driver._id,

          status: {
            $in:
              DRIVER_ACTIVE_RIDE_STATUSES,
          },
        })
          .populate(
            "passenger",
            "name email phone photo avatar"
          )
          .populate({
            path: "driver",
            populate: {
              path: "user",
              select:
                "name phone email photo avatar",
            },
          });

      // =================================================
      // DRIVER ALREADY HAS PASSENGER
      // =================================================

      if (activeRide) {
        return res.json({
          success: true,
          rides: [],
          activeRide,
        });
      }

      // =================================================
      // GET AVAILABLE RIDES
      // =================================================

      const rides =
        await Ride.find({
          status:
            "searching",

          driver:
            null,
        })
          .populate(
            "passenger",
            "name email phone photo avatar"
          )
          .sort({
            createdAt: -1,
          });

      return res.json({
        success: true,
        rides,
        activeRide:
          null,
      });
    } catch (error) {
      console.error(
        "AVAILABLE RIDES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Unable to load available rides.",
      });
    }
  }
);

// ======================================================
// DRIVER ACCEPTS RIDE
// ======================================================

r.post(
  "/:id/accept",
  auth,
  role("driver"),
  async (req, res) => {
    try {
      const driver =
        await Driver.findOne({
          user:
            req.user.id,
        });

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver profile not found.",
        });
      }

      // =================================================
      // DRIVER APPROVAL
      // =================================================

      if (
        driver.applicationStatus !==
        "approved"
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Driver is not approved.",
        });
      }

      // =================================================
      // DRIVER MUST BE ONLINE
      // =================================================

      if (!driver.online) {
        return res.status(403).json({
          success: false,
          message:
            "You must be online to accept rides.",
        });
      }

      // =================================================
      // ONE ACTIVE PASSENGER PER DRIVER
      // =================================================

      const activeRide =
        await Ride.findOne({
          driver:
            driver._id,

          status: {
            $in:
              DRIVER_ACTIVE_RIDE_STATUSES,
          },
        });

      if (activeRide) {
        return res.status(409).json({
          success: false,
          message:
            "You already have an active passenger. Complete or cancel your current ride before accepting another request.",
          ride:
            activeRide,
        });
      }

      // =================================================
      // ATOMIC ACCEPT
      // =================================================
      //
      // Only one driver can win because the database
      // requires:
      //
      // status = searching
      // driver = null
      //
      // Once the first driver changes driver from null,
      // another driver cannot match this query.
      //

      const ride =
        await Ride.findOneAndUpdate(
          {
            _id:
              req.params.id,

            status:
              "searching",

            driver:
              null,
          },

          {
            $set: {
              driver:
                driver._id,

              status:
                "accepted",
            },
          },

          {
            new: true,
          }
        );

      // =================================================
      // SOMEONE ELSE ACCEPTED IT
      // =================================================

      if (!ride) {
        return res.status(409).json({
          success: false,
          message:
            "This passenger request has already been accepted by another driver.",
        });
      }

      // =================================================
      // FULL RIDE
      // =================================================

      const full =
        await populateRide(
          ride._id
        );

      // =================================================
      // SOCKET
      // =================================================

      emit(
        req,
        "ride:accepted",
        full
      );

      // =================================================
      // PASSENGER
      // =================================================

      req.app
        .get("io")
        ?.to(
          `user:${ride.passenger}`
        )
        .emit(
          "ride:accepted",
          full
        );

      // =================================================
      // ADMIN
      // =================================================

      req.app
        .get("io")
        ?.to("admins")
        .emit(
          "admin:ride:accepted",
          full
        );

      return res.json({
        success: true,
        ride: full,
      });
    } catch (error) {
      console.error(
        "ACCEPT RIDE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Unable to accept ride.",
      });
    }
  }
);

// ======================================================
// RIDE STATUS
// ======================================================

r.patch(
  "/:id/status",
  auth,
  async (req, res) => {
    try {
      const newStatus =
        String(
          req.body.status ||
            ""
        ).trim();

      // =================================================
      // VALID STATUSES
      // =================================================

      const validStatuses = [
        "searching",
        "accepted",
        "arriving",
        "arrived",
        "in_progress",
        "completed",
        "cancelled",
      ];

      if (
        !validStatuses.includes(
          newStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid ride status.",
        });
      }

      // =================================================
      // FIND RIDE
      // =================================================

      const ride =
        await Ride.findById(
          req.params.id
        );

      if (!ride) {
        return res.status(404).json({
          success: false,
          message:
            "Ride not found.",
        });
      }

      // =================================================
      // PASSENGER AUTHORIZATION
      // =================================================

      if (
        req.user.role ===
        "passenger"
      ) {
        if (
          String(
            ride.passenger
          ) !==
          String(
            req.user.id
          )
        ) {
          return res.status(403).json({
            success: false,
            message:
              "Not your ride.",
          });
        }

        // ---------------------------------------------
        // PASSENGER CAN ONLY CANCEL
        // ---------------------------------------------

        if (
          newStatus !==
          "cancelled"
        ) {
          return res.status(403).json({
            success: false,
            message:
              "Passengers can only cancel their active ride.",
          });
        }
      }

      // =================================================
      // DRIVER AUTHORIZATION
      // =================================================

      if (
        req.user.role ===
        "driver"
      ) {
        const driver =
          await Driver.findOne({
            user:
              req.user.id,
          });

        if (
          !driver ||
          !ride.driver ||
          String(
            ride.driver
          ) !==
            String(
              driver._id
            )
        ) {
          return res.status(403).json({
            success: false,
            message:
              "Not your ride.",
          });
        }
      }

      // =================================================
      // FINISHED RIDE
      // =================================================

      if (
        ride.status ===
          "completed" ||
        ride.status ===
          "cancelled"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This ride has already been completed or cancelled.",
        });
      }

      // =================================================
      // CANCELLATION
      // =================================================
      //
      // Passenger or driver can cancel from ANY active
      // ride state.
      //
      // searching
      // accepted
      // arriving
      // arrived
      // in_progress
      //
      // becomes:
      //
      // cancelled
      //
      // After this, the passenger can book again.
      //

      if (
        newStatus ===
        "cancelled"
      ) {
        if (
          !ACTIVE_RIDE_STATUSES.includes(
            ride.status
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "This ride is no longer active.",
          });
        }

        ride.status =
          "cancelled";

        // Remove driver's live position.
        ride.driverLocation =
          null;

        await ride.save();

        // ---------------------------------------------
        // Populate updated ride
        // ---------------------------------------------

        const full =
          await populateRide(
            ride._id
          );

        // ---------------------------------------------
        // GLOBAL
        // ---------------------------------------------

        emit(
          req,
          "ride:status",
          full
        );

        // ---------------------------------------------
        // RIDE ROOM
        // ---------------------------------------------

        req.app
          .get("io")
          ?.to(
            `ride:${ride._id}`
          )
          .emit(
            "ride:status",
            full
          );

        // ---------------------------------------------
        // PASSENGER
        // ---------------------------------------------

        req.app
          .get("io")
          ?.to(
            `user:${ride.passenger}`
          )
          .emit(
            "ride:status",
            full
          );

        // ---------------------------------------------
        // DRIVER
        // ---------------------------------------------

        if (ride.driver) {
          const driver =
            await Driver.findById(
              ride.driver
            );

          if (
            driver?.user
          ) {
            req.app
              .get("io")
              ?.to(
                `user:${driver.user}`
              )
              .emit(
                "ride:status",
                full
              );
          }
        }

        // ---------------------------------------------
        // ADMIN
        // ---------------------------------------------

        req.app
          .get("io")
          ?.to("admins")
          .emit(
            "admin:ride:status",
            full
          );

        // ---------------------------------------------
        // RESPONSE
        // ---------------------------------------------

        return res.json({
          success: true,
          message:
            "Ride cancelled successfully. You can book another ride.",
          ride: full,
        });
      }

      // =================================================
      // DRIVER STATUS TRANSITIONS
      // =================================================

      if (
        req.user.role ===
        "driver"
      ) {
        const allowedTransitions =
          {
            accepted: [
              "arriving",
            ],

            arriving: [
              "arrived",
            ],

            arrived: [
              "in_progress",
            ],

            in_progress: [
              "completed",
            ],
          };

        const allowedNext =
          allowedTransitions[
            ride.status
          ] || [];

        if (
          !allowedNext.includes(
            newStatus
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              `Cannot change ride from ${ride.status} to ${newStatus}.`,
          });
        }
      }

      // =================================================
      // SEARCHING RIDE
      // =================================================

      if (
        ride.status ===
        "searching"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A searching ride must first be accepted by a driver.",
        });
      }

      // =================================================
      // UPDATE STATUS
      // =================================================

      ride.status =
        newStatus;

      await ride.save();

      // =================================================
      // DRIVER EARNINGS
      // =================================================

      if (
        newStatus ===
          "completed" &&
        ride.driver
      ) {
        await Driver.findByIdAndUpdate(
          ride.driver,
          {
            $inc: {
              trips: 1,

              earnings:
                Number(
                  ride.fare ||
                    0
                ) *
                0.85,
            },
          }
        );
      }

      // =================================================
      // GET UPDATED RIDE
      // =================================================

      const full =
        await populateRide(
          ride._id
        );

      // =================================================
      // GLOBAL SOCKET
      // =================================================

      emit(
        req,
        "ride:status",
        full
      );

      // =================================================
      // RIDE ROOM
      // =================================================

      req.app
        .get("io")
        ?.to(
          `ride:${ride._id}`
        )
        .emit(
          "ride:status",
          full
        );

      // =================================================
      // PASSENGER
      // =================================================

      req.app
        .get("io")
        ?.to(
          `user:${ride.passenger}`
        )
        .emit(
          "ride:status",
          full
        );

      // =================================================
      // DRIVER
      // =================================================

      if (ride.driver) {
        const driver =
          await Driver.findById(
            ride.driver
          );

        if (
          driver?.user
        ) {
          req.app
            .get("io")
            ?.to(
              `user:${driver.user}`
            )
            .emit(
              "ride:status",
              full
            );
        }
      }

      // =================================================
      // ADMIN
      // =================================================

      req.app
        .get("io")
        ?.to("admins")
        .emit(
          "admin:ride:status",
          full
        );

      // =================================================
      // RESPONSE
      // =================================================

      return res.json({
        success: true,
        ride: full,
      });
    } catch (error) {
      console.error(
        "STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Unable to update ride status.",
      });
    }
  }
);

// ======================================================
// RATE DRIVER
// ======================================================

r.post(
  "/:id/rating",
  auth,
  role("passenger"),
  async (req, res) => {
    try {
      const ride =
        await Ride.findById(
          req.params.id
        );

      // =================================================
      // VERIFY RIDE
      // =================================================

      if (
        !ride ||
        String(
          ride.passenger
        ) !==
          String(
            req.user.id
          )
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Ride not found.",
        });
      }

      // =================================================
      // COMPLETED ONLY
      // =================================================

      if (
        ride.status !==
        "completed"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Only completed rides can be rated.",
        });
      }

      // =================================================
      // PREVENT DOUBLE RATING
      // =================================================

      if (ride.rated) {
        return res.status(409).json({
          success: false,
          message:
            "Ride already rated.",
        });
      }

      // =================================================
      // VALIDATE RATING
      // =================================================

      const rating =
        Number(
          req.body.rating
        );

      if (
        !Number.isFinite(
          rating
        ) ||
        rating < 1 ||
        rating > 5
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Rating must be between 1 and 5.",
        });
      }

      // =================================================
      // DRIVER EXISTS
      // =================================================

      if (!ride.driver) {
        return res.status(400).json({
          success: false,
          message:
            "Ride has no driver.",
        });
      }

      const driver =
        await Driver.findById(
          ride.driver
        );

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver not found.",
        });
      }

      // =================================================
      // CALCULATE NEW RATING
      // =================================================

      const trips =
        Number(
          driver.trips || 0
        );

      const currentRating =
        Number(
          driver.rating || 5
        );

      driver.rating =
        (
          currentRating *
            trips +
          rating
        ) /
        (trips + 1);

      await driver.save();

      // =================================================
      // MARK RIDE RATED
      // =================================================

      ride.rated = true;

      await ride.save();

      return res.json({
        success: true,
        message:
          "Thanks for rating your driver.",
        rating:
          driver.rating,
      });
    } catch (error) {
      console.error(
        "RATING ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Unable to rate driver.",
      });
    }
  }
);

// ======================================================
// DRIVER LIVE LOCATION
// ======================================================

r.post(
  "/:id/location",
  auth,
  role("driver"),
  async (req, res) => {
    try {
      // =================================================
      // FIND DRIVER
      // =================================================

      const driver =
        await Driver.findOne({
          user:
            req.user.id,
        });

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver profile not found.",
        });
      }

      // =================================================
      // COORDINATES
      // =================================================

      const lat =
        Number(
          req.body.lat
        );

      const lng =
        Number(
          req.body.lng
        );

      if (
        !Number.isFinite(
          lat
        ) ||
        !Number.isFinite(
          lng
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid coordinates.",
        });
      }

      const updatedAt =
        new Date();

      // =================================================
      // UPDATE DRIVER LOCATION
      // =================================================

      driver.location = {
        lat,
        lng,
        updatedAt,
      };

      await driver.save();

      // =================================================
      // FIND CURRENT ACTIVE RIDE
      // =================================================

      const ride =
        await Ride.findOne({
          driver:
            driver._id,

          status: {
            $in:
              DRIVER_ACTIVE_RIDE_STATUSES,
          },
        }).sort({
          createdAt: -1,
        });

      // =================================================
      // UPDATE RIDE LOCATION
      // =================================================

      if (ride) {
        ride.driverLocation = {
          lat,
          lng,
          updatedAt,
        };

        await ride.save();

        const locationPayload =
          {
            driverId:
              String(
                driver._id
              ),

            rideId:
              String(
                ride._id
              ),

            lat,
            lng,

            updatedAt,
          };

        // ---------------------------------------------
        // GLOBAL
        // ---------------------------------------------

        emit(
          req,
          "driver:location",
          locationPayload
        );

        // ---------------------------------------------
        // RIDE ROOM
        // ---------------------------------------------

        req.app
          .get("io")
          ?.to(
            `ride:${ride._id}`
          )
          .emit(
            "driver:location",
            locationPayload
          );

        // ---------------------------------------------
        // PASSENGER
        // ---------------------------------------------

        req.app
          .get("io")
          ?.to(
            `user:${ride.passenger}`
          )
          .emit(
            "driver:location",
            locationPayload
          );

        // ---------------------------------------------
        // ADMIN
        // ---------------------------------------------

        req.app
          .get("io")
          ?.to("admins")
          .emit(
            "driver:location",
            locationPayload
          );
      }

      // =================================================
      // RESPONSE
      // =================================================

      return res.json({
        success: true,

        location: {
          lat,
          lng,
          updatedAt,
        },
      });
    } catch (error) {
      console.error(
        "DRIVER LOCATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Unable to update driver location.",
      });
    }
  }
);

export default r;