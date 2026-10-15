import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      default: "",
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["passenger", "driver", "admin"],
      default: "passenger",
    },

    avatar: {
      type: String,
      default: "",
    },

    resetToken: {
      type: String,
      default: "",
    },

    resetExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/*
|--------------------------------------------------------------------------
| Hash password before saving
|--------------------------------------------------------------------------
*/
schema.pre("save", async function (next) {
  /*
  |--------------------------------------------------------------------------
  | Only hash password when it has changed
  |--------------------------------------------------------------------------
  */
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);

    this.password = await bcrypt.hash(
      this.password,
      salt
    );

    next();
  } catch (error) {
    next(error);
  }
});

/*
|--------------------------------------------------------------------------
| Compare password
|--------------------------------------------------------------------------
*/
schema.methods.comparePassword = async function (
  enteredPassword
) {
  return bcrypt.compare(
    enteredPassword,
    this.password
  );
};

export default mongoose.model(
  "User",
  schema
);