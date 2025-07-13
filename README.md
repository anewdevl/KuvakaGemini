# Gemini Backend Clone - Kuvaka Tech

A comprehensive backend system that enables user-specific chatrooms, OTP-based authentication, Gemini API-powered AI conversations, and subscription handling via Stripe.

## 🚀 Features

- **OTP-based Authentication**: Mobile number verification with JWT tokens
- **Chatroom Management**: Create and manage multiple chatrooms per user
- **AI Conversations**: Google Gemini API integration with async processing
- **Subscription System**: Stripe integration with Basic (Free) and Pro (Paid) tiers
- **Rate Limiting**: Daily message limits for Basic tier users
- **Caching**: Redis-based caching for improved performance
- **Message Queue**: Bull queue for async message processing

## 🏗️ Architecture

### Tech Stack

- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL
- **Cache & Queue**: Redis with Bull
- **Authentication**: JWT with OTP verification
- **Payments**: Stripe (sandbox mode)
- **AI**: Google Gemini API
- **Validation**: Express-validator
- **Security**: Helmet, CORS, Rate limiting

### Project Structure

```
src/
├── config/
│   ├── database.js      # PostgreSQL connection & schema
│   └── redis.js         # Redis connection
├── middleware/
│   ├── auth.js          # JWT authentication
│   ├── errorHandler.js  # Global error handling
│   └── rateLimiter.js   # Daily message limits
├── routes/
│   ├── auth.js          # Authentication endpoints
│   ├── user.js          # User profile endpoints
│   ├── chatroom.js      # Chatroom management
│   ├── subscription.js  # Stripe subscription
│   └── webhook.js       # Stripe webhooks
├── services/
│   ├── otpService.js    # OTP generation & sending
│   ├── geminiService.js # Gemini API integration
│   └── queueService.js  # Bull queue management
└── server.js            # Main application entry
```

## 📋 API Endpoints

### Authentication

| Method | Endpoint                | Auth | Description             |
| ------ | ----------------------- | ---- | ----------------------- |
| POST   | `/auth/signup`          | ❌   | Register new user       |
| POST   | `/auth/send-otp`        | ❌   | Send OTP to mobile      |
| POST   | `/auth/verify-otp`      | ❌   | Verify OTP & get JWT    |
| POST   | `/auth/forgot-password` | ❌   | Send password reset OTP |
| POST   | `/auth/change-password` | ✅   | Change user password    |

### User Management

| Method | Endpoint   | Auth | Description      |
| ------ | ---------- | ---- | ---------------- |
| GET    | `/user/me` | ✅   | Get user profile |

### Chatrooms

| Method | Endpoint                 | Auth | Description                    |
| ------ | ------------------------ | ---- | ------------------------------ |
| POST   | `/chatroom`              | ✅   | Create new chatroom            |
| GET    | `/chatroom`              | ✅   | List user's chatrooms (cached) |
| GET    | `/chatroom/:id`          | ✅   | Get chatroom details           |
| POST   | `/chatroom/:id/message`  | ✅   | Send message to AI             |
| GET    | `/chatroom/:id/messages` | ✅   | Get chatroom messages          |

### Subscriptions

| Method | Endpoint               | Auth | Description             |
| ------ | ---------------------- | ---- | ----------------------- |
| POST   | `/subscribe/pro`       | ✅   | Create Pro subscription |
| GET    | `/subscription/status` | ✅   | Get subscription status |

### Webhooks

| Method | Endpoint          | Auth | Description            |
| ------ | ----------------- | ---- | ---------------------- |
| POST   | `/webhook/stripe` | ❌   | Stripe webhook handler |

## 🛠️ Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL
- Redis
- Google Gemini API key
- Stripe account (sandbox)

### 1. Clone Repository

```bash
git clone <repository-url>
cd gemini-backend-clone
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the environment example file:

```bash
cp env.example .env
```

Update `.env` with your configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/gemini_backend

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Google Gemini API
GEMINI_API_KEY=your-gemini-api-key-here

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# Rate Limiting
BASIC_TIER_DAILY_LIMIT=5
CACHE_TTL=600000

# OTP Configuration
OTP_EXPIRY_MINUTES=10
```

