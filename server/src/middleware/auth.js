
import jwt from "jsonwebtoken";

/* =========================================================
   AUTHENTICATION MIDDLEWARE
========================================================= */

export function auth(req, res, next) {
  const authHeader =
    req.headers.authorization || "";

  /*
    RideFlow supports authentication through:

    1. HTTP-only access_token cookie
    2. Authorization: Bearer <token>
  */

  const token =
    req.cookies?.access_token ||
    (
      authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : ""
    );

  /* -------------------------------------------------------
     NO TOKEN
  ------------------------------------------------------- */

  if (!token) {
    return res.status(401).json({
      message:
        "Authentication required",
    });
  }

  /* -------------------------------------------------------
     VERIFY JWT
  ------------------------------------------------------- */

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    /*
      Continue to the protected route.
    */

    next();

  } catch (error) {
    console.error(
      "JWT ERROR:",
      error.message
    );

    return res.status(401).json({
      message:
        "Invalid or expired session",
    });
  }
}


/* =========================================================
   ROLE MIDDLEWARE
========================================================= */

export const role = (...roles) => {
  return (req, res, next) => {

    /* -----------------------------------------------------
       AUTHENTICATION CHECK
    ----------------------------------------------------- */

    if (!req.user) {
      return res.status(401).json({
        message:
          "Authentication required",
      });
    }

    /* -----------------------------------------------------
       ROLE CHECK
    ----------------------------------------------------- */

    if (
      !roles.includes(
        req.user.role
      )
    ) {
      return res.status(403).json({
        message:
          "Access denied",

        userRole:
          req.user.role,

        requiredRoles:
          roles,
      });
    }

    /* -----------------------------------------------------
       AUTHORIZED
    ----------------------------------------------------- */

    next();
  };
};

