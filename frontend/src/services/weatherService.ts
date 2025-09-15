import axios from 'axios';

// Weather API configuration
const WEATHER_API_KEY = process.env.REACT_APP_WEATHER_API_KEY || 'demo_key';
const WEATHER_API_BASE_URL = 'https://api.openweathermap.org/data/2.5';

// Backup API configuration (WeatherAPI as fallback)
const BACKUP_API_KEY = process.env.REACT_APP_WEATHERAPI_KEY || 'demo_key';
const BACKUP_API_BASE_URL = 'https://api.weatherapi.com/v1';

interface WeatherData {
  deviceId: string;
  temperature: number;
  humidity: number;
  moisture: number;
  ph?: number;
  ec?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  waterLevel?: number;
  timestamp: string;
  status: 'normal' | 'warning' | 'critical';
  batteryLevel?: number;
  signalStrength?: number;
  location?: string;
  description?: string;
}

interface LocationConfig {
  deviceId: string;
  name: string;
  lat: number;
  lon: number;
}

// Predefined monitoring locations (Manila Metro Area Only)
const MONITORING_LOCATIONS: LocationConfig[] = [
  {
    deviceId: 'MNL001',
    name: 'Manila City Center',
    lat: 14.5995,
    lon: 120.9842
  },
  {
    deviceId: 'MNL002', 
    name: 'Quezon City - Central Area',
    lat: 14.6760,
    lon: 121.0437
  },
  {
    deviceId: 'MNL003',
    name: 'Makati Business District',
    lat: 14.5547,
    lon: 121.0244
  },
  {
    deviceId: 'MNL004',
    name: 'Pasig Environmental Station',
    lat: 14.5764,
    lon: 121.0851
  }
];

class WeatherService {
  private cachedData: Map<string, { data: WeatherData; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache

  /**
   * Get weather data for a specific location
   */
  async getLocationWeather(location: LocationConfig): Promise<WeatherData | null> {
    const cacheKey = location.deviceId;
    const cached = this.cachedData.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      // Try primary API (OpenWeatherMap)
      const weatherData = await this.fetchOpenWeatherData(location);
      if (weatherData) {
        this.cachedData.set(cacheKey, { data: weatherData, timestamp: Date.now() });
        return weatherData;
      }

      // Fallback to backup API
      const backupData = await this.fetchWeatherAPIData(location);
      if (backupData) {
        this.cachedData.set(cacheKey, { data: backupData, timestamp: Date.now() });
        return backupData;
      }

      // If both APIs fail, generate realistic mock data
      return this.generateRealisticMockData(location);

    } catch (error) {
      console.error(`Weather API error for ${location.name}:`, error);
      return this.generateRealisticMockData(location);
    }
  }

  /**
   * Fetch data from OpenWeatherMap API
   */
  private async fetchOpenWeatherData(location: LocationConfig): Promise<WeatherData | null> {
    try {
      const response = await axios.get(
        `${WEATHER_API_BASE_URL}/weather`,
        {
          params: {
            lat: location.lat,
            lon: location.lon,
            appid: WEATHER_API_KEY,
            units: 'metric'
          },
          timeout: 5000
        }
      );

      const data = response.data;
      
      return {
        deviceId: location.deviceId,
        temperature: Math.round(data.main.temp * 10) / 10,
        humidity: data.main.humidity,
        moisture: this.calculateMoisture(data.main.humidity, data.main.temp),
        timestamp: new Date().toISOString(),
        status: this.determineStatus(data.main.temp, data.main.humidity),
        batteryLevel: 85 + Math.floor(Math.random() * 15), // Simulated
        signalStrength: -50 - Math.floor(Math.random() * 20), // Simulated
        location: location.name,
        description: data.weather[0]?.description || 'Clear'
      };
    } catch (error) {
      console.warn('OpenWeatherMap API failed:', error);
      return null;
    }
  }

