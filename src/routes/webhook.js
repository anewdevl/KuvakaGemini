const express = require("express")
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const { query } = require("../config/database")

const router = express.Router()

// POST /webhook/stripe
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"]
    let event

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      )
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message)
      return res.status(400).send(`Webhook Error: ${err.message}`)
    }

    try {
      // Handle the event
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutSessionCompleted(event.data.object)
          break

        case "customer.subscription.created":
          await handleSubscriptionCreated(event.data.object)
          break

        case "customer.subscription.updated":
          await handleSubscriptionUpdated(event.data.object)
          break

        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event.data.object)
          break

        case "invoice.payment_succeeded":
          await handlePaymentSucceeded(event.data.object)
          break

        case "invoice.payment_failed":
          await handlePaymentFailed(event.data.object)
          break

        default:
          console.log(`Unhandled event type: ${event.type}`)
      }

      res.status(200).json({ received: true })
    } catch (error) {
      console.error("Webhook processing error:", error)
      res.status(500).json({ error: "Webhook processing failed" })
    }
  }
)

async function handleCheckoutSessionCompleted(session) {
  console.log("Checkout session completed:", session.id)

  const userId = session.metadata?.user_id
  if (!userId) {
    console.error("No user_id in session metadata")
    return
  }

  // Update user subscription status
  await query(
    "UPDATE users SET subscription_tier = $1, subscription_status = $2 WHERE id = $3",
    ["pro", "active", userId]
  )
}

async function handleSubscriptionCreated(subscription) {
  console.log("Subscription created:", subscription.id)

  const customerId = subscription.customer

  // Get user by Stripe customer ID
  const userResult = await query(
    "SELECT id FROM users WHERE stripe_customer_id = $1",
    [customerId]
  )

  if (userResult.rows.length === 0) {
    console.error("User not found for customer:", customerId)
    return
  }

  const userId = userResult.rows[0].id

  // Create subscription record
  await query(
    `INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_price_id, status, 
                               current_period_start, current_period_end) 
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      userId,
      subscription.id,
      subscription.items.data[0].price.id,
      subscription.status,
      new Date(subscription.current_period_start * 1000),
      new Date(subscription.current_period_end * 1000),
    ]
  )

  // Update user subscription
  await query(
    "UPDATE users SET subscription_tier = $1, subscription_status = $2 WHERE id = $3",
    ["pro", subscription.status, userId]
  )
}

async function handleSubscriptionUpdated(subscription) {
  console.log("Subscription updated:", subscription.id)

  const customerId = subscription.customer

  // Get user by Stripe customer ID
  const userResult = await query(
    "SELECT id FROM users WHERE stripe_customer_id = $1",
    [customerId]
  )

  if (userResult.rows.length === 0) {
    console.error("User not found for customer:", customerId)
    return
  }

  const userId = userResult.rows[0].id

  // Update subscription record
  await query(
    `UPDATE subscriptions 
     SET status = $1, current_period_start = $2, current_period_end = $3 
     WHERE stripe_subscription_id = $4`,
    [
      subscription.status,
      new Date(subscription.current_period_start * 1000),
      new Date(subscription.current_period_end * 1000),
      subscription.id,
    ]
  )

  // Update user subscription status
  const subscriptionTier = subscription.status === "active" ? "pro" : "basic"
  await query(
    "UPDATE users SET subscription_tier = $1, subscription_status = $2 WHERE id = $3",
    [subscriptionTier, subscription.status, userId]
  )
}

async function handleSubscriptionDeleted(subscription) {
  console.log("Subscription deleted:", subscription.id)

  const customerId = subscription.customer

  // Get user by Stripe customer ID
  const userResult = await query(
    "SELECT id FROM users WHERE stripe_customer_id = $1",
    [customerId]
  )

  if (userResult.rows.length === 0) {
    console.error("User not found for customer:", customerId)
    return
  }

  const userId = userResult.rows[0].id

  // Update subscription record
  await query(
    "UPDATE subscriptions SET status = $1 WHERE stripe_subscription_id = $2",
    ["canceled", subscription.id]
  )

  // Downgrade user to basic tier
  await query(
    "UPDATE users SET subscription_tier = $1, subscription_status = $2 WHERE id = $3",
    ["basic", "canceled", userId]
  )
}

async function handlePaymentSucceeded(invoice) {
  console.log("Payment succeeded for invoice:", invoice.id)

  if (invoice.subscription) {
    // Update subscription status
    await query(
      "UPDATE subscriptions SET status = $1 WHERE stripe_subscription_id = $2",
      ["active", invoice.subscription]
    )
  }
}

async function handlePaymentFailed(invoice) {
  console.log("Payment failed for invoice:", invoice.id)

  if (invoice.subscription) {
    // Update subscription status
    await query(
      "UPDATE subscriptions SET status = $1 WHERE stripe_subscription_id = $2",
      ["past_due", invoice.subscription]
    )
  }
}

module.exports = router
