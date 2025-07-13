# Deployment Guide - Gemini Backend Clone

This guide provides step-by-step instructions for deploying the Gemini Backend Clone to various cloud platforms.

## 🚀 Quick Deploy Options

### 1. Render (Recommended)

**Pros**: Easy setup, free PostgreSQL, automatic deployments
**Cons**: Limited free tier resources

#### Steps:

1. **Fork/Clone Repository**

   ```bash
   git clone <your-repo-url>
   ```

2. **Connect to Render**

   - Go to [render.com](https://render.com)
   - Sign up/Login with GitHub
   - Click "New +" → "Web Service"

3. **Configure Service**

   - **Name**: `gemini-backend-clone`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Branch**: `main`

4. **Add Environment Variables**

   ```env
   NODE_ENV=production
   PORT=10000
   DATABASE_URL=postgresql://... (from Render PostgreSQL)
   JWT_SECRET=your-production-jwt-secret
   REDIS_URL=your-redis-url
   GEMINI_API_KEY=your-gemini-api-key
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   BASIC_TIER_DAILY_LIMIT=5
   CACHE_TTL=600000
   OTP_EXPIRY_MINUTES=10
   ```

5. **Add PostgreSQL Database**

   - Go to "New +" → "PostgreSQL"
   - Connect to your web service
   - Copy the `DATABASE_URL` to environment variables

6. **Deploy**
   - Click "Create Web Service"
   - Wait for build and deployment

### 2. Railway

**Pros**: Full-stack platform, easy database setup
**Cons**: Limited free tier

#### Steps:

1. **Connect Repository**

   - Go to [railway.app](https://railway.app)
   - Connect GitHub account
   - Select your repository

2. **Add PostgreSQL**

   - Click "New" → "Database" → "PostgreSQL"
   - Railway will auto-generate connection string

3. **Configure Environment**

   - Go to your service settings
   - Add all environment variables (same as Render)

4. **Deploy**
   - Railway will auto-deploy on push to main branch

### 3. Heroku

**Pros**: Mature platform, good documentation
**Cons**: No free tier anymore

#### Steps:

1. **Install Heroku CLI**

   ```bash
   # macOS
   brew tap heroku/brew && brew install heroku

   # Windows
   # Download from heroku.com
   ```

2. **Login and Create App**

   ```bash
   heroku login
   heroku create your-app-name
   ```

3. **Add PostgreSQL**

   ```bash
   heroku addons:create heroku-postgresql:mini
   ```

4. **Set Environment Variables**

   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET=your-production-jwt-secret
   heroku config:set GEMINI_API_KEY=your-gemini-api-key
   heroku config:set STRIPE_SECRET_KEY=sk_live_...
   heroku config:set STRIPE_WEBHOOK_SECRET=whsec_...
   heroku config:set REDIS_URL=your-redis-url
   heroku config:set BASIC_TIER_DAILY_LIMIT=5
   heroku config:set CACHE_TTL=600000
   heroku config:set OTP_EXPIRY_MINUTES=10
   ```

5. **Deploy**
   ```bash
   git push heroku main
   ```

### 4. DigitalOcean App Platform

**Pros**: Good performance, reasonable pricing
**Cons**: More complex setup

#### Steps:

1. **Create App**

   - Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
   - Click "Create App"

2. **Connect Repository**

   - Connect GitHub account
   - Select your repository

3. **Configure Build**

   - **Build Command**: `npm install`
   - **Run Command**: `npm start`

4. **Add Database**

   - Click "Create/Attach Database"
   - Choose PostgreSQL
   - Select plan

5. **Set Environment Variables**

   - Add all required environment variables
   - Use the database connection string

6. **Deploy**
   - Click "Create Resources"

## 🔧 Environment Setup

### Required Environment Variables

```env
# Server
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://username:password@host:port/database

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Redis
REDIS_URL=redis://username:password@host:port

# Google Gemini
GEMINI_API_KEY=your-gemini-api-key-here

# Stripe
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key

# Rate Limiting
BASIC_TIER_DAILY_LIMIT=5
CACHE_TTL=600000

# OTP
OTP_EXPIRY_MINUTES=10
```

### Getting API Keys

#### 1. Google Gemini API

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key to `GEMINI_API_KEY`

#### 2. Stripe Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to Developers → API Keys
3. Copy the publishable and secret keys
4. For webhook secret, create a webhook endpoint

#### 3. Redis (if external)

- **Redis Cloud**: Free tier available
- **Upstash**: Serverless Redis
- **Railway/Heroku**: Managed Redis addons

## 🗄️ Database Setup

### PostgreSQL Requirements

- **Version**: 12 or higher
- **Extensions**: No special requirements
- **Tables**: Auto-created on first run

### Manual Database Setup (if needed)

```sql
-- Create database
CREATE DATABASE gemini_backend;

-- Connect to database
\c gemini_backend;

-- Tables will be created automatically by the application
```

## 🔍 Health Checks

### Verify Deployment

```bash
# Health check
curl https://your-app-url.herokuapp.com/health

# Expected response
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "Gemini Backend Clone"
}
```

### Test Authentication

```bash
# Send OTP
curl -X POST https://your-app-url.herokuapp.com/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"mobile_number": "+1234567890"}'
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Database Connection

```bash
# Check if database is accessible
psql $DATABASE_URL -c "SELECT 1;"
```

#### 2. Redis Connection

```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping
```

#### 3. Environment Variables

```bash
# Check if all variables are set
heroku config
# or
railway variables
```

#### 4. Build Failures

```bash
# Check build logs
heroku logs --tail
# or
railway logs
```

### Performance Optimization

#### 1. Database Indexes

```sql
-- Add indexes for better performance
CREATE INDEX idx_users_mobile_number ON users(mobile_number);
CREATE INDEX idx_messages_chatroom_id ON messages(chatroom_id);
CREATE INDEX idx_otps_mobile_number ON otps(mobile_number);
```

#### 2. Redis Configuration

```env
# For production Redis
REDIS_URL=redis://username:password@host:port?ssl=true
```

#### 3. Connection Pooling

```javascript
// In database.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  max: 20, // Increase for production
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})
```

## 📊 Monitoring

### Logs

- **Render**: Built-in log viewer
- **Railway**: Real-time logs in dashboard
- **Heroku**: `heroku logs --tail`
- **DigitalOcean**: App Platform logs

### Metrics to Monitor

- Response times
- Error rates
- Queue processing times
- Database connection pool usage
- Redis memory usage

## 🔒 Security Checklist

- [ ] JWT_SECRET is strong and unique
- [ ] All API keys are production keys (not test)
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] Input validation is working
- [ ] SQL injection protection is active
- [ ] HTTPS is enabled
- [ ] Environment variables are secure

