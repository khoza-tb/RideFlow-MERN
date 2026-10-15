import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  Edit3,
  FileText,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";

import api from "../services/api";

export default function DriverProfile() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/drivers/profile");

      console.log("DRIVER PROFILE RESPONSE:", res.data);

      setProfile(res.data?.driver || res.data);
    } catch (err) {
      console.error("PROFILE ERROR:", err);

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Unable to load your profile."
      );
    } finally {
      setLoading(false);
    }
  }

  const user = profile?.user || {};

  const driverName =
    user?.name ||
    profile?.name ||
    "Driver";

  const phone =
    user?.phone ||
    profile?.phone ||
    "Not provided";

  const email =
    user?.email ||
    profile?.email ||
    "Not provided";

  const vehicleMake =
    profile?.vehicleMake ||
    "Not provided";

  const vehicleModel =
    profile?.vehicleModel ||
    "Not provided";

  const vehicleColor =
    profile?.vehicleColor ||
    "Not provided";

  const registration =
    profile?.registration ||
    "Not provided";

  const licenseNumber =
    profile?.licenseNumber ||
    "Not provided";

  const applicationStatus =
    profile?.applicationStatus ||
    "pending";

  const verified =
    profile?.verified === true ||
    applicationStatus === "approved";

  const rating =
    profile?.rating !== undefined
      ? Number(profile.rating).toFixed(1)
      : "5.0";

  const location =
    profile?.location || {};

  /*
   * DOCUMENT DETECTION
   *
   * The backend currently returns:
   *
   * idDocument
   * licenseDocument
   *
   * The profile also supports the alternative names
   * in case the remaining document fields use them.
   */

  const documentData =
    profile?.documents ||
    profile?.verificationDocuments ||
    {};

  const hasDocument = (...values) => {
    return values.some((value) => {
      if (!value) return false;

      if (typeof value === "string") {
        return value.trim().length > 0;
      }

      if (typeof value === "object") {
        return Object.keys(value).length > 0;
      }

      return Boolean(value);
    });
  };

  const documents = {
    idDocument: hasDocument(
      profile?.idDocument,
      documentData?.idDocument,
      documentData?.identityDocument,
      profile?.identityDocument
    ),

    driverLicense: hasDocument(
      profile?.driverLicense,
      profile?.licenseDocument,
      documentData?.driverLicense,
      documentData?.licenseDocument,
      documentData?.license,
      documentData?.driverLicenseDocument,
      profile?.license
    ),

    vehicleRegistration: hasDocument(
      profile?.vehicleRegistration,
      profile?.vehicleRegistrationDocument,
      documentData?.vehicleRegistration,
      documentData?.vehicleRegistrationDocument,
      documentData?.registration,
      profile?.registrationDocument
    ),

    vehicleProof: hasDocument(
      profile?.vehicleProof,
      profile?.vehicleProofDocument,
      documentData?.vehicleProof,
      documentData?.vehicleProofDocument,
      documentData?.proofOfVehicle,
      profile?.proofOfVehicle
    ),
  };

  const uploadedDocuments =
    Object.values(documents).filter(Boolean).length;

  const totalDocuments = 4;

  if (loading) {
    return (
      <div className="verificationPage profilePage">
        <div className="verificationLoading">
          <div className="verificationSpinner" />
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="verificationPage profilePage">
        <div className="verificationContainer">

          <button
            className="verificationBack"
            onClick={() => navigate("/driver")}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>

          <div className="verificationError">
            <XCircle size={22} />

            <div>
              <strong>
                Unable to load profile
              </strong>

              <p>{error}</p>
            </div>

            <button onClick={loadProfile}>
              Try Again
            </button>
          </div>

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
              className="verificationBack"
              onClick={() => navigate("/driver")}
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </button>

            <div className="profileHeading">

              <div className="profileHeadingIcon">
                <User size={21} />
              </div>

              <div>
                <h1>My Profile</h1>

                <p>
                  View and manage your RideFlow driver
                  profile information.
                </p>
              </div>

            </div>

          </div>

          <button
            className="profileEditButton"
            onClick={() =>
              navigate("/driver/settings")
            }
          >
            <Edit3 size={15} />
            Edit Profile
          </button>

        </div>

        {/* PROFILE SUMMARY */}
        <section className="verificationSummaryCard profileSummaryCard">

          <div className="profileAvatar">
            <User size={30} />
          </div>

          <div className="profileSummaryInfo">

            <div className="profileNameRow">

              <h2>{driverName}</h2>

              {verified ? (
                <span className="profileVerified">
                  <CheckCircle2 size={13} />
                  Verified Driver
                </span>
              ) : (
                <span className="profilePending">
                  Pending Verification
                </span>
              )}

            </div>

            <p>
              RideFlow Driver
            </p>

            <div className="profileContact">

              <span>
                <Phone size={13} />
                {phone}
              </span>

              <span>
                <Mail size={13} />
                {email}
              </span>

            </div>

          </div>

          <div className="profileRating">

            <span>Driver Rating</span>

            <strong>
              ★ {rating}
            </strong>

          </div>

        </section>

        {/* PERSONAL INFORMATION */}
        <section className="verificationPanel">

          <div className="verificationPanelHeader">

            <div>

              <h2>
                <User size={17} />
                Personal Information
              </h2>

              <p>
                Your account and contact information.
              </p>

            </div>

          </div>

          <div className="driverInfoGrid profileInfoGrid">

            <InfoItem
              label="Full Name"
              value={driverName}
            />

            <InfoItem
              label="Phone Number"
              value={phone}
            />

            <InfoItem
              label="Email Address"
              value={email}
            />

            <InfoItem
              label="Driver License Number"
              value={licenseNumber}
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
                Details about your registered RideFlow
                vehicle.
              </p>

            </div>

          </div>

          <div className="driverInfoGrid profileInfoGrid">

            <InfoItem
              label="Vehicle Make"
              value={vehicleMake}
            />

            <InfoItem
              label="Vehicle Model"
              value={vehicleModel}
            />

            <InfoItem
              label="Vehicle Color"
              value={vehicleColor}
            />

            <InfoItem
              label="Registration"
              value={registration}
            />

          </div>

        </section>

        {/* DRIVER STATUS */}
        <section className="verificationPanel">

          <div className="verificationPanelHeader">

            <div>

              <h2>
                <ShieldCheck size={17} />
                Driver Status
              </h2>

              <p>
                Your current RideFlow driver account
                status.
              </p>

            </div>

          </div>

          <div className="profileStatusGrid">

            <StatusBox
              label="Application Status"
              value={applicationStatus}
              type={
                applicationStatus === "approved"
                  ? "success"
                  : applicationStatus === "rejected"
                  ? "danger"
                  : "pending"
              }
            />

            <StatusBox
              label="Verification"
              value={
                verified
                  ? "Verified"
                  : "Not Verified"
              }
              type={
                verified
                  ? "success"
                  : "pending"
              }
            />

            <StatusBox
              label="Current Location"
              value={
                location?.lat !== undefined &&
                location?.lng !== undefined
                  ? "Location Active"
                  : "Not Available"
              }
              type={
                location?.lat !== undefined &&
                location?.lng !== undefined
                  ? "success"
                  : "neutral"
              }
            />

          </div>

        </section>

        {/* DOCUMENTS */}
        <section className="verificationPanel">

          <div className="verificationPanelHeader">

            <div>

              <h2>
                <FileText size={17} />
                Verification Documents
              </h2>

              <p>
                Your required driver verification
                documents.
              </p>

            </div>

            <span className="profileDocumentCount">
              {uploadedDocuments}/{totalDocuments}
              {" "}uploaded
            </span>

          </div>

          <div className="profileDocumentsGrid">

            <DocumentStatus
              icon={<User size={17} />}
              label="Identity Document"
              uploaded={documents.idDocument}
            />

            <DocumentStatus
              icon={<ShieldCheck size={17} />}
              label="Driver License"
              uploaded={documents.driverLicense}
            />

            <DocumentStatus
              icon={<FileText size={17} />}
              label="Vehicle Registration"
              uploaded={documents.vehicleRegistration}
            />

            <DocumentStatus
              icon={<Car size={17} />}
              label="Vehicle Proof"
              uploaded={documents.vehicleProof}
            />

          </div>

          <button
            className="profileVerificationButton"
            onClick={() =>
              navigate("/driver/verification")
            }
          >
            <FileText size={15} />
            Manage Verification Documents
          </button>

        </section>

        {/* LOCATION */}
        <section className="verificationPanel">

          <div className="verificationPanelHeader">

            <div>

              <h2>
                <MapPin size={17} />
                Driver Location
              </h2>

              <p>
                Your latest registered driver location.
              </p>

            </div>

          </div>

          <div className="profileLocationCard">

            <div className="profileLocationIcon">
              <MapPin size={20} />
            </div>

            <div>

              <strong>
                {location?.lat !== undefined &&
                location?.lng !== undefined
                  ? "Location available"
                  : "Location unavailable"}
              </strong>

              <p>
                {location?.lat !== undefined &&
                location?.lng !== undefined
                  ? `${Number(location.lat).toFixed(5)}, ${Number(
                      location.lng
                    ).toFixed(5)}`
                  : "Your driver location has not been detected yet."}
              </p>

            </div>

          </div>

        </section>

        {/* SECURITY NOTICE */}
        <div className="verificationNotice profileNotice">

          <ShieldCheck size={20} />

          <div>

            <strong>
              Your information is protected
            </strong>

            <p>
              RideFlow uses your profile information
              for account management, driver verification
              and ride services.
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="driverInfoItem">

      <span>{label}</span>

      <strong>
        {value || "Not provided"}
      </strong>

    </div>
  );
}

function StatusBox({
  label,
  value,
  type,
}) {
  return (
    <div className={`profileStatusBox ${type}`}>

      <small>{label}</small>

      <strong>
        {value}
      </strong>

    </div>
  );
}

function DocumentStatus({
  icon,
  label,
  uploaded,
}) {
  return (
    <div className="profileDocument">

      <div className="profileDocumentIcon">
        {icon}
      </div>

      <div className="profileDocumentInfo">

        <strong>
          {label}
        </strong>

        <span>
          {uploaded
            ? "Document uploaded"
            : "Document not uploaded"}
        </span>

      </div>

      {uploaded ? (
        <CheckCircle2
          size={17}
          className="profileDocumentSuccess"
        />
      ) : (
        <XCircle
          size={17}
          className="profileDocumentMissing"
        />
      )}

    </div>
  );
}