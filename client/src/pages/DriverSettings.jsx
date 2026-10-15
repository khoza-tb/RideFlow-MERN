import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  User,
  Phone,
  Mail,
  Car,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import api from "../services/api";

export default function DriverSettings() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleColor: "",
    registration: "",
    licenseNumber: "",
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/drivers/profile");

      const driver = res.data?.driver || res.data || {};
      const user = driver.user || {};

      setForm({
        name: user.name || driver.name || "",
        phone: user.phone || driver.phone || "",
        email: user.email || driver.email || "",
        vehicleMake: driver.vehicleMake || "",
        vehicleModel: driver.vehicleModel || "",
        vehicleColor: driver.vehicleColor || "",
        registration: driver.registration || "",
        licenseNumber: driver.licenseNumber || "",
      });
    } catch (err) {
      console.error("LOAD PROFILE ERROR:", err);

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Unable to load your profile."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setSuccess("");
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.patch("/drivers/settings", form);

      setSuccess("Your profile has been updated successfully.");

      setTimeout(() => {
        navigate("/driver/profile");
      }, 1000);
    } catch (err) {
      console.error("UPDATE PROFILE ERROR:", err);

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Unable to update your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="verificationPage profilePage">
        <div className="verificationLoading">
          <div className="verificationSpinner" />
          <p>Loading profile settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="verificationPage profilePage">
      <div className="verificationContainer">

        {/* HEADER */}
        <div className="verificationTitleRow">

          <div>
            <button
              type="button"
              className="verificationBack"
              onClick={() => navigate("/driver/profile")}
            >
              <ArrowLeft size={16} />
              Back to Profile
            </button>

            <div className="profileHeading">

              <div className="profileHeadingIcon">
                <User size={21} />
              </div>

              <div>
                <h1>Edit Profile</h1>

                <p>
                  Update your RideFlow driver profile
                  and vehicle information.
                </p>
              </div>

            </div>
          </div>

          <div className="profileSettingsBadge">
            <ShieldCheck size={15} />
            Driver Account
          </div>

        </div>

        {/* ALERTS */}
        {error && (
          <div className="profileFormAlert error">
            <AlertCircle size={19} />

            <div>
              <strong>
                Unable to update profile
              </strong>

              <p>{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="profileFormAlert success">
            <CheckCircle2 size={19} />

            <div>
              <strong>
                Profile Updated
              </strong>

              <p>{success}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* PERSONAL INFORMATION */}
          <section className="verificationPanel">

            <div className="verificationPanelHeader">

              <div>
                <h2>
                  <User size={17} />
                  Personal Information
                </h2>

                <p>
                  Update your account and contact
                  information.
                </p>
              </div>

            </div>

            <div className="profileEditGrid">

              <FormField
                label="Full Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                icon={<User size={16} />}
                placeholder="Enter your full name"
              />

              <FormField
                label="Phone Number"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                icon={<Phone size={16} />}
                placeholder="Enter your phone number"
              />

              <FormField
                label="Email Address"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                icon={<Mail size={16} />}
                placeholder="Enter your email address"
              />

              <FormField
                label="Driver License Number"
                name="licenseNumber"
                value={form.licenseNumber}
                onChange={handleChange}
                icon={<ShieldCheck size={16} />}
                placeholder="Enter your license number"
              />

            </div>

          </section>

          {/* VEHICLE INFORMATION */}
          <section className="verificationPanel">

            <div className="verificationPanelHeader">

              <div>
                <h2>
                  <Car size={17} />
                  Vehicle Information
                </h2>

                <p>
                  Update the vehicle registered to your
                  RideFlow driver account.
                </p>
              </div>

            </div>

            <div className="profileEditGrid">

              <FormField
                label="Vehicle Make"
                name="vehicleMake"
                value={form.vehicleMake}
                onChange={handleChange}
                icon={<Car size={16} />}
                placeholder="e.g. Toyota"
              />

              <FormField
                label="Vehicle Model"
                name="vehicleModel"
                value={form.vehicleModel}
                onChange={handleChange}
                icon={<Car size={16} />}
                placeholder="e.g. Corolla"
              />

              <FormField
                label="Vehicle Color"
                name="vehicleColor"
                value={form.vehicleColor}
                onChange={handleChange}
                icon={<Car size={16} />}
                placeholder="e.g. White"
              />

              <FormField
                label="Registration"
                name="registration"
                value={form.registration}
                onChange={handleChange}
                icon={<Car size={16} />}
                placeholder="e.g. ABC 123 GP"
              />

            </div>

          </section>

          {/* ACCOUNT SECURITY */}
          <section className="verificationPanel">

            <div className="verificationPanelHeader">

              <div>
                <h2>
                  <Lock size={17} />
                  Account Security
                </h2>

                <p>
                  Manage your account security and
                  verification information.
                </p>
              </div>

            </div>

            <div className="profileSecurityCard">

              <div className="profileSecurityIcon">
                <ShieldCheck size={20} />
              </div>

              <div>
                <strong>
                  Driver verification
                </strong>

                <p>
                  Your identity and vehicle documents
                  are managed separately through the
                  verification dashboard.
                </p>
              </div>

              <button
                type="button"
                className="profileSecondaryButton"
                onClick={() =>
                  navigate("/driver/verification")
                }
              >
                Manage Verification
              </button>

            </div>

          </section>

          {/* SAVE ACTIONS */}
          <section className="profileEditActions">

            <button
              type="button"
              className="profileCancelButton"
              onClick={() =>
                navigate("/driver/profile")
              }
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="profileSaveButton"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="profileButtonSpinner" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Changes
                </>
              )}
            </button>

          </section>

        </form>

        {/* NOTICE */}
        <div className="verificationNotice profileNotice">

          <ShieldCheck size={20} />

          <div>
            <strong>
              Keep your information up to date
            </strong>

            <p>
              Accurate profile and vehicle information
              helps RideFlow maintain a reliable driver
              network and provide better ride services.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  icon,
  placeholder,
  type = "text",
}) {
  return (
    <div className="profileFormField">

      <label htmlFor={name}>
        {label}
      </label>

      <div className="profileInputWrapper">

        <span className="profileInputIcon">
          {icon}
        </span>

        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="off"
        />

      </div>

    </div>
  );
}