## 🎯 Post-Deployment Testing

1. **Health Check**

   ```bash
   curl https://your-app-url/health
   ```

2. **Authentication Flow**

   ```bash
   # Send OTP
   curl -X POST https://your-app-url/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"mobile_number": "+1234567890"}'

   # Verify OTP (use OTP from response)
   curl -X POST https://your-app-url/auth/verify-otp \
     -H "Content-Type: application/json" \
     -d '{"mobile_number": "+1234567890", "otp": "123456"}'
   ```

3. **Create Chatroom**

   ```bash
   curl -X POST https://your-app-url/chatroom \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{"name": "Test Chatroom", "description": "Test"}'
   ```

4. **Send Message**
   ```bash
   curl -X POST https://your-app-url/chatroom/1/message \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{"message": "Hello AI!"}'
   ```

## 📝 Deployment Checklist

- [ ] Repository is public/accessible
- [ ] All environment variables are set
- [ ] Database is created and accessible
- [ ] Redis is configured
- [ ] API keys are valid
- [ ] Health check passes
- [ ] Authentication works
- [ ] Chatroom creation works
- [ ] Message sending works
- [ ] Subscription endpoints work
- [ ] Webhooks are configured
- [ ] Monitoring is set up
- [ ] Logs are accessible

---

**Ready for Production! 🚀**