### 4. Database Setup

```bash
# Create PostgreSQL database
createdb gemini_backend

# Tables will be created automatically on first run
```

### 5. Start Services

```bash
# Start Redis (if not running)
redis-server

# Start the application
npm run dev
```

## 🔧 Configuration Details

### Database Schema

- **users**: User accounts with subscription info
- **otps**: OTP codes for authentication
- **chatrooms**: User chatrooms
- **messages**: AI conversation messages
- **subscriptions**: Stripe subscription records

### Caching Strategy

- **Chatroom Lists**: Cached for 10 minutes per user
- **Justification**: Frequently accessed, rarely changed, improves dashboard performance

### Rate Limiting

- **Basic Tier**: 5 messages per day
- **Pro Tier**: Unlimited messages
- **Global**: 100 requests per 15 minutes per IP

### Queue System

- **Bull Queue**: Redis-based job queue
- **Retry Logic**: 3 attempts with exponential backoff
- **Job Types**: Gemini message processing

## 🧪 Testing with Postman

### 1. Authentication Flow

```bash
# 1. Send OTP
POST /auth/send-otp
{
  "mobile_number": "+1234567890"
}

# 2. Verify OTP
POST /auth/verify-otp
{
  "mobile_number": "+1234567890",
  "otp": "123456"
}
```

### 2. Create Chatroom

```bash
POST /chatroom
Authorization: Bearer <jwt_token>
{
  "name": "My AI Assistant",
  "description": "Personal AI chat"
}
```

### 3. Send Message

```bash
POST /chatroom/1/message
Authorization: Bearer <jwt_token>
{
  "message": "Hello, how are you?"
}
```

### 4. Check Subscription

```bash
GET /subscription/status
Authorization: Bearer <jwt_token>
```

## 🚀 Deployment

### Environment Variables for Production

```env
NODE_ENV=production
DATABASE_URL=your_production_db_url
REDIS_URL=your_production_redis_url
JWT_SECRET=your_production_jwt_secret
STRIPE_SECRET_KEY=your_production_stripe_key
```

### Deployment Platforms

- **Render**: Easy deployment with PostgreSQL addon
- **Railway**: Full-stack platform with database
- **Heroku**: Traditional Node.js hosting
- **DigitalOcean**: VPS with manual setup

## 📊 Monitoring & Logging

### Health Check

```bash
GET /health
```

### Queue Status

The application logs queue processing status:

- ✅ Job completed successfully
- ❌ Job failed with error details
- 🔄 Processing message from queue

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Input Validation**: Express-validator for all inputs
- **Rate Limiting**: Prevents abuse
- **CORS**: Cross-origin request handling
- **Helmet**: Security headers
- **SQL Injection Protection**: Parameterized queries

## 🎯 Key Design Decisions

### 1. OTP Authentication

- **Mobile-only**: Simplified user experience
- **Mocked SMS**: Returns OTP in response for testing
- **Auto-user creation**: Users created on first OTP verification

### 2. Async Message Processing

- **Queue-based**: Prevents API timeouts
- **Retry logic**: Handles temporary failures
- **Status tracking**: Pending → Processing → Completed/Failed

### 3. Subscription Tiers

- **Basic**: 5 messages/day, free
- **Pro**: Unlimited messages, $9.99/month
- **Automatic downgrade**: On payment failure

### 4. Caching Strategy

- **Chatroom lists**: Most frequently accessed data
- **Short TTL**: 10 minutes for fresh data
- **User-specific**: Per-user cache keys

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection**

   ```bash
   # Check PostgreSQL is running
   sudo systemctl status postgresql
   ```

2. **Redis Connection**

   ```bash
   # Check Redis is running
   redis-cli ping
   ```

3. **Gemini API Errors**

   - Verify API key is valid
   - Check API quota limits
   - Ensure proper error handling

4. **Stripe Webhooks**
   - Use Stripe CLI for local testing
   - Verify webhook signature
   - Check webhook endpoint URL

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

**Built for Kuvaka Tech Backend Developer Assignment**
