@echo off
REM Home Assistant Integration Setup Script for Windows

echo ===========================================
echo BeanToBin - Home Assistant Setup Helper
echo ===========================================
echo.

echo This script will help you configure Home Assistant + ESPHome integration.
echo.

set /p HA_URL="Enter your Home Assistant URL (default: http://homeassistant.local:8123): "
if "%HA_URL%"=="" set HA_URL=http://homeassistant.local:8123

set /p HA_TOKEN="Enter your Home Assistant Long-Lived Access Token: "
if "%HA_TOKEN%"=="" (
    echo ERROR: HA_TOKEN is required!
    pause
    exit /b 1
)

echo.
echo Creating .env.ha file with your configuration...
echo.

echo # Home Assistant Configuration > .env.ha
echo HA_BASE_URL=%HA_URL% >> .env.ha
echo HA_TOKEN=%HA_TOKEN% >> .env.ha
echo HA_ENTITY_FILTER=sensor.esphome_ >> .env.ha
echo. >> .env.ha
echo # Poller Configuration >> .env.ha
echo POLL_MS=30000 >> .env.ha
echo USE_HA_POLLER=true >> .env.ha

echo Configuration saved to .env.ha
echo.
echo Next steps:
echo 1. Copy the contents of .env.ha to your main .env file
echo 2. Update your server.js to use sensor-poller-ha.js
echo 3. Restart your backend services
echo.
echo Example server.js change:
echo   const sensorPoller = require('./services/sensor-poller-ha');
echo.

pause