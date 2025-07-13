const { query } = require("../config/database")

const checkDailyLimit = async (req, res, next) => {
  try {
    const userId = req.user.id
    const today = new Date().toISOString().split("T")[0]

    // Check if user is on basic tier
    if (req.user.subscription_tier === "basic") {
      // Get today's message count
      const result = await query(
        `SELECT daily_message_count, last_message_date 
         FROM users 
         WHERE id = $1`,
        [userId]
      )

      const user = result.rows[0]
      const dailyLimit = parseInt(process.env.BASIC_TIER_DAILY_LIMIT) || 5

      // Reset count if it's a new day
      if (user.last_message_date !== today) {
        await query(
          "UPDATE users SET daily_message_count = 0, last_message_date = $1 WHERE id = $2",
          [today, userId]
        )
      } else if (user.daily_message_count >= dailyLimit) {
        return res.status(429).json({
          success: false,
          message: `Daily limit of ${dailyLimit} messages reached. Upgrade to Pro for unlimited access.`,
          limit: dailyLimit,
          used: user.daily_message_count,
        })
      }
    }

    next()
  } catch (error) {
    console.error("Rate limiter error:", error)
    next(error)
  }
}

const incrementMessageCount = async (userId) => {
  try {
    const today = new Date().toISOString().split("T")[0]

    await query(
      `UPDATE users 
       SET daily_message_count = daily_message_count + 1, 
           last_message_date = $1 
       WHERE id = $2`,
      [today, userId]
    )
  } catch (error) {
    console.error("Error incrementing message count:", error)
  }
}

module.exports = {
  checkDailyLimit,
  incrementMessageCount,
}
