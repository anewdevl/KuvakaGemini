const jwt = require("jsonwebtoken")
const { query } = require("../config/database")

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1] // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token is required",
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Get user from database
    const result = await query(
      "SELECT id, mobile_number, name, email, subscription_tier, subscription_status FROM users WHERE id = $1",
      [decoded.userId]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid token - user not found",
      })
    }

    req.user = result.rows[0]
    next()
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      })
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      })
    }

    console.error("Auth middleware error:", error)
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
}

module.exports = {
  authenticateToken,
}
