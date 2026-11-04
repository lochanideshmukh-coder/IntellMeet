import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
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

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    resetPasswordOTP: {
      type: String,
      select: false,
    },

    resetPasswordOTPExpiry: {
      type: Date,
      select: false,
    },

    resetPasswordOTPAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    resetPasswordTokenHash: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;