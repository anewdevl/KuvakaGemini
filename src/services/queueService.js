const Queue = require("bull")
const { processMessageWithGemini } = require("./geminiService")

// Create message processing queue
const messageQueue = new Queue("gemini-messages", {
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
})

// Process messages from queue
messageQueue.process(async (job) => {
  const { messageId, message } = job.data

  console.log(`🔄 Processing message ${messageId} from queue`)

  try {
    const response = await processMessageWithGemini(messageId, message)
    return { success: true, response }
  } catch (error) {
    console.error(`❌ Queue processing error for message ${messageId}:`, error)
    throw error
  }
})

// Queue event handlers
messageQueue.on("completed", (job, result) => {
  console.log(`✅ Job ${job.id} completed successfully`)
})

messageQueue.on("failed", (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message)
})

messageQueue.on("error", (error) => {
  console.error("Queue error:", error)
})

// Add message to queue
async function addToQueue(queueName, data) {
  try {
    if (queueName === "gemini-messages") {
      const job = await messageQueue.add(data, {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      })

      console.log(
        `📝 Added message ${data.messageId} to queue (Job ID: ${job.id})`
      )
      return job
    }
  } catch (error) {
    console.error("Error adding to queue:", error)
    throw error
  }
}

// Get queue status
async function getQueueStatus() {
  try {
    const waiting = await messageQueue.getWaiting()
    const active = await messageQueue.getActive()
    const completed = await messageQueue.getCompleted()
    const failed = await messageQueue.getFailed()

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    }
  } catch (error) {
    console.error("Error getting queue status:", error)
    throw error
  }
}

module.exports = {
  addToQueue,
  getQueueStatus,
  messageQueue,
}
