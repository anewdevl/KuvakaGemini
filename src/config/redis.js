const redis = require("redis")

let redisClient = null

async function connectRedis() {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    })

    redisClient.on("error", (err) => {
      console.error("Redis Client Error:", err)
    })

    redisClient.on("connect", () => {
      console.log("Redis connected successfully")
    })

    await redisClient.connect()
  } catch (error) {
    console.error("Redis connection error:", error)
    throw error
  }
}

async function getRedisClient() {
  if (!redisClient) {
    await connectRedis()
  }
  return redisClient
}

module.exports = {
  connectRedis,
  getRedisClient,
}
