
import { Router } from "express";
import crypto from "crypto";

import User from "../models/User.js";
import Driver from "../models/Driver.js";

import { auth } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

import {
  signUser,
  publicUser,
} from "../utils/token.js";

const r = Router();

/* =========================================================
   COOKIE CONFIGURATION
========================================================= */

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

/* =========================================================
   LOGIN RESPONSE
========================================================= */

const send = (res, user) => {
  return res
    .cookie(
      "access_token",
      signUser(user),
      cookieOptions
    )
    .json({
      user: publicUser(user),
    });
};

/* =========================================================
   REGISTER
========================================================= */

r.post(
  "/register",
  upload.fields([
    {
      name: "idDocument",
      maxCount: 1,
    },
    {
      name: "licenseDocument",
      maxCount: 1,
    },
  ]),
  async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        phone,
        role = "passenger",
        licenseNumber,
        vehicleMake,
        vehicleModel,
        vehicleColor,
        registration,
      } = req.body;

      /* -----------------------------------------------
         BASIC VALIDATION
      ------------------------------------------------ */

      if (!name || !email || !password) {
        return res.status(400).json({
          message: "Name, email and password are required.",
        });
      }

      if (String(password).length < 8) {
        return res.status(400).json({
          message: "Password must be at least 8 characters.",
        });
      }

      // Public registration cannot create admin accounts.
      if (!["passenger", "driver"].includes(role)) {
        return res.status(400).json({
          message: "Invalid role.",
        });
      }

      const normalizedEmail = String(email)
        .trim()
        .toLowerCase();

      /* -----------------------------------------------
         CHECK EXISTING USER
      ------------------------------------------------ */

      const existingUser = await User.findOne({
        email: normalizedEmail,
      });

      if (existingUser) {
        return res.status(409).json({
          message: "Email already registered.",
        });
      }

      /* -----------------------------------------------
         DRIVER DOCUMENT VALIDATION
      ------------------------------------------------ */

      if (
        role === "driver" &&
        (
          !req.files?.idDocument?.[0] ||
          !req.files?.licenseDocument?.[0]
        )
      ) {
        return res.status(400).json({
          message:
            "Driver applications require both ID and driver's licence uploads.",
        });
      }

      /* -----------------------------------------------
         CREATE USER
         
         IMPORTANT:
         User.js hashes the password in its pre-save hook.
         Pass the original password here.
         Do not hash it manually a second time.
      ------------------------------------------------ */

      const u = await User.create({
        name: String(name).trim(),
        email: normalizedEmail,
        phone: phone || "",
        password,
        role,
      });

      /* -----------------------------------------------
         CREATE DRIVER PROFILE
      ------------------------------------------------ */

      if (role === "driver") {
        await Driver.create({
          user: u._id,
          licenseNumber,
          vehicleMake,
          vehicleModel,
          vehicleColor,
          registration,

          idDocument:
            `/uploads/${req.files.idDocument[0].filename}`,

          licenseDocument:
            `/uploads/${req.files.licenseDocument[0].filename}`,
        });
      }

      /* -----------------------------------------------
         LOGIN AFTER REGISTRATION
      ------------------------------------------------ */

      return send(res, u);
    } catch (e) {
      console.error("REGISTER ERROR:", e);

      if (e.code === 11000) {
        return res.status(409).json({
          message: "Email already registered.",
        });
      }

      return res.status(500).json({
        message: "Registration failed.",
      });
    }
  }
);

/* =========================================================
   LOGIN
========================================================= */

r.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    /* -----------------------------------------------
       FIND USER
    ------------------------------------------------ */

    const u = await User.findOne({
      email,
    });

    /* -----------------------------------------------
       VERIFY PASSWORD
       
       Use the comparison method from User.js.
    ------------------------------------------------ */

    if (
      !u ||
      !(await u.comparePassword(password))
    ) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    /* -----------------------------------------------
       LOGIN SUCCESS
    ------------------------------------------------ */

    return send(res, u);
  } catch (e) {
    console.error("LOGIN ERROR:", e);

    return res.status(500).json({
      message: "Login failed.",
    });
  }
});

/* =========================================================
   CURRENT USER
========================================================= */

