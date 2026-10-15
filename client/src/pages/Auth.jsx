import {

  useEffect,

  useState,

} from "react";

import {

  Link,

  useNavigate,

  useSearchParams,

} from "react-router-dom";

import {

  Car,

  Eye,

  EyeOff,

  Upload,

  ShieldCheck,

} from "lucide-react";

import { useAuth } from "../context/AuthContext";

export default function Auth() {

  const [params] = useSearchParams();

  const navigate = useNavigate();

  /* =========================================================

     AUTH MODE

  ========================================================= */

  const initialMode =

    params.get("mode") === "signup"

      ? "signup"

      : "signin";

  const initialRole =

    ["passenger", "driver"].includes(

      params.get("role")

    )

      ? params.get("role")

      : "passenger";

  const [mode, setMode] =

    useState(initialMode);

  const [role, setRole] =

    useState(initialRole);

  /* =========================================================

     UI STATE

  ========================================================= */

  const [showPassword, setShowPassword] =

    useState(false);

  const [error, setError] =

    useState("");

  const [busy, setBusy] =

    useState(false);

  /* =========================================================

     FORM STATE

  ========================================================= */

  const [form, setForm] = useState({

    name: "",

    email: "",

    phone: "",

    password: "",

    licenseNumber: "",

    vehicleMake: "",

    vehicleModel: "",

    vehicleColor: "",

    registration: "",

    idDocument: null,

    licenseDocument: null,

  });

  const {

    login,

    register,

  } = useAuth();

  /* =========================================================

     UPDATE MODE WHEN URL CHANGES

  ========================================================= */

  useEffect(() => {

    const urlMode =

      params.get("mode") === "signup"

        ? "signup"

        : "signin";

    const urlRole =

      ["passenger", "driver"].includes(

        params.get("role")

      )

        ? params.get("role")

        : "passenger";

    setMode(urlMode);

    setRole(urlRole);

  }, [params]);

  /* =========================================================

     FORM HELPER

  ========================================================= */

  const setField = (key, value) => {

    setForm((current) => ({

      ...current,

      [key]: value,

    }));

  };

  /* =========================================================

     REDIRECT AFTER LOGIN / REGISTRATION

  ========================================================= */

  const go = (user) => {

    if (!user) return;

    if (user.role === "admin") {

      navigate("/admin");

      return;

    }

    if (user.role === "driver") {

      navigate("/driver");

      return;

    }

    navigate("/dashboard");

  };

  /* =========================================================

     SWITCH AUTH MODE

  ========================================================= */

  const switchMode = (nextMode) => {

    setError("");

    setMode(nextMode);

    const roleParam =

      role ? `&role=${role}` : "";

    navigate(

      `/auth?mode=${nextMode}${roleParam}`,

      {

        replace: true,

      }

    );

  };

  /* =========================================================

     SUBMIT

  ========================================================= */

  const submit = async (event) => {

    event.preventDefault();

    setError("");

    setBusy(true);

    try {

      /* -----------------------------------------------

         SIGN IN

      ------------------------------------------------ */

      if (mode === "signin") {

        const user = await login({

          email: form.email.trim(),

          password: form.password,

        });

        go(user);

        return;

      }

      /* -----------------------------------------------

         SIGN UP

      ------------------------------------------------ */

      const formData = new FormData();

      // Public registration can only create passenger or driver accounts.
      const publicRole =
        role === "driver" ? "driver" : "passenger";

      Object.entries({
        ...form,
        role: publicRole,
      }).forEach(([key, value]) => {
        if (
          value !== null &&
          value !== undefined &&
          value !== ""
        ) {
          formData.append(key, value);
        }
      });

      const user = await register(

        formData

      );

      go(user);

    } catch (err) {

      console.error(

        "AUTH ERROR:",

        err

      );

      setError(

        err.response?.data?.message ||

          "Something went wrong. Please try again."

      );

    } finally {

      setBusy(false);

    }

  };

  /* =========================================================

     RENDER

  ========================================================= */

  return (

    <main className="authPage">

      {/* ===================================================

          AUTH PANEL

      =================================================== */}

      <div className="authPanel">

        {/* BRAND */}

        <Link

          className="brand authBrand"

          to="/"

        >

          <span>

            <Car />

          </span>

          Ride

          <span className="brandAccent">

            Flow

          </span>

        </Link>

        {/* =================================================

            HEADER

        ================================================= */}

        <div className="authTop">

          <div className="eyebrow">

            {mode === "signin"

              ? "WELCOME BACK"

              : "JOIN RIDEFLOW"}

          </div>

          <h1>

            {mode === "signin"

              ? "Ready for your next ride?"

              : "Start moving with RideFlow."}

          </h1>

          <p>

            {mode === "signin"

              ? "Sign in to continue."

              : "Create an account in a few steps."}

          </p>

        </div>

        {/* =================================================

            ROLE SELECTOR

        ================================================= */}

        {mode === "signup" && (

          <div className="seg">

            <button

              type="button"

              className={

                role === "passenger"

                  ? "active"

                  : ""

              }

              onClick={() => {

                setRole("passenger");

                setError("");

              }}

            >

              Passenger

            </button>

            <button

              type="button"

              className={

                role === "driver"

                  ? "active"

                  : ""

              }

              onClick={() => {

                setRole("driver");

                setError("");

              }}

            >

              Driver

            </button>

          </div>

        )}

        {/* =================================================

            FORM

        ================================================= */}

        <form

          className="authForm"

          onSubmit={submit}

        >

          {/* -----------------------------------------------

              NAME

          ------------------------------------------------ */}

          {mode === "signup" && (

            <>

              <input

                required

                type="text"

                placeholder="Full name"

                value={form.name}

                onChange={(e) =>

                  setField(

                    "name",

                    e.target.value

                  )

                }

              />

              <input

                type="tel"

                placeholder="Phone number"

                value={form.phone}

                onChange={(e) =>

                  setField(

                    "phone",

                    e.target.value

                  )

                }

              />

            </>

          )}

          {/* -----------------------------------------------

              EMAIL

          ------------------------------------------------ */}

          <input

            required

            type="email"

            placeholder="Email address"

            value={form.email}

            autoComplete="email"

            onChange={(e) =>

              setField(

                "email",

                e.target.value

              )

            }

          />

          {/* -----------------------------------------------

              PASSWORD

          ------------------------------------------------ */}

          <div className="passwordField">

            <input

              required

              minLength={8}

              type={

                showPassword

                  ? "text"

                  : "password"

              }

              placeholder="Password (8+ characters)"

              value={form.password}

              autoComplete={

                mode === "signin"

                  ? "current-password"

                  : "new-password"

              }

              onChange={(e) =>

                setField(

                  "password",

                  e.target.value

                )

              }

            />

            <button

              type="button"

              onClick={() =>

                setShowPassword(

                  (current) => !current

                )

              }

              aria-label={

                showPassword

                  ? "Hide password"

                  : "Show password"

              }

            >

              {showPassword ? (

                <EyeOff />

              ) : (

                <Eye />

              )}

            </button>

          </div>

          {/* =================================================

              FORGOT PASSWORD

          ================================================= */}

          {mode === "signin" && (

            <div className="forgotRow">

              <Link

                className="forgot"

                to="/forgot-password"

              >

                Forgot password?

              </Link>

            </div>

          )}

          {/* =================================================

              DRIVER APPLICATION

          ================================================= */}

          {mode === "signup" &&

            role === "driver" && (

              <>

                <div className="formSection">

                  <b>

                    Driver application

                  </b>

                  <small>

                    All documents are required

                    for verification.

                  </small>

                </div>

                {/* VEHICLE DETAILS */}

                <div className="twoCol">

                  <input

                    required

                    placeholder="Driver licence number"

                    value={

                      form.licenseNumber

                    }

                    onChange={(e) =>

                      setField(

                        "licenseNumber",

                        e.target.value

                      )

                    }

                  />

                  <input

                    required

                    placeholder="Vehicle registration"

                    value={

                      form.registration

                    }

                    onChange={(e) =>

                      setField(

                        "registration",

                        e.target.value

                      )

                    }

                  />

                  <input

                    required

                    placeholder="Vehicle make"

                    value={

                      form.vehicleMake

                    }

                    onChange={(e) =>

                      setField(

                        "vehicleMake",

                        e.target.value

                      )

                    }

                  />

                  <input

                    required

                    placeholder="Vehicle model"

                    value={

                      form.vehicleModel

                    }

                    onChange={(e) =>

                      setField(

                        "vehicleModel",

                        e.target.value

                      )

                    }

                  />

                  <input

                    required

                    placeholder="Vehicle colour"

                    value={

                      form.vehicleColor

                    }

                    onChange={(e) =>

                      setField(

                        "vehicleColor",

                        e.target.value

                      )

                    }

                  />

                </div>

                {/* DOCUMENT UPLOADS */}

                <div className="uploadGrid">

                  <label className="uploadBox">

                    <Upload />

                    <span>

                      {form.idDocument?.name ||

                        "Upload ID document"}

                    </span>

                    <small>

                      PDF, JPG, PNG • max 5MB

                    </small>

                    <input

                      required

                      type="file"

                      accept=".pdf,.jpg,.jpeg,.png,.webp"

                      onChange={(e) =>

                        setField(

                          "idDocument",

                          e.target.files?.[0] ||

                            null

                        )

                      }

                    />

                  </label>

                  <label className="uploadBox">

                    <Upload />

                    <span>

                      {form

                        .licenseDocument

                        ?.name ||

                        "Upload driver's licence"}

                    </span>

                    <small>

                      PDF, JPG, PNG • max 5MB

                    </small>

                    <input

                      required

                      type="file"

                      accept=".pdf,.jpg,.jpeg,.png,.webp"

                      onChange={(e) =>

                        setField(

                          "licenseDocument",

                          e.target.files?.[0] ||

                            null

                        )

                      }

                    />

                  </label>

                </div>

              </>

            )}

          {/* =================================================

              ERROR

          ================================================= */}

          {error && (

            <div className="error">

              {error}

            </div>

          )}

          {/* =================================================

              SUBMIT

          ================================================= */}

          <button

            disabled={busy}

            type="submit"

            className="btn primary full"

          >

            {busy

              ? "Please wait…"

              : mode === "signin"

              ? "Sign in"

              : role === "driver"

              ? "Submit driver application"

              : "Create passenger account"}

          </button>

        </form>

        {/* =================================================

            SWITCH SIGN IN / SIGN UP

        ================================================= */}

        <p className="switch">

          {mode === "signin"

            ? "Don't have an account?"

            : "Already have an account?"}

          {" "}

          <button

            type="button"

            onClick={() =>

              switchMode(

                mode === "signin"

                  ? "signup"

                  : "signin"

              )

            }

          >

            {mode === "signin"

              ? "Create one"

              : "Sign in"}

          </button>

        </p>

      </div>

      {/* ===================================================

          VISUAL PANEL

      =================================================== */}

      <div className="authVisual">

        <div className="authVisualMap">

          <div className="bigSA">

            SA

          </div>

          <div className="authCar">

            🚗

          </div>

          <div className="authCar car2">

            🚗

          </div>

        </div>

        <div className="authQuote">

          <ShieldCheck />

          <div>

            <b>

              Built around trust.

            </b>

            <span>

              Drivers are reviewed before

              they can go online.

            </span>

          </div>

        </div>

      </div>

    </main>

  );

}
