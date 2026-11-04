import express from "express";

import {
  register,
  login,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp",verifyResetOTP);
router.post("/reset-password",resetPassword);
export default router;