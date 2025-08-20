<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Environmental Monitoring System - Copilot Instructions

This is a full-stack environmental monitoring system with the following architecture:

## Project Structure
- `backend/` - Node.js + Express API with MongoDB
- `frontend/` - React + TailwindCSS dashboard
- `esp32/` - Arduino code for ESP32 sensor integration

## Key Technologies
- **Backend**: Node.js, Express, MongoDB, Mongoose, JWT, Twilio SMS
- **Frontend**: React 18, TailwindCSS, Chart.js/Recharts, Axios
- **Hardware**: ESP32, RS485/MODBUS, MAX485, Environmental sensors
- **Authentication**: Role-based (admin/user)
- **Real-time**: WebSocket connections for live data

## Coding Guidelines

### Backend (Node.js)
- Use ES6+ syntax with async/await
- Implement proper error handling with try-catch
- Use Mongoose for MongoDB operations
- Follow RESTful API conventions
- Implement rate limiting for API endpoints
- Use JWT for authentication with role-based access
- Include input validation with express-validator

### Frontend (React)
- Use functional components with hooks
- Implement React Context for global state management
- Use TailwindCSS for styling (utility-first approach)
- Create reusable components for charts and cards
- Implement protected routes based on user roles
- Use proper loading states and error boundaries
- Follow React best practices for performance

### ESP32 (Arduino C++)
- Use WiFiClientSecure for HTTPS connections
- Implement MODBUS RTU communication via SoftwareSerial
- Store data locally using SPIFFS/LittleFS when offline
- Use JSON format for API communication
- Implement watchdog timer for reliability
- Add proper error handling and retry logic

## Business Logic
- **Sensors**: Temperature, Humidity, Moisture monitoring
- **Alerts**: SMS notifications for threshold violations
- **Roles**: Admin (full access), User (read-only)
- **Data Flow**: ESP32 → Backend API → MongoDB → Frontend Dashboard
- **Offline Mode**: ESP32 caches data locally and syncs when reconnected

## Security Considerations
- Validate all inputs on both frontend and backend
- Use environment variables for sensitive data
- Implement proper CORS configuration
- Use HTTPS for production deployments
- Sanitize database queries to prevent injection

## Performance
- Implement data pagination for historical data
- Use MongoDB indexes for frequently queried fields
- Cache frequently accessed data
- Optimize chart rendering with data sampling
- Implement lazy loading for components

When generating code, ensure it follows these patterns and integrates well with the existing architecture.
