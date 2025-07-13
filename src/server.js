const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
require("dotenv").config()

const authRoutes = require("./routes/auth")
const userRoutes = require("./routes/user")
const chatroomRoutes = require("./routes/chatroom")
const subscriptionRoutes = require("./routes/subscription")
const webhookRoutes = require("./routes/webhook")

const { errorHandler } = require("./middleware/errorHandler")
const { connectDatabase } = require("./config/database")
const { connectRedis } = require("./config/redis")

const app = express()
const PORT = process.env.PORT || 3000

// Security middleware
app.use(helmet())
app.use(cors())

// Rate limiting for all requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
})
app.use(limiter)

// Webhook routes (must come BEFORE body parsing)
app.use("/webhook", webhookRoutes)

// Body parsing middleware (for all other routes)
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "Gemini Backend Clone",
  })
})

// API Routes
app.use("/auth", authRoutes)
app.use("/user", userRoutes)
app.use("/chatroom", chatroomRoutes)
app.use("/subscribe", subscriptionRoutes)

// Error handling middleware
app.use(errorHandler)

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  })
})

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase()
    console.log("✅ Database connected successfully")

    // Connect to Redis
    await connectRedis()
    console.log("✅ Redis connected successfully")

    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`📊 Environment: ${process.env.NODE_ENV}`)
      console.log(`🔗 Health check: http://localhost:${PORT}/health`)
    })
  } catch (error) {
    console.error("❌ Failed to start server:", error)
    process.exit(1)
  }
}

startServer()

module.exports = app
