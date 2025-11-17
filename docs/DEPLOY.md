# VermiLinks Deployment Guide

This comprehensive guide covers deploying VermiLinks to production across multiple platforms, with detailed configuration for all components including Home Assistant integration, security hardening, and monitoring.

## 🚀 Quick Start (Render)

### Prerequisites
- GitHub repository with this codebase
- Render account (free tier supported)
- Gmail account for SMTP (or alternative email provider)
- Home Assistant instance (optional, for telemetry)

### One-Click Deploy

1. **Fork & Push**: Push this codebase to your GitHub repository

2. **Render Blueprint**: In Render dashboard → Blueprints → New Blueprint Instance
   - Connect your GitHub repository
   - Select branch (default: `main`)
   - Click "Apply Blueprint"

3. **Configure Environment Variables**:

   **Backend Service** (`vermilinks-backend`):
   ```bash
   # Security
   JWT_SECRET=your-super-secure-random-jwt-secret-here
   HOME_ASSISTANT_WEBHOOK_SECRET=your-ha-webhook-secret

   # Email (Gmail example)
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   EMAIL_FROM=your-email@gmail.com
   EMAIL_SECURE=false
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587

   # Admin Setup
   INIT_ADMIN_EMAIL=admin@yourdomain.com
   INIT_ADMIN_PASSWORD=secure-admin-password

   # CORS (update with your frontend URL)
   CORS_ORIGINS=https://vermilinks.onrender.com
   SOCKETIO_CORS_ORIGINS=https://vermilinks.onrender.com

   # Home Assistant
   HOME_ASSISTANT_DEVICE_ID=vermilinks-homeassistant
   HOME_ASSISTANT_HISTORY_DAYS=7

   # Optional: ESP32 legacy support
   ESP32_URL=http://your-esp32-device.local
   ESP32_COMMAND_TIMEOUT_MS=5000
   ```

   **Frontend Static Site** (`vermilinks-frontend`):
   ```bash
   REACT_APP_API_URL=https://vermilinks-backend.onrender.com
   REACT_APP_WS_URL=wss://vermilinks-backend.onrender.com
   REACT_APP_ENABLE_SOCKETS=true
   ```

4. **Database**: Render automatically creates PostgreSQL (`vermilinks-db`)

5. **Post-Deploy Setup**:
   ```bash
   # Open shell on backend service
   npm run migrate
   npm run seed-admin
   ```

6. **Verify Deployment**:
   - Frontend: `https://vermilinks.onrender.com`
   - API Health: `https://vermilinks-backend.onrender.com/api/health`
   - Admin Login: `https://vermilinks.onrender.com/admin/login`

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Home Assistant │───▶│   VermiLinks    │───▶│   PostgreSQL    │
│   (Telemetry)    │    │   Backend API   │    │   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   VermiLinks    │
                       │   Frontend      │
                       │   (Admin UI)    │
                       └─────────────────┘
```

### Components
- **Backend**: Node.js/Express API server with Socket.IO
- **Frontend**: React SPA with TypeScript
- **Database**: PostgreSQL with Sequelize ORM
- **External**: Home Assistant for sensor telemetry

## 📋 Detailed Configuration

### Environment Variables Reference

#### Required Variables

| Variable | Service | Description | Example |
|----------|---------|-------------|---------|
| `JWT_SECRET` | Backend | Random secret for JWT tokens | `openssl rand -hex 32` |
| `DATABASE_URL` | Backend | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `EMAIL_USER` | Backend | SMTP username | `your-email@gmail.com` |
| `EMAIL_PASS` | Backend | SMTP password/app password | `your-app-password` |
| `EMAIL_FROM` | Backend | From email address | `noreply@yourdomain.com` |
| `INIT_ADMIN_EMAIL` | Backend | Initial admin email | `admin@yourdomain.com` |
| `INIT_ADMIN_PASSWORD` | Backend | Initial admin password | `secure-password` |

#### Home Assistant Integration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `HOME_ASSISTANT_WEBHOOK_SECRET` | HMAC secret for webhook auth | - | Yes (for HA) |
| `HOME_ASSISTANT_DEVICE_ID` | Device ID for HA telemetry | `vermilinks-homeassistant` | No |
| `HOME_ASSISTANT_HISTORY_DAYS` | Days to retain sensor history | `7` | No |
| `HOME_ASSISTANT_WEBHOOK_RATE_LIMIT` | Requests per minute | `30` | No |

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Backend port | `10000` |
| `CORS_ORIGINS` | Allowed frontend origins | `*` |
| `SOCKETIO_CORS_ORIGINS` | Allowed WebSocket origins | `*` |
| `JWT_ACCESS_EXPIRES_IN` | Access token expiry | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | `7d` |

### Database Setup

The application uses PostgreSQL with automatic migrations:

```bash
# Run migrations (required after deploy)
npm run migrate

# Seed initial admin user
npm run seed-admin

