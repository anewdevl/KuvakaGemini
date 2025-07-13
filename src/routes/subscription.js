const express = require("express")
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const { authenticateToken } = require("../middleware/auth")
const { query } = require("../config/database")

const router = express.Router()

// POST /subscribe/pro
router.post("/pro", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id

    // Check if user already has a Stripe customer ID
    let stripeCustomerId = req.user.stripe_customer_id

    if (!stripeCustomerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: {
          user_id: userId.toString(),
        },
      })

      stripeCustomerId = customer.id

      // Update user with Stripe customer ID
      await query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [
        stripeCustomerId,
        userId,
      ])
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Pro Subscription",
              description: "Unlimited AI conversations and advanced features",
            },
            unit_amount: 999, // $9.99
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.protocol}://${req.get(
        "host"
      )}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get("host")}/subscription/cancel`,
      metadata: {
        user_id: userId.toString(),
      },
    })

    res.status(200).json({
      success: true,
      message: "Checkout session created successfully",
      data: {
        session_id: session.id,
        checkout_url: session.url,
      },
    })
  } catch (error) {
    console.error("Create subscription error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

// GET /subscription/status
router.get("/status", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id

    // Get user's subscription details
    const userResult = await query(
      `SELECT subscription_tier, subscription_status, stripe_customer_id 
       FROM users 
       WHERE id = $1`,
      [userId]
    )

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    const user = userResult.rows[0]

    // Get active subscription from database
    const subscriptionResult = await query(
      `SELECT stripe_subscription_id, stripe_price_id, status, 
              current_period_start, current_period_end 
       FROM subscriptions 
       WHERE user_id = $1 AND status = 'active' 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    )

    let subscription = null
    if (subscriptionResult.rows.length > 0) {
      subscription = subscriptionResult.rows[0]
    }

    // Get daily usage for basic tier
    let dailyUsage = null
    if (user.subscription_tier === "basic") {
      const usageResult = await query(
        `SELECT daily_message_count, last_message_date 
         FROM users 
         WHERE id = $1`,
        [userId]
      )

      if (usageResult.rows.length > 0) {
        const usage = usageResult.rows[0]
        const today = new Date().toISOString().split("T")[0]
        const isToday = usage.last_message_date === today

        dailyUsage = {
          used: isToday ? usage.daily_message_count : 0,
          limit: parseInt(process.env.BASIC_TIER_DAILY_LIMIT) || 5,
          reset_date: isToday ? null : today,
        }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        subscription: {
          tier: user.subscription_tier,
          status: user.subscription_status,
          stripe_customer_id: user.stripe_customer_id,
          ...(subscription && {
            stripe_subscription_id: subscription.stripe_subscription_id,
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
          }),
        },
        ...(dailyUsage && { daily_usage: dailyUsage }),
      },
    })
  } catch (error) {
    console.error("Get subscription status error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

// GET /subscription/success (for redirect handling)
router.get("/success", authenticateToken, async (req, res) => {
  try {
    const { session_id } = req.query

    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      })
    }

    // Retrieve the session to verify payment
    const session = await stripe.checkout.sessions.retrieve(session_id)

    if (session.payment_status === "paid") {
      res.status(200).json({
        success: true,
        message: "Subscription activated successfully",
        data: {
          session_id,
          payment_status: session.payment_status,
        },
      })
    } else {
      res.status(400).json({
        success: false,
        message: "Payment not completed",
      })
    }
  } catch (error) {
    console.error("Subscription success error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

// GET /subscription/cancel (for redirect handling)
router.get("/cancel", authenticateToken, async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Subscription cancelled",
  })
})

module.exports = router
