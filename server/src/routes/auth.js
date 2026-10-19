
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

const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
  path: "/",
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

      // BASIC VALIDATION
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

      // CHECK EXISTING USER
      const existingUser = await User.findOne({
        email: normalizedEmail,
      });

      if (existingUser) {
        return res.status(409).json({
          message: "Email already registered.",
        });
      }

      // DRIVER DOCUMENT VALIDATION
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

      // CREATE USER
      // User.js handles password hashing.
      const u = await User.create({
        name: String(name).trim(),
        email: normalizedEmail,
        phone: phone || "",
        password,
        role,
      });

      // CREATE DRIVER PROFILE
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

      // LOGIN AFTER REGISTRATION
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

    // FIND USER
    const u = await User.findOne({
      email,
    });

    // VERIFY PASSWORD
    if (
      !u ||
      !(await u.comparePassword(password))
    ) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    // LOGIN SUCCESS
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
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    path: "/",
  });

  return res.json({
    message: "Logged out",
  });
});

/* =========================================================
   FORGOT PASSWORD
========================================================= */

/* =========================================================
   FORGOT PASSWORD + RESET PASSWORD
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

    const genericMessage =
      "If that email exists, password recovery instructions have been created.";

    const user = await User.findOne({ email });

    // Do not reveal whether an account exists.
    if (!user) {
      return res.json({ message: genericMessage });
    }

    const isDevelopment =
      process.env.NODE_ENV === "development";

    // Production requires email configuration.
    if (
      !isDevelopment &&
      (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    ) {
      console.error(
        "Password recovery unavailable: email service is not configured."
      );

      return res.status(503).json({
        message:
          "Password recovery is temporarily unavailable. Please try again later.",
      });
    }

    // Generate a secure, single-use token.
    const token = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    user.resetToken = hashedToken;
    user.resetExpires = new Date(
      Date.now() + 15 * 60 * 1000
    );

    await user.save();

    const clientUrl = (
      process.env.CLIENT_URL || "http://localhost:5173"
    ).replace(/\/+$/, "");

    const resetUrl =
      `${clientUrl}/reset-password/${token}`;

    // LOCAL DEVELOPMENT: no email provider required.
    if (isDevelopment) {
      console.log("Development password reset URL:", resetUrl);

      return res.json({
        message:
          "Reset link created. This development link expires in 15 minutes.",
        devResetUrl: resetUrl,
      });
    }

    // PRODUCTION: send the reset email through Resend.
    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;">
        <h1 style="color:#2563eb;">RideFlow</h1>
        <h2>Reset your password</h2>
        <p>Use the link below to reset your RideFlow password.</p>
        <p>This link expires in 15 minutes and can only be used once.</p>
        <p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#2563eb;color:white;padding:12px 20px;text-decoration:none;border-radius:8px;">
            Reset my password
          </a>
        </p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `;

    const emailResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: [email],
          subject: "Reset your RideFlow password",
          html: emailHtml,
          text: `Reset your RideFlow password using this link: ${resetUrl}\nThis link expires in 15 minutes.`,
        }),
      }
    );

    if (!emailResponse.ok) {
      const details = await emailResponse.text();

      console.error(
        "Resend password email error:",
        emailResponse.status,
        details
      );

      user.resetToken = "";
      user.resetExpires = null;
      await user.save();

      return res.status(503).json({
        message:
          "Unable to send reset instructions right now. Please try again later.",
      });
    }

    return res.json({ message: genericMessage });
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);

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
    const { token } = req.params;
    const password = String(req.body.password || "");

    if (!token) {
      return res.status(400).json({
        message: "Password reset token is required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters.",
      });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetToken: hashedToken,
      resetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        message: "This reset link is invalid or has expired.",
      });
    }

    // User.js should hash the password when saved.
    user.password = password;
    user.resetToken = "";
    user.resetExpires = null;

    await user.save();

    return res.json({
      message:
        "Password reset successfully. You can now sign in with your new password.",
    });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);

    return res.status(500).json({
      message: "Unable to reset your password.",
    });
  }
});

export default r;
