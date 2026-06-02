import User from "../models/User.js";
import {
  generateToken,
  generateVerificationToken,
  generateResetToken,
} from "../utils/tokenUtils.js";
import {
  sendEmail,
  verificationEmailTemplate,
  resetPasswordTemplate,
  passwordChangedTemplate,
} from "../services/emailService.js";
import { validationResult } from "express-validator"; // Add this for validation

// Helper function to safely send emails (won't crash if email fails)
const safeSendEmail = async (to, subject, html, res = null) => {
  try {
    await sendEmail(to, subject, html);
    return true;
  } catch (error) {
    console.error(`⚠️ Email sending failed to ${to}:`, error.message);
    
    // In development, just log the email content
    if (process.env.NODE_ENV !== 'production') {
      console.log('📧 ========== EMAIL CONTENT ==========');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('HTML Preview:', html.substring(0, 200) + '...');
      console.log('=====================================');
    }
    
    return false;
  }
};

// ==================== REGISTER API ====================
export const register = async (req, res, next) => {
  try {
    // ✅ FIX 1: Add validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array()
      });
    }

    const { fullName, email, password } = req.body;

    // ✅ FIX 2: Check required fields
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email and password are required"
      });
    }

    // ✅ FIX 3: Check password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Create verification token
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await User.create({
      fullName,
      email,
      password,
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpiry: verificationTokenExpiry,
      isEmailVerified: false, // ✅ FIX 4: Explicitly set
      status: "active", // ✅ FIX 5: Explicitly set
    });

    // Send verification email
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${verificationToken}`;
    
    const emailSent = await safeSendEmail(
      email,
      "Email Verification - Inventory Management System",
      verificationEmailTemplate(fullName, verificationLink),
      res
    );

    const responseData = {
      success: true,
      message: "User registered successfully. Please verify your email.",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    };

    if (!emailSent && process.env.NODE_ENV !== 'production') {
      responseData.warning = "Email not sent (development mode). Use this token for verification:";
      responseData.devVerificationLink = verificationLink;
      responseData.devToken = verificationToken;
    }

    res.status(201).json(responseData);
  } catch (error) {
    console.error("REGISTER ERROR =>", error);
    
    // ✅ FIX 6: Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already exists"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed",
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    });
  }
};

// ==================== VERIFY EMAIL API ====================
export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    // ✅ FIX 7: Check if token exists
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
      });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    // ✅ FIX 8: Check if already verified
    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified",
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpiry = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("VERIFY EMAIL ERROR =>", error);
    res.status(500).json({
      success: false,
      message: "Email verification failed",
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    });
  }
};

// ==================== LOGIN API ====================
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // ✅ FIX 9: Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in",
      });
    }

    // Check if user is active
    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Please contact support.",
      });
    }

    const isPasswordCorrect = await user.matchPassword(password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // ✅ FIX 10: Set HTTP-only cookie for better security
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      token, // Also send in response for mobile apps
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR =>", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    });
  }
};

// ==================== FORGOT PASSWORD API ====================
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // ✅ FIX 11: Don't reveal if user exists for security
      return res.status(200).json({
        success: true,
        message: "If your email is registered, you will receive a password reset link",
      });
    }

    // ✅ FIX 12: Check if user is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email first",
      });
    }

    const resetToken = generateResetToken();
    const resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    user.resetPasswordToken = resetToken;
    user.resetPasswordTokenExpiry = resetTokenExpiry;
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
    
    const emailSent = await safeSendEmail(
      email,
      "Password Reset - Inventory Management System",
      resetPasswordTemplate(user.fullName, resetLink),
      res
    );

    const responseData = {
      success: true,
      message: "If your email is registered, you will receive a password reset link",
    };

    if (!emailSent && process.env.NODE_ENV !== 'production') {
      responseData.warning = "Email not sent (development mode)";
      responseData.devResetLink = resetLink;
      responseData.devToken = resetToken;
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR =>", error);
    res.status(500).json({
      success: false,
      message: "Forgot password request failed",
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    });
  }
};

// ==================== RESET PASSWORD API ====================
export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Token and new password are required",
      });
    }

    // ✅ FIX 13: Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpiry = undefined;
    await user.save();

    // Send confirmation email (don't wait for it)
    safeSendEmail(
      user.email,
      "Password Changed - Inventory Management System",
      passwordChangedTemplate(user.fullName),
      res
    ).catch(err => console.error("Confirmation email failed:", err.message));

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("RESET PASSWORD ERROR =>", error);
    res.status(500).json({
      success: false,
      message: "Password reset failed",
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    });
  }
};

// ==================== GET PROFILE API ====================
export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("-password"); // ✅ FIX 14: Exclude password

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("GET PROFILE ERROR =>", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    });
  }
};

// ==================== UPDATE PROFILE API ====================
export const updateProfile = async (req, res, next) => {
  try {
    const { fullName, avatar } = req.body;

    // ✅ FIX 15: Only update allowed fields
    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (avatar) updateData.avatar = avatar;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("UPDATE PROFILE ERROR =>", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    });
  }
};

// ==================== CHANGE PASSWORD API ====================
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // ✅ FIX 16: Validate inputs
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    // ✅ FIX 17: Check if new password is different from current
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    const user = await User.findById(req.userId).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isPasswordCorrect = await user.matchPassword(currentPassword);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword;
    await user.save();

    // Send confirmation email (async, don't await)
    safeSendEmail(
      user.email,
      "Password Changed - Inventory Management System",
      passwordChangedTemplate(user.fullName),
      res
    ).catch(err => console.error("Confirmation email failed:", err.message));

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("CHANGE PASSWORD ERROR =>", error);
    res.status(500).json({
      success: false,
      message: "Failed to change password",
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    });
  }
};

// ==================== LOGOUT API (NEW) ====================
export const logout = async (req, res, next) => {
  try {
    res.clearCookie('token');
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};