# Optional: Populate sample data
npm run populate-db
```

### Home Assistant Integration

1. **Create Webhook in HA**:
   ```yaml
   # configuration.yaml
   webhook:
     - webhook_id: vermilinks_telemetry
       name: VermiLinks Telemetry
       url: https://your-backend.onrender.com/api/ha/webhook
   ```

2. **Create Automation**:
   ```yaml
   automation:
     - alias: "Send VermiLinks Telemetry"
       trigger:
         - platform: time_pattern
           minutes: "/5"  # Every 5 minutes
       action:
         - service: webhook.call
           data:
             webhook_id: vermilinks_telemetry
             method: POST
             headers:
               Content-Type: application/json
               X-HA-Signature: "{{ your_webhook_secret }}"
             payload: >
               {
                 "deviceId": "vermilinks-homeassistant",
                 "timestamp": "{{ now().isoformat() }}",
                 "metrics": {
                   "temperature": {{ states('sensor.temperature') }},
                   "humidity": {{ states('sensor.humidity') }},
                   "moisture": {{ states('sensor.moisture') }},
                   "ph": {{ states('sensor.ph') }},
                   "ec": {{ states('sensor.ec') }}
                 },
                 "source": {
                   "ha_entity": "sensor.bundle",
                   "automation": "telemetry_push"
                 }
               }
   ```

3. **Verify Integration**:
   - Check webhook logs in HA
   - Monitor `/api/ha/history` endpoint
   - Verify realtime updates in admin dashboard

## 🔒 Security Considerations

### Secrets Management
- Use strong, random `JWT_SECRET` (32+ characters)
- Store email passwords securely (use app passwords for Gmail)
- Rotate `HOME_ASSISTANT_WEBHOOK_SECRET` regularly
- Never commit secrets to version control

### Network Security
- HTTPS enforced on all production deployments
- CORS properly configured for your domain
- Rate limiting on webhook endpoints (30 req/min)
- Input validation on all API endpoints

### Authentication
- JWT tokens with automatic refresh
- OTP verification for admin login
- Session management with blacklist on logout
- Secure password hashing (bcrypt)

## 📊 Monitoring & Maintenance

### Health Checks
- API Health: `GET /api/health`
- Database connectivity check
- Service uptime monitoring

### Logs
- Application logs available in Render dashboard
- Error tracking with structured logging
- Audit logs for security events

### Backups
- Database backups handled by Render PostgreSQL
- Export sensor data via admin dashboard
- Regular data exports recommended

### Updates
```bash
# Update deployment
git push origin main

# Run migrations if schema changed
npm run migrate

# Monitor for errors
# Check Render logs for any issues
```

## 🐳 Alternative Deployments

### Docker Compose (Development/Local)

```bash
# Clone repository
git clone https://github.com/yourusername/vermilinks.git
cd vermilinks

# Configure environment
cp backend/.env.example backend/.env
# Edit .env with your values

# Start services
docker-compose up -d

# Run migrations
docker-compose exec backend npm run migrate
docker-compose exec backend npm run seed-admin
```

### Railway

1. Connect GitHub repository
2. Create PostgreSQL database
3. Deploy backend service with environment variables
4. Deploy static frontend
5. Configure domains and CORS

### VPS/Dedicated Server

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql

# Clone and setup
git clone https://github.com/yourusername/vermilinks.git
cd vermilinks

# Backend setup
cd backend
npm install
cp .env.example .env
# Configure .env
npm run migrate
npm run seed-admin
npm run build
npm start

# Frontend setup
cd ../frontend
npm install
npm run build
# Serve build/ with nginx/apache
```

## 🐛 Troubleshooting

### Common Issues

**Database Connection Failed**
- Verify `DATABASE_URL` format
- Check PostgreSQL credentials
- Ensure database is accessible from deployment

**Email Not Sending**
- Use app passwords for Gmail
- Verify SMTP settings
- Check spam folder

**Webhook Authentication Failed**
- Verify `HOME_ASSISTANT_WEBHOOK_SECRET`
- Check HMAC signature generation in HA
- Ensure webhook URL is correct

**CORS Errors**
- Update `CORS_ORIGINS` with your frontend URL
- Include protocol (https://)
- Restart services after changes

### Debug Commands

```bash
# Check backend health
curl https://your-backend.onrender.com/api/health

# Test admin login
curl -X POST https://your-backend.onrender.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","password":"your-password"}'

# Check HA history
curl https://your-backend.onrender.com/api/ha/history \
  -H "Authorization: Bearer your-jwt-token"

# Test WebSocket connection
node backend/scripts/ws-device-sim.js wss://your-backend.onrender.com test-device
```

## 🏗️ Build Pipeline Scripts

### Automated Deployment
Use the `render-deploy-all.ps1` script for complete deployment with health checks:

```powershell
# Deploy both backend and frontend with comprehensive testing
.\render-deploy-all.ps1

# Or with auto-approval
.\render-deploy-all.ps1 -Force
```

This script will:
- Deploy backend and frontend services
- Run health checks on `/api/health` and `/api/admin/alerts`
- Test WebSocket connectivity
- Display all relevant URLs and credentials
- Show deployment logs and status

### Manual Deployment Steps

1. **Push Code:**
   ```bash
   git add .
   git commit -m "Deploy VermiLinks production"
   git push origin main
   ```

2. **Deploy via Render Dashboard:**
   - Go to your Render services
   - Trigger manual deploy for both backend and frontend
   - Monitor deployment logs

3. **Configure Environment Variables:**
   Set the following in your Render backend service:
   - `HOME_ASSISTANT_WEBHOOK_SECRET` - For webhook authentication
   - `MQTT_BROKER_URL` - If using MQTT (e.g., `mqtt://broker.example.com:1883`)
   - `ALERT_THRESHOLDS_JSON` - Custom alert thresholds (optional)

## 🔌 Hardware Integration

See `docs/HARDWARE_INTEGRATION.md` for complete setup instructions including:

- Home Assistant webhook configuration
- MQTT broker setup
- ESP32 device connection details
- Alert thresholds configuration
- Testing procedures

### Quick Setup URLs
- **HA Webhook URL:** `https://your-backend.onrender.com/api/ha/webhook`
- **WebSocket URL:** `wss://your-backend.onrender.com`
- **API Base URL:** `https://your-backend.onrender.com/api`

## 📞 Support

- Check application logs in your hosting platform
- Verify environment variables are set correctly
- Test API endpoints with curl/Postman
- Review Home Assistant automation logs

For issues, check the troubleshooting section above or create an issue in the repository.
