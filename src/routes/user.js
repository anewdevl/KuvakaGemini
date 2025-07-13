const express = require("express")
const { authenticateToken } = require("../middleware/auth")
const { query } = require("../config/database")

const router = express.Router()

// GET /user/me
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id

    const result = await query(
      `SELECT id, mobile_number, name, email, subscription_tier, subscription_status, 
              daily_message_count, last_message_date, created_at 
       FROM users 
       WHERE id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    const user = result.rows[0]

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          mobile_number: user.mobile_number,
          name: user.name,
          email: user.email,
          subscription_tier: user.subscription_tier,
          subscription_status: user.subscription_status,
          daily_message_count: user.daily_message_count,
          last_message_date: user.last_message_date,
          created_at: user.created_at,
        },
      },
    })
  } catch (error) {
    console.error("Get user profile error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

module.exports = router
