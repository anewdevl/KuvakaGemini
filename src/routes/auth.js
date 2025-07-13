const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { body, validationResult } = require("express-validator")
const { query } = require("../config/database")
const { generateOTP, sendOTP } = require("../services/otpService")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// Validation middleware
const validateSignup = [
  body("mobile_number")
    .isMobilePhone()
    .withMessage("Valid mobile number is required"),
  body("name")
    .optional()
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters"),
  body("email").optional().isEmail().withMessage("Valid email is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
]

const validateSendOTP = [
  body("mobile_number")
    .isMobilePhone()
    .withMessage("Valid mobile number is required"),
]

const validateVerifyOTP = [
  body("mobile_number")
    .isMobilePhone()
    .withMessage("Valid mobile number is required"),
  body("otp").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
]

const validateChangePassword = [
  body("current_password")
    .notEmpty()
    .withMessage("Current password is required"),
  body("new_password")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters"),
]

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    })
  }
  next()
}

// POST /auth/signup
router.post(
  "/signup",
  validateSignup,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { mobile_number, name, email, password } = req.body

      // Check if user already exists
      const existingUser = await query(
        "SELECT id FROM users WHERE mobile_number = $1",
        [mobile_number]
      )

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "User with this mobile number already exists",
        })
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12)

      // Create user
      const result = await query(
        `INSERT INTO users (mobile_number, name, email, password_hash) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, mobile_number, name, email, subscription_tier`,
        [mobile_number, name, email, passwordHash]
      )

      const user = result.rows[0]

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: {
            id: user.id,
            mobile_number: user.mobile_number,
            name: user.name,
            email: user.email,
            subscription_tier: user.subscription_tier,
          },
        },
      })
    } catch (error) {
      console.error("Signup error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  }
)

// POST /auth/send-otp
router.post(
  "/send-otp",
  validateSendOTP,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { mobile_number } = req.body

      // Generate OTP
      const otp = generateOTP()
      const expiresAt = new Date(
        Date.now() + parseInt(process.env.OTP_EXPIRY_MINUTES || 10) * 60 * 1000
      )

      // Store OTP in database
      await query(
        `INSERT INTO otps (mobile_number, otp_code, expires_at) 
       VALUES ($1, $2, $3)`,
        [mobile_number, otp, expiresAt]
      )

      // In a real application, you would send this via SMS
      // For this assignment, we return it in the response
      res.status(200).json({
        success: true,
        message: "OTP sent successfully",
        data: {
          mobile_number,
          otp, // In production, remove this
          expires_in: parseInt(process.env.OTP_EXPIRY_MINUTES || 10) * 60,
        },
      })
    } catch (error) {
      console.error("Send OTP error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  }
)

// POST /auth/verify-otp
router.post(
  "/verify-otp",
  validateVerifyOTP,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { mobile_number, otp } = req.body

      // Find valid OTP
      const otpResult = await query(
        `SELECT * FROM otps 
       WHERE mobile_number = $1 
       AND otp_code = $2 
       AND expires_at > NOW() 
       AND used = FALSE 
       ORDER BY created_at DESC 
       LIMIT 1`,
        [mobile_number, otp]
      )

      if (otpResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired OTP",
        })
      }

      // Mark OTP as used
      await query("UPDATE otps SET used = TRUE WHERE id = $1", [
        otpResult.rows[0].id,
      ])

      // Get or create user
      let userResult = await query(
        "SELECT id, mobile_number, name, email, subscription_tier FROM users WHERE mobile_number = $1",
        [mobile_number]
      )

      let user
      if (userResult.rows.length === 0) {
        // Create new user if doesn't exist
        const newUserResult = await query(
          `INSERT INTO users (mobile_number) 
         VALUES ($1) 
         RETURNING id, mobile_number, name, email, subscription_tier`,
          [mobile_number]
        )
        user = newUserResult.rows[0]
      } else {
        user = userResult.rows[0]
      }

      // Generate JWT token
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      })

      res.status(200).json({
        success: true,
        message: "OTP verified successfully",
        data: {
          token,
          user: {
            id: user.id,
            mobile_number: user.mobile_number,
            name: user.name,
            email: user.email,
            subscription_tier: user.subscription_tier,
          },
        },
      })
    } catch (error) {
      console.error("Verify OTP error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  }
)

// POST /auth/forgot-password
router.post(
  "/forgot-password",
  validateSendOTP,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { mobile_number } = req.body

      // Check if user exists
      const userResult = await query(
        "SELECT id FROM users WHERE mobile_number = $1",
        [mobile_number]
      )

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        })
      }

      // Generate OTP
      const otp = generateOTP()
      const expiresAt = new Date(
        Date.now() + parseInt(process.env.OTP_EXPIRY_MINUTES || 10) * 60 * 1000
      )

      // Store OTP in database
      await query(
        `INSERT INTO otps (mobile_number, otp_code, expires_at) 
       VALUES ($1, $2, $3)`,
        [mobile_number, otp, expiresAt]
      )

      res.status(200).json({
        success: true,
        message: "Password reset OTP sent successfully",
        data: {
          mobile_number,
          otp, // In production, remove this
          expires_in: parseInt(process.env.OTP_EXPIRY_MINUTES || 10) * 60,
        },
      })
    } catch (error) {
      console.error("Forgot password error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  }
)

// POST /auth/change-password (requires authentication)
router.post(
  "/change-password",
  authenticateToken,
  validateChangePassword,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { current_password, new_password } = req.body
      const userId = req.user.id

      // Get user with password hash
      const userResult = await query(
        "SELECT password_hash FROM users WHERE id = $1",
        [userId]
      )

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        })
      }

      const user = userResult.rows[0]

      // Check if user has a password (might not if they only used OTP login)
      if (!user.password_hash) {
        return res.status(400).json({
          success: false,
          message: "No password set for this account. Use OTP login instead.",
        })
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(
        current_password,
        user.password_hash
      )
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect",
        })
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(new_password, 12)

      // Update password
      await query("UPDATE users SET password_hash = $1 WHERE id = $2", [
        newPasswordHash,
        userId,
      ])

      res.status(200).json({
        success: true,
        message: "Password changed successfully",
      })
    } catch (error) {
      console.error("Change password error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  }
)

// POST /auth/set-password (requires authentication, only for users with no password set)
router.post(
  "/set-password",
  authenticateToken,
  body("new_password")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters"),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { new_password } = req.body
      const userId = req.user.id

      // Get user with password hash
      const userResult = await query(
        "SELECT password_hash FROM users WHERE id = $1",
        [userId]
      )

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        })
      }

      const user = userResult.rows[0]

      // Only allow if no password is set
      if (user.password_hash) {
        return res.status(400).json({
          success: false,
          message: "Password already set. Use change password instead.",
        })
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(new_password, 12)

      // Update password
      await query("UPDATE users SET password_hash = $1 WHERE id = $2", [
        newPasswordHash,
        userId,
      ])

      res.status(200).json({
        success: true,
        message: "Password set successfully",
      })
    } catch (error) {
      console.error("Set password error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  }
)

module.exports = router