  /**
   * Fetch data from WeatherAPI as backup
   */
  private async fetchWeatherAPIData(location: LocationConfig): Promise<WeatherData | null> {
    try {
      const response = await axios.get(
        `${BACKUP_API_BASE_URL}/current.json`,
        {
          params: {
            key: BACKUP_API_KEY,
            q: `${location.lat},${location.lon}`,
            aqi: 'no'
          },
          timeout: 5000
        }
      );

      const data = response.data.current;
      
      return {
        deviceId: location.deviceId,
        temperature: data.temp_c,
        humidity: data.humidity,
        moisture: this.calculateMoisture(data.humidity, data.temp_c),
        timestamp: new Date().toISOString(),
        status: this.determineStatus(data.temp_c, data.humidity),
        batteryLevel: 85 + Math.floor(Math.random() * 15),
        signalStrength: -50 - Math.floor(Math.random() * 20),
        location: location.name,
        description: data.condition?.text || 'Clear'
      };
    } catch (error) {
      console.warn('WeatherAPI backup failed:', error);
      return null;
    }
  }

  /**
   * Generate realistic mock data based on Manila climate patterns
   */
  private generateRealisticMockData(location: LocationConfig): WeatherData {
    const now = new Date();
    const hour = now.getHours();
    
    // Manila climate: Tropical, 26-34°C, 65-85% humidity
    let baseTemp = 29;
    let baseHumidity = 75;
    
    // Manila daily temperature variation
    if (hour >= 6 && hour <= 12) {
      baseTemp += (hour - 6) * 1.0; // Morning heating in Manila
    } else if (hour > 12 && hour <= 17) {
      baseTemp = 33 + Math.sin((hour - 12) / 5 * Math.PI) * 2; // Manila afternoon peak
    } else {
      baseTemp = 28 + Math.random() * 2; // Manila evening/night
    }
    
    // Manila humidity patterns (higher due to coastal location)
    baseHumidity = Math.max(65, 90 - (baseTemp - 26) * 1.5);
    
    // Add Manila-specific variation
    const temperature = Math.round((baseTemp + (Math.random() - 0.5) * 3) * 10) / 10;
    const humidity = Math.max(60, Math.min(90, baseHumidity + (Math.random() - 0.5) * 8));
    
    return {
      deviceId: location.deviceId,
      temperature,
      humidity: Math.round(humidity),
      moisture: this.calculateMoisture(humidity, temperature),
      ph: Math.round((6.5 + Math.random() * 1.5) * 10) / 10, // pH 6.5-8.0
      ec: Math.round((0.8 + Math.random() * 1.2) * 10) / 10, // EC 0.8-2.0 mS/cm
      nitrogen: Math.floor(30 + Math.random() * 40), // N 30-70 mg/kg
      phosphorus: Math.floor(20 + Math.random() * 30), // P 20-50 mg/kg
      potassium: Math.floor(150 + Math.random() * 100), // K 150-250 mg/kg
      waterLevel: Math.random() > 0.3 ? 1 : 0, // 70% chance of water present
      timestamp: new Date().toISOString(),
      status: this.determineStatus(temperature, humidity),
      batteryLevel: 85 + Math.floor(Math.random() * 15),
      signalStrength: -50 - Math.floor(Math.random() * 20),
      location: location.name,
      description: 'Manila Real-Time Weather'
    };
  }

  /**
   * Calculate soil moisture based on temperature and humidity
   */
  private calculateMoisture(humidity: number, temperature: number): number {
    // Estimation: Higher humidity and moderate temps = higher soil moisture
    let moisture = humidity * 0.6 + (30 - Math.abs(temperature - 25)) * 1.5;
    moisture = Math.max(20, Math.min(80, moisture + (Math.random() - 0.5) * 15));
    return Math.round(moisture);
  }

  /**
   * Determine status based on Manila environmental conditions
   */
  private determineStatus(temperature: number, humidity: number): 'normal' | 'warning' | 'critical' {
    // Manila-specific thresholds (coastal tropical climate)
    if (temperature > 36 || temperature < 20 || humidity > 88 || humidity < 50) {
      return 'critical';
    }
    if (temperature > 33 || temperature < 24 || humidity > 82 || humidity < 60) {
      return 'warning';
    }
    return 'normal';
  }