r.get("/me", auth, async (req, res) => {
  try {
    const u = await User.findById(req.user.id).select(
      "-password -resetToken -resetExpires"
    );

    if (!u) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const driver =
      u.role === "driver"
        ? await Driver.findOne({
            user: u._id,
          })
        : null;

    return res.json({
      user: publicUser(u),
      driver,
    });
  } catch (e) {
    console.error("GET CURRENT USER ERROR:", e);

    return res.status(500).json({
      message: "Unable to retrieve user.",
    });
  }
});

/* =========================================================
   LOGOUT
========================================================= */

r.post("/logout", (_, res) => {
  res.clearCookie("access_token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return res.json({
    message: "Logged out",
  });
});

/* =========================================================
   FORGOT PASSWORD
========================================================= */

r.post("/forgot-password", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({
        message: "Email address is required.",
      });
    }

    const u = await User.findOne({
      email,
    });

    // Avoid revealing whether an account exists.
    if (!u) {
      return res.json({
        message:
          "If that email exists, reset instructions have been created.",
      });
    }

    /* -----------------------------------------------
       GENERATE SECURE RESET TOKEN
    ------------------------------------------------ */

    const token = crypto
      .randomBytes(32)
      .toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    u.resetToken = hashedToken;

    u.resetExpires = new Date(
      Date.now() + 15 * 60 * 1000
    );

    await u.save();

    /* -----------------------------------------------
       CREATE RESET URL
    ------------------------------------------------ */

    const clientUrl =
      process.env.CLIENT_URL ||
      "http://localhost:5173";

    const resetUrl =
      `${clientUrl}/reset-password/${token}`;

    /* -----------------------------------------------
       DEVELOPMENT LOG
    ------------------------------------------------ */

    if (process.env.NODE_ENV !== "production") {
      console.log(
        "\n========================================"
      );

      console.log("RIDEFLOW PASSWORD RESET");
      console.log("Email:", email);
      console.log("Reset URL:", resetUrl);
      console.log(
        "Expires:",
        u.resetExpires.toISOString()
      );

      console.log(
        "========================================\n"
      );
    }

    const response = {
      message:
        "If that email exists, reset instructions have been created.",
    };

    // Never expose reset links in production responses.
    if (process.env.NODE_ENV !== "production") {
      response.devResetUrl = resetUrl;
    }

    return res.json(response);
  } catch (e) {
    console.error("FORGOT PASSWORD ERROR:", e);

    return res.status(500).json({
      message: "Unable to process password reset request.",
    });
  }
});

/* =========================================================
   RESET PASSWORD
========================================================= */

r.post("/reset-password/:token", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();

    const password = String(req.body.password || "");

    /* -----------------------------------------------
       VALIDATE TOKEN AND PASSWORD
    ------------------------------------------------ */

    if (!token) {
      return res.status(400).json({
        message: "Invalid password reset link.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters.",
      });
    }

    /* -----------------------------------------------
       HASH RESET TOKEN FOR DATABASE LOOKUP
    ------------------------------------------------ */

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    /* -----------------------------------------------
       FIND VALID RESET TOKEN
    ------------------------------------------------ */

    const u = await User.findOne({
      resetToken: hashedToken,
      resetExpires: {
        $gt: new Date(),
      },
    });

    if (!u) {
      return res.status(400).json({
        message: "This reset link is invalid or expired.",
      });
    }

    /* -----------------------------------------------
       UPDATE PASSWORD
       
       IMPORTANT:
       Assign the plain password.
       User.js hashes it when save() runs.
    ------------------------------------------------ */

    u.password = password;

    /* -----------------------------------------------
       INVALIDATE RESET TOKEN
    ------------------------------------------------ */

    u.resetToken = "";
    u.resetExpires = null;

    await u.save();

    /* -----------------------------------------------
       SUCCESS
    ------------------------------------------------ */

    return res.json({
      message:
        "Password reset successful. You can sign in now.",
    });
  } catch (e) {
    console.error("RESET PASSWORD ERROR:", e);

    return res.status(500).json({
      message: "Unable to reset password.",
    });
  }
});

export default r;
