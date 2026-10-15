
import { Link } from "react-router-dom";
import {
  Car,
  UserRound,
  CarFront,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export default function GetStarted() {
  return (
    <main className="startPage">
      <div className="startHero">
        <div className="eyebrow">WELCOME TO RIDEFLOW</div>

        <h1>
          How do you want
          <br />
          <em>to use RideFlow?</em>
        </h1>

        <p>
          Choose your experience. You can create a passenger account or
          apply to become a verified driver.
        </p>
      </div>

      <div className="roleGrid">
        {/* SIGN IN */}
        <Link
          to="/auth?mode=signin"
          className="roleCard"
        >
          <div className="roleIcon">
            <UserRound />
          </div>

          <div>
            <small>ALREADY HAVE AN ACCOUNT?</small>

            <h2>Sign in</h2>

            <p>
              Continue to your passenger, driver or admin dashboard.
            </p>
          </div>

          <ArrowRight />
        </Link>

        {/* PASSENGER */}
        <Link
          to="/auth?mode=signup&role=passenger"
          className="roleCard featured"
        >
          <div className="roleIcon">
            <Car />
          </div>

          <div>
            <small>PASSENGER</small>

            <h2>Create passenger account</h2>

            <p>
              Book rides, see upfront fares and track your driver live.
            </p>
          </div>

          <ArrowRight />
        </Link>

        {/* DRIVER */}
        <Link
          to="/auth?mode=signup&role=driver"
          className="roleCard"
        >
          <div className="roleIcon">
            <CarFront />
          </div>

          <div>
            <small>DRIVER APPLICATION</small>

            <h2>Become a driver</h2>

            <p>
              Apply to drive, upload your required documents and get
              verified by RideFlow administrators.
            </p>
          </div>

          <ArrowRight />
        </Link>
      </div>

      <div className="securityNote">
        <ShieldCheck />

        <span>
          Your documents are securely handled and only available to
          authorised RideFlow administrators for application review.
        </span>
      </div>
    </main>
  );
}