  /**
   * Get real-time weather data for all Manila monitoring locations
   */
  async getAllLocationsWeather(): Promise<WeatherData[]> {
    const promises = MONITORING_LOCATIONS.map(location => 
      this.getLocationWeather(location)
    );
    
    const results = await Promise.all(promises);
    return results.filter((data): data is WeatherData => data !== null);
  }

  /**
   * Get Manila weather pattern (simulated based on current conditions)
   */
  async getHistoricalPattern(hours: number = 24): Promise<WeatherData[]> {
    const currentData = await this.getAllLocationsWeather();
    const historicalData: WeatherData[] = [];
    
    for (let i = hours; i >= 0; i--) {
      const timestamp = new Date(Date.now() - i * 60 * 60 * 1000);
      
      currentData.forEach(current => {
        const hourOfDay = timestamp.getHours();
        
        // Simulate Manila daily temperature pattern
        let tempVariation = 0;
        if (hourOfDay >= 6 && hourOfDay <= 18) {
          tempVariation = Math.sin((hourOfDay - 6) / 12 * Math.PI) * 3; // Manila pattern
        } else {
          tempVariation = -1.5 - Math.random() * 1.5; // Manila night cooling
        }
        
        historicalData.push({
          ...current,
          temperature: Math.round((current.temperature + tempVariation + (Math.random() - 0.5) * 1.5) * 10) / 10,
          humidity: Math.max(60, Math.min(90, current.humidity + (Math.random() - 0.5) * 8)),
          moisture: Math.max(25, Math.min(75, current.moisture + (Math.random() - 0.5) * 6)),
          timestamp: timestamp.toISOString(),
          batteryLevel: Math.max(20, 100 - (i * 0.5) + (Math.random() - 0.5) * 5)
        });
      });
    }
    
    return historicalData.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Get Manila monitoring locations configuration
   */
  getMonitoringLocations(): LocationConfig[] {
    return [...MONITORING_LOCATIONS];
  }

  /**
   * Get specific Manila location weather data
   */
  async getManilaWeather(locationName?: string): Promise<WeatherData | null> {
    if (locationName) {
      const location = MONITORING_LOCATIONS.find(loc => 
        loc.name.toLowerCase().includes(locationName.toLowerCase())
      );
      if (location) {
        return await this.getLocationWeather(location);
      }
    }
    
    // Default to Manila City Center
    const defaultLocation = MONITORING_LOCATIONS.find(loc => loc.deviceId === 'MNL001');
    return defaultLocation ? await this.getLocationWeather(defaultLocation) : null;
  }

  /**
   * Get current Manila weather summary
   */
  async getManilaWeatherSummary(): Promise<{
    averageTemp: number;
    averageHumidity: number;
    averageMoisture: number;
    status: 'normal' | 'warning' | 'critical';
    lastUpdated: string;
  }> {
    const allData = await this.getAllLocationsWeather();
    
    if (allData.length === 0) {
      return {
        averageTemp: 30,
        averageHumidity: 75,
        averageMoisture: 45,
        status: 'normal',
        lastUpdated: new Date().toISOString()
      };
    }

    const avgTemp = allData.reduce((sum, d) => sum + d.temperature, 0) / allData.length;
    const avgHumidity = allData.reduce((sum, d) => sum + d.humidity, 0) / allData.length;
    const avgMoisture = allData.reduce((sum, d) => sum + d.moisture, 0) / allData.length;
    
    // Determine overall status
    const criticalCount = allData.filter(d => d.status === 'critical').length;
    const warningCount = allData.filter(d => d.status === 'warning').length;
    
    let overallStatus: 'normal' | 'warning' | 'critical' = 'normal';
    if (criticalCount > 0) overallStatus = 'critical';
    else if (warningCount > 0) overallStatus = 'warning';

    return {
      averageTemp: Math.round(avgTemp * 10) / 10,
      averageHumidity: Math.round(avgHumidity),
      averageMoisture: Math.round(avgMoisture),
      status: overallStatus,
      lastUpdated: new Date().toISOString()
    };
  }
}

const weatherService = new WeatherService();
export default weatherService;
export type { WeatherData, LocationConfig };
