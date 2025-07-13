const express = require("express")
const { body, validationResult } = require("express-validator")
const { authenticateToken } = require("../middleware/auth")
const {
  checkDailyLimit,
  incrementMessageCount,
} = require("../middleware/rateLimiter")
const { query } = require("../config/database")
const { getRedisClient } = require("../config/redis")
const { processMessageWithGemini } = require("../services/geminiService")
const { addToQueue } = require("../services/queueService")
const NodeCache = require("node-cache")

const router = express.Router()

// Initialize cache for chatroom lists
const chatroomCache = new NodeCache({
  stdTTL: parseInt(process.env.CACHE_TTL) || 600, // 10 minutes default
  checkperiod: 120,
})

// Validation middleware
const validateCreateChatroom = [
  body("name")
    .isLength({ min: 1, max: 255 })
    .withMessage(
      "Chatroom name is required and must be less than 255 characters"
    ),
  body("description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Description must be less than 1000 characters"),
]

const validateSendMessage = [
  body("message")
    .isLength({ min: 1, max: 4000 })
    .withMessage("Message is required and must be less than 4000 characters"),
]

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

// POST /chatroom
router.post(
  "/",
  authenticateToken,
  validateCreateChatroom,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, description } = req.body
      const userId = req.user.id

      const result = await query(
        `INSERT INTO chatrooms (user_id, name, description) 
       VALUES ($1, $2, $3) 
       RETURNING id, name, description, created_at`,
        [userId, name, description]
      )

      const chatroom = result.rows[0]

      // Clear cache for this user's chatrooms
      chatroomCache.del(`chatrooms_${userId}`)

      res.status(201).json({
        success: true,
        message: "Chatroom created successfully",
        data: {
          chatroom: {
            id: chatroom.id,
            name: chatroom.name,
            description: chatroom.description,
            created_at: chatroom.created_at,
          },
        },
      })
    } catch (error) {
      console.error("Create chatroom error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  }
)

// GET /chatroom
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
    const cacheKey = `chatrooms_${userId}`

    // Try to get from cache first
    let chatrooms = chatroomCache.get(cacheKey)

    if (chatrooms === undefined) {
      // Cache miss - fetch from database
      const result = await query(
        `SELECT id, name, description, created_at, updated_at 
         FROM chatrooms 
         WHERE user_id = $1 
         ORDER BY updated_at DESC`,
        [userId]
      )

      chatrooms = result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }))

      // Store in cache
      chatroomCache.set(cacheKey, chatrooms)
    }

    res.status(200).json({
      success: true,
      data: {
        chatrooms,
        count: chatrooms.length,
      },
    })
  } catch (error) {
    console.error("Get chatrooms error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

// GET /chatroom/:id
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const result = await query(
      `SELECT c.id, c.name, c.description, c.created_at, c.updated_at,
              COUNT(m.id) as message_count
       FROM chatrooms c
       LEFT JOIN messages m ON c.id = m.chatroom_id
       WHERE c.id = $1 AND c.user_id = $2
       GROUP BY c.id`,
      [id, userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Chatroom not found",
      })
    }

    const chatroom = result.rows[0]

    res.status(200).json({
      success: true,
      data: {
        chatroom: {
          id: chatroom.id,
          name: chatroom.name,
          description: chatroom.description,
          message_count: parseInt(chatroom.message_count),
          created_at: chatroom.created_at,
          updated_at: chatroom.updated_at,
        },
      },
    })
  } catch (error) {
    console.error("Get chatroom error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

// POST /chatroom/:id/message
router.post(
  "/:id/message",
  authenticateToken,
  checkDailyLimit,
  validateSendMessage,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params
      const { message } = req.body
      const userId = req.user.id

      // Verify chatroom exists and belongs to user
      const chatroomResult = await query(
        "SELECT id FROM chatrooms WHERE id = $1 AND user_id = $2",
        [id, userId]
      )

      if (chatroomResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Chatroom not found",
        })
      }

      // Create message record
      const messageResult = await query(
        `INSERT INTO messages (chatroom_id, user_message, message_status) 
       VALUES ($1, $2, 'pending') 
       RETURNING id`,
        [id, message]
      )

      const messageId = messageResult.rows[0].id

      // Update chatroom's updated_at timestamp
      await query(
        "UPDATE chatrooms SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [id]
      )

      // Clear cache for this user's chatrooms
      chatroomCache.del(`chatrooms_${userId}`)

      // Add message to queue for processing
      await addToQueue("gemini-messages", {
        messageId,
        chatroomId: id,
        userId,
        message,
      })

      // Increment daily message count for basic tier users
      if (req.user.subscription_tier === "basic") {
        await incrementMessageCount(userId)
      }

      res.status(200).json({
        success: true,
        message: "Message sent successfully",
        data: {
          message_id: messageId,
          status: "pending",
        },
      })
    } catch (error) {
      console.error("Send message error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  }
)

// GET /chatroom/:id/messages
router.get("/:id/messages", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { page = 1, limit = 20 } = req.query

    // Verify chatroom exists and belongs to user
    const chatroomResult = await query(
      "SELECT id FROM chatrooms WHERE id = $1 AND user_id = $2",
      [id, userId]
    )

    if (chatroomResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Chatroom not found",
      })
    }

    const offset = (page - 1) * limit

    const result = await query(
      `SELECT id, user_message, ai_response, message_status, created_at 
       FROM messages 
       WHERE chatroom_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    )

    const messages = result.rows.map((row) => ({
      id: row.id,
      user_message: row.user_message,
      ai_response: row.ai_response,
      message_status: row.message_status,
      created_at: row.created_at,
    }))

    res.status(200).json({
      success: true,
      data: {
        messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          count: messages.length,
        },
      },
    })
  } catch (error) {
    console.error("Get messages error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

module.exports = router
