const redis = require("redis")

let redisClient = null

async function connectRedis() {
  try {
    redisClient = redis.createClient({
      socket: {
        host: "redis-14372.c15.us-east-1-2.ec2.redns.redis-cloud.com",
        port: 14372,
      },
      username: "default",
      password: process.env.REDIS_PASSWORD, // set this in your env!
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
