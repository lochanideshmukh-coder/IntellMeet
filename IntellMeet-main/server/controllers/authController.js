import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import sendEmail from "../utils/sendEmail.js";

const createToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

// REGISTER
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email is already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    const token = createToken(user._id);

    return res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email is already registered",
      });
    }

    console.error("Registration error:", error);

    return res.status(500).json({
      message: "Registration failed",
    });
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = createToken(user._id);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Login failed",
    });
  }
};
// FORGOT PASSWORD - SEND OTP
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    });
    // Use the same response whether the email exists or not.
    if (!user) {
      return res.status(200).json({
        message: "If the account exists, an OTP has been sent.",
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();

    user.resetPasswordOTP = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    user.resetPasswordOTPExpiry = new Date(Date.now() + 10 * 60 * 1000);
    user.resetPasswordOTPAttempts = 0;

    await user.save();

    try {
      await sendEmail(
        user.email,
        "IntellMeet Password Reset OTP",
        `<h2>Password Reset</h2>
         <p>Your IntellMeet verification code is:</p>
         <h1>${otp}</h1>
         <p>This OTP expires in 10 minutes. Do not share it with anyone.</p>`
      );
    } catch (emailError) {
      user.resetPasswordOTP = undefined;
      user.resetPasswordOTPExpiry = undefined;
      user.resetPasswordOTPAttempts = 0;
      await user.save();

      throw emailError;
    }

    return res.status(200).json({
      message: "If the account exists, an OTP has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    return res.status(500).json({
      message: "Unable to process your request. Please try again.",
    });
  }
};
// VERIFY PASSWORD RESET OTP
export const verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select(
      "+resetPasswordOTP +resetPasswordOTPExpiry +resetPasswordOTPAttempts"
    );

    if (!user || !user.resetPasswordOTP) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    if (user.resetPasswordOTPExpiry < new Date()) {
      user.resetPasswordOTP = undefined;
      user.resetPasswordOTPExpiry = undefined;
      user.resetPasswordOTPAttempts = 0;
      await user.save();

      return res.status(400).json({
        message: "OTP has expired. Please request a new one.",
      });
    }

    if (user.resetPasswordOTPAttempts >= 5) {
      return res.status(429).json({
        message: "Too many attempts. Please request a new OTP.",
      });
    }

    const hashedOTP = crypto
      .createHash("sha256")
      .update(String(otp))
      .digest("hex");

    if (hashedOTP !== user.resetPasswordOTP) {
      user.resetPasswordOTPAttempts += 1;
      await user.save();

      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

// OTP is valid. Clear it so it cannot be reused.
user.resetPasswordOTP = undefined;
user.resetPasswordOTPExpiry = undefined;
user.resetPasswordOTPAttempts = 0;

const resetToken = jwt.sign(
  {
    id: user._id,
    purpose: "password-reset",
  },
  process.env.JWT_SECRET,
  { expiresIn: "10m" }
);

// Store only the hash of the reset token.
user.resetPasswordTokenHash = crypto
  .createHash("sha256")
  .update(resetToken)
  .digest("hex");

await user.save();

return res.status(200).json({
  message: "OTP verified successfully",
  resetToken,
});
  } catch (error) {
    console.error("OTP verification error:", error);

    return res.status(500).json({
      message: "OTP verification failed",
    });
  }
};
// RESET PASSWORD
export const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        message: "Reset token and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters",
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        message: "Invalid or expired reset token",
      });
    }

    if (decoded.purpose !== "password-reset") {
      return res.status(401).json({
        message: "Invalid reset token",
      });
    }

   const user = await User.findById(decoded.id).select(
      "+password +resetPasswordTokenHash"
    );

    if (!user || !user.resetPasswordTokenHash) {
      return res.status(401).json({
        message: "Invalid or already used reset token",
      });
    }

    const submittedTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    if (submittedTokenHash !== user.resetPasswordTokenHash) {
      return res.status(401).json({
        message: "Invalid or already used reset token",
      });
  }

    user.password = await bcrypt.hash(newPassword, 12);
    user.resetPasswordTokenHash = undefined;

    await user.save();

    return res.status(200).json({
      message: "Password reset successful. Please log in again.",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    return res.status(500).json({
      message: "Password reset failed",
    });
  }
};