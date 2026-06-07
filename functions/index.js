const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

admin.initializeApp();
const db = admin.database();

// Securely grabbing your OpenWeather API key
const OPENWEATHER_API_KEY = process.env.VITE_OPENWEATHER_KEY || "YOUR_OPENWEATHER_KEY_HERE";

/**
 * 1. CLOUD TIMER: Runs automatically every 15 minutes to inspect weather and tank states
 */
exports.checkPreStormIntervention = onSchedule("every 15 minutes", async (event) => {
  logger.log("Running periodic pre-storm intervention check...");

  try {
    const usersSnapshot = await db.ref("users").once("value");
    if (!usersSnapshot.exists()) return;

    const users = usersSnapshot.val();
    const now = Date.now();

    // Loop through every user in the database
    for (const uid in users) {
      const userData = users[uid];
      const { alerts, sensorData, controls, profile } = userData;

      // Extract current status or fall back to safe defaults
      const currentTankLevel = sensorData?.tankLevel || 0;
      const isPumpOn = controls?.pumpStatus === "ON";
      const hasActiveLeak = alerts?.leakDetected || false;

      // Safety Guard: Don't auto-fill if there is a known leak or if the pump is already running
      if (hasActiveLeak || isPumpOn || currentTankLevel >= 95) {
        // If the tank filled up or pump turned on, clear any pending auto-fill countdowns
        if (alerts?.preStormCountdownActive) {
          await db.ref(`users/${uid}/alerts`).update({
            preStormCountdownActive: false,
            preStormTriggerTime: null
          });
        }
        continue;
      }

      // Fetch user coordinates from a safe location fallback if missing
      const lat = profile?.lat || "16.5062"; 
      const lon = profile?.lon || "80.6480";

      // Call OpenWeather Forecast API
      const weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`;
      const response = await fetch(weatherUrl);
      const weatherData = await response.json();

      if (!weatherData.list || weatherData.list.length === 0) continue;

      // Inspect the upcoming 3-hour window
      const nextForecast = weatherData.list[0];
      const weatherCode = nextForecast.weather[0].id;
      const windSpeed = nextForecast.wind.speed;

      const isThunderstorm = weatherCode >= 200 && weatherCode <= 232;
      const isHeavyRain = [501, 502, 503, 504, 522, 531].includes(weatherCode);
      const isHighWind = windSpeed >= 10;

      // If a severe storm threat is detected AND tank is less than half full
      if ((isThunderstorm || isHeavyRain || isHighWind) && currentTankLevel < 50) {
        
        // Calculate Time to Fill
        const capacity = parseFloat(profile?.tankCapacity) || 1000; 
        const currentVolume = capacity * (currentTankLevel / 100);
        const missingVolume = capacity - currentVolume;
        const currentFlowRate = parseFloat(sensorData?.flowRate) || 15; 
        const timeToFillMinutes = Math.ceil(missingVolume / currentFlowRate);

        // Check if we already started a countdown for this user
        if (!alerts?.preStormCountdownActive) {
          // STEP A: First time discovering the storm. Set a 15-minute fuse in the database.
          logger.log(`Storm detected for user ${uid}. Starting 15-minute warning countdown.`);
          await db.ref(`users/${uid}/alerts`).update({
            preStormCountdownActive: true,
            preStormTriggerTime: now + (15 * 60 * 1000), // Current time + 15 mins
            timeToFillEstimate: timeToFillMinutes
          });
        } else {
          // STEP B: Countdown is already active. Check if the 15 minutes have run out.
          const triggerTime = alerts.preStormTriggerTime || 0;
          
          if (now >= triggerTime) {
            // THE HOLY GRAIL: Human failed to respond in 15 minutes. Cloud takes over!
            logger.log(`User ${uid} failed to respond within 15 minutes. Executing automated pump intervention!`);
            
            await db.ref(`users/${uid}/controls`).update({
              pumpStatus: "ON"
            });

            // Turn off the countdown flag so it doesn't loop fire
            await db.ref(`users/${uid}/alerts`).update({
              preStormCountdownActive: false,
              preStormTriggerTime: null
            });
          }
        }
      } else {
        // No storm detected, clear countdown variables safely if they were left hanging
        if (alerts?.preStormCountdownActive) {
          await db.ref(`users/${uid}/alerts`).update({
            preStormCountdownActive: false,
            preStormTriggerTime: null
          });
        }
      }
    }
  } catch (error) {
    logger.error("Error executing pre-storm logic:", error);
  }
});