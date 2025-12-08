/*
 * AgriSense ESP32 Moisture Sensor - WiFi + GSM Version
 * Primary: WiFi HTTP communication
 * Fallback: GSM SMS communication (after 60s WiFi failure)
 */

 #include <WiFi.h>
 #include <WiFiManager.h>
 #include <HTTPClient.h>
 #include <ArduinoJson.h>
 #include <HardwareSerial.h>
 
 // Pin Definitions
 #define MOISTURE_PIN 35  // GPIO 35 (ADC1_CH7)
 #define LED_PIN 2        // Built-in LED
 #define RESET_BUTTON_PIN 0  // Boot button for WiFi reset
 
 // GSM Module pins
 #define GSM_RX_PIN 16
 #define GSM_TX_PIN 17
 #define GSM_RST_PIN 4
 #define BOOST_EN_PIN 5
 
 // Device Configuration - CHANGE THIS FOR EACH DEVICE
 const String DEVICE_API_KEY = "4650302EBC07CD362AB1988E172B1699";
 
 // Server Configuration
 const String SERVER_URL = "https://agrisense-z6ks.onrender.com/api/device/sensor-data";
 
 // GSM Configuration
 const String ALERT_PHONE_NUMBER = "+8801303441076";
 HardwareSerial gsmSerial(2);
 
 // Calibration values
 #define DRY_VALUE 4095
 #define WET_VALUE 800
 
 // Timing
 const unsigned long SEND_INTERVAL = 30000; // 30 seconds
 const unsigned long WIFI_TIMEOUT = 60000; // 60 seconds before switching to GSM
 const unsigned long WIFI_CHECK_INTERVAL = 60000; // 1 minute
 const unsigned long STATUS_PRINT_INTERVAL = 120000; // 2 minutes
 const unsigned long GSM_SMS_INTERVAL = 60000; // Send SMS every 60 seconds in GSM mode
 
 // Variables
 int moistureRaw = 0;
 int moisturePercent = 0;
 unsigned long lastSendTime = 0;
 unsigned long lastWiFiCheck = 0;
 unsigned long lastStatusPrint = 0;
 unsigned long lastGSMSend = 0;
 unsigned long wifiStartTime = 0;
 bool deviceLinked = false;
 bool gsmMode = false;
 bool gsmReady = false;
 WiFiManager wm;
 
 void setup() {
   Serial.begin(115200);
   delay(2000);
   
   // Initialize pins
   pinMode(LED_PIN, OUTPUT);
   pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
   pinMode(GSM_RST_PIN, OUTPUT);
   pinMode(BOOST_EN_PIN, OUTPUT);
   
   // Initialize ADC
   analogSetAttenuation(ADC_11db);
   
   Serial.println("\n=================================");
   Serial.println("  AgriSense ESP32 - WiFi + GSM  ");
   Serial.println("=================================");
   Serial.println("Device API Key: " + DEVICE_API_KEY.substring(0, 8) + "...");
   Serial.println("Server URL: " + SERVER_URL);
   Serial.println("GSM Alert Number: " + ALERT_PHONE_NUMBER);
   
   // Setup WiFi with timeout tracking
   wifiStartTime = millis();
   bool wifiConnected = setupWiFi();
   
   if (!wifiConnected) {
     // WiFi failed, switch to GSM mode
     Serial.println("⚠️ WiFi connection failed after 60s timeout");
     Serial.println("🔄 Switching to GSM mode...");
     switchToGSMMode();
   } else {
     // Test basic connectivity
     testBasicConnection();
   }
   
   // Initial sensor reading
   readMoisture();
   Serial.println("Setup complete! Starting sensor loop...");
   Serial.println("=================================\n");
 }
 
 void loop() {
   // Check WiFi reset button
   checkResetButton();
   
   // Update LED status
   updateLEDStatus();
   
   if (gsmMode) {
     // GSM Mode: Send SMS periodically
     if (millis() - lastGSMSend >= GSM_SMS_INTERVAL) {
       readMoisture();
       sendSMSData();
       lastGSMSend = millis();
     }
     
     // Check for GSM responses
     if (gsmSerial.available()) {
       String response = gsmSerial.readString();
       response.trim();
       if (response.length() > 0) {
         Serial.println("GSM: " + response);
       }
     }
     
     // Periodically try to reconnect to WiFi
     if (millis() - lastWiFiCheck >= WIFI_CHECK_INTERVAL * 5) { // Try every 5 minutes
       Serial.println("🔄 Attempting to switch back to WiFi mode...");
       if (tryReconnectWiFi()) {
         switchToWiFiMode();
       }
       lastWiFiCheck = millis();
     }
   } else {
     // WiFi Mode: Send HTTP data
     
     // Check WiFi connection periodically
     if (millis() - lastWiFiCheck >= WIFI_CHECK_INTERVAL) {
       if (!checkWiFiConnection()) {
         // WiFi lost and couldn't reconnect after 60s
         Serial.println("⚠️ WiFi connection lost and reconnection failed");
         Serial.println("🔄 Switching to GSM mode...");
         switchToGSMMode();
       }
       lastWiFiCheck = millis();
     }
     
     // Send sensor data every 30 seconds
     if (millis() - lastSendTime >= SEND_INTERVAL) {
       readMoisture();
       if (WiFi.status() == WL_CONNECTED) {
         sendSensorData();
       } else {
         Serial.println("⚠️ WiFi disconnected, will retry or switch to GSM");
       }
       lastSendTime = millis();
     }
   }
   
   // Print status every 2 minutes
   if (millis() - lastStatusPrint >= STATUS_PRINT_INTERVAL) {
     printStatus();
     lastStatusPrint = millis();
   }
   
   delay(1000);
 }
 
 bool setupWiFi() {
   Serial.println("🌐 Setting up WiFi...");
   
   // Set custom parameters for WiFi Manager
   wm.setConfigPortalTimeout(60); // 60 seconds timeout (changed from 300)
   wm.setConnectTimeout(30); // 30 seconds connection timeout
   wm.setAPStaticIPConfig(IPAddress(192,168,4,1), IPAddress(192,168,4,1), IPAddress(255,255,255,0));
   
   // Custom parameters
   WiFiManagerParameter custom_html("<p><b>AgriSense Device Setup</b></p><p>Connect this device to your WiFi network</p>");
   wm.addParameter(&custom_html);
   
   // Try to connect to saved WiFi
   Serial.println("🔄 Attempting to connect to saved WiFi...");
   Serial.println("⏰ Timeout: 60 seconds");
   
   unsigned long startAttempt = millis();
   bool connected = wm.autoConnect("AgriSense_Setup", "agrisense123");
   unsigned long attemptDuration = millis() - startAttempt;
   
   if (!connected || attemptDuration >= WIFI_TIMEOUT) {
     Serial.println("❌ Failed to connect to WiFi within 60 seconds");
     return false;
   }
   
   Serial.println("✅ WiFi connected successfully!");
   Serial.print("📍 IP address: ");
   Serial.println(WiFi.localIP());
   Serial.print("📶 Signal strength: ");
   Serial.print(WiFi.RSSI());
   Serial.println(" dBm");
   
   return true;
 }
 
 void switchToGSMMode() {
   gsmMode = true;
   Serial.println("\n📱 ════════════════════════════════");
   Serial.println("      SWITCHING TO GSM MODE       ");
   Serial.println("════════════════════════════════\n");
   
   // Disconnect WiFi to save power
   WiFi.disconnect(true);
   WiFi.mode(WIFI_OFF);
   
   // Initialize GSM
   initializeGSM();
   
   Serial.println("✅ GSM mode activated");
   Serial.println("📱 Will send SMS to: " + ALERT_PHONE_NUMBER);
 }
 
 void switchToWiFiMode() {
   gsmMode = false;
   Serial.println("\n🌐 ════════════════════════════════");
   Serial.println("      SWITCHING TO WiFi MODE      ");
   Serial.println("════════════════════════════════\n");
   
   // Power down GSM to save power
   digitalWrite(BOOST_EN_PIN, LOW);
   
   Serial.println("✅ WiFi mode activated");
 }
 
 void initializeGSM() {
   Serial.println("📱 Initializing GSM module...");
   
   // Enable boost converter
   digitalWrite(BOOST_EN_PIN, HIGH);
   delay(3000);
   
   // Initialize GSM serial
   gsmSerial.begin(9600, SERIAL_8N1, GSM_RX_PIN, GSM_TX_PIN);
   
   // Reset GSM module
   Serial.println("Resetting GSM module...");
   digitalWrite(GSM_RST_PIN, LOW);
   delay(1000);
   digitalWrite(GSM_RST_PIN, HIGH);
   delay(5000);
   
   // Initialize GSM with proper sequence
   Serial.println("Configuring GSM...");
   sendATCommand("AT", 2000);
   sendATCommand("AT+CPIN?", 2000);
   sendATCommand("AT+CREG?", 2000);
   sendATCommand("AT+CSQ", 2000);
   sendATCommand("AT+CMGF=1", 2000); // Text mode
   
   gsmReady = true;
   Serial.println("✅ GSM initialization complete");
 }
 
 void sendATCommand(String command, int delayTime) {
   Serial.println("AT: " + command);
   gsmSerial.println(command);
   delay(delayTime);
   
   // Read response
   if (gsmSerial.available()) {
     String response = gsmSerial.readString();
     Serial.println("Response: " + response);
   }
 }
 
 void sendSMSData() {
   if (!gsmReady) {
     Serial.println("❌ GSM not ready");
     return;
   }
   
   Serial.println("\n📱 Sending SMS with sensor data...");
   
   // Send ONLY the moisture value as a number
   String message = String(moisturePercent);
   
   Serial.println("Message: " + message);
   
   // Send SMS
   gsmSerial.println("AT+CMGF=1");
   delay(1000);
   
   gsmSerial.println("AT+CMGS=\"" + ALERT_PHONE_NUMBER + "\"");
   delay(2000);
   
   gsmSerial.print(message);
   delay(1000);
   
   gsmSerial.write(26); // Ctrl+Z
   delay(5000);
   
   Serial.println("✅ SMS sent!");
 }
 
 bool tryReconnectWiFi() {
   Serial.println("🔄 Trying to reconnect to WiFi...");
   
   WiFi.mode(WIFI_STA);
   WiFi.begin();
   
   unsigned long startAttempt = millis();
   while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 30000) {
     delay(500);
     Serial.print(".");
   }
   Serial.println();
   
   if (WiFi.status() == WL_CONNECTED) {
     Serial.println("✅ WiFi reconnected!");
     Serial.print("📍 IP: ");
     Serial.println(WiFi.localIP());
     return true;
   }
   
   Serial.println("❌ WiFi reconnection failed");
   return false;
 }
 
 void testBasicConnection() {
   Serial.println("\n🧪 Testing basic server connectivity...");
   
   if (WiFi.status() != WL_CONNECTED) {
     Serial.println("❌ WiFi not connected, skipping test");
     return;
   }
   
   HTTPClient http;
   String healthURL = "https://agrisense-z6ks.onrender.com/api/health";
   
   Serial.println("📡 Testing: " + healthURL);
   http.begin(healthURL);
   http.setTimeout(10000);
   
   int httpResponseCode = http.GET();
   Serial.print("🏥 Health check response: ");
   Serial.println(httpResponseCode);
   
   if (httpResponseCode > 0) {
     String response = http.getString();
     Serial.println("✅ Server is reachable!");
     Serial.println("📄 Response: " + response);
   } else {
     Serial.println("❌ Server not reachable!");
   }
   
   http.end();
 }
 
 void checkResetButton() {
   static unsigned long buttonPressTime = 0;
   static bool buttonPressed = false;
   if (digitalRead(RESET_BUTTON_PIN) == LOW) {
     if (!buttonPressed) {
       buttonPressed = true;
       buttonPressTime = millis();
       Serial.println("🔘 Reset button pressed...");
     } else if (millis() - buttonPressTime > 5000) {
       Serial.println("🔄 Resetting WiFi settings...");
       wm.resetSettings();
       ESP.restart();
     }
   } else {
     buttonPressed = false;
   }
 }
 
 bool checkWiFiConnection() {
   if (WiFi.status() != WL_CONNECTED) {
     Serial.println("📡 WiFi disconnected! Attempting to reconnect...");
     
     unsigned long reconnectStart = millis();
     WiFi.reconnect();
     
     while (WiFi.status() != WL_CONNECTED && millis() - reconnectStart < WIFI_TIMEOUT) {
       delay(500);
       Serial.print(".");
     }
     Serial.println();
     
     if (WiFi.status() != WL_CONNECTED) {
       Serial.println("❌ Failed to reconnect within 60 seconds");
       return false;
     } else {
       Serial.println("✅ WiFi reconnected!");
       Serial.print("📍 New IP: ");
       Serial.println(WiFi.localIP());
       return true;
     }
   }
   return true;
 }
 
 void readMoisture() {
   // Take multiple readings for accuracy
   int total = 0;
   for (int i = 0; i < 10; i++) {
     total += analogRead(MOISTURE_PIN);
     delay(10);
   }
   moistureRaw = total / 10;
   
   // Convert to percentage
   moisturePercent = map(moistureRaw, DRY_VALUE, WET_VALUE, 0, 100);
   moisturePercent = constrain(moisturePercent, 0, 100);
   
   // Display reading
   Serial.println("─────────────────────────────────");
   Serial.print("📍 GPIO 35 | Raw: ");
   Serial.print(moistureRaw);
   Serial.print(" | Moisture: ");
   Serial.print(moisturePercent);
   Serial.println("%");
   
   String status = getMoistureStatus(moisturePercent);
   Serial.println("🌱 Status: " + status);
   
   // Progress bar
   Serial.print("📊 [");
   int bars = moisturePercent / 5;
   for (int i = 0; i < 20; i++) {
     Serial.print(i < bars ? "█" : "░");
   }
   Serial.println("]");
 }
 
 String getMoistureStatus(int moisture) {
   if (moisture >= 85) return "Very Wet";
   else if (moisture >= 65) return "Wet";
   else if (moisture >= 45) return "Moist";
   else if (moisture >= 25) return "Dry";
   else return "Very Dry";
 }
 
 void sendSensorData() {
   if (WiFi.status() != WL_CONNECTED) {
     Serial.println("❌ WiFi not connected, skipping send");
     return;
   }
   
   Serial.println("\n🚀 Sending sensor data to server...");
   
   HTTPClient http;
   http.begin(SERVER_URL);
   http.addHeader("Content-Type", "application/json");
   http.setTimeout(15000);
   
   // Create JSON payload
   DynamicJsonDocument doc(1024);
   doc["apiKey"] = DEVICE_API_KEY;
   doc["moistureLevel"] = moisturePercent;
   
   String jsonString;
   serializeJson(doc, jsonString);
   
   Serial.print("📤 Payload: ");
   Serial.println(jsonString);
   
   int httpResponseCode = http.POST(jsonString);
   
   Serial.print("📊 Response Code: ");
   Serial.println(httpResponseCode);
   
   if (httpResponseCode > 0) {
     String response = http.getString();
     Serial.print("✅ Response: ");
     Serial.println(response);
     
     deviceLinked = (httpResponseCode == 200);
   } else {
     Serial.print("❌ Error: ");
     Serial.println(httpResponseCode);
     deviceLinked = false;
   }
   
   http.end();
 }
 
 void updateLEDStatus() {
   static unsigned long lastBlink = 0;
   static bool ledState = false;
   
   if (gsmMode) {
     // Medium blink - GSM mode
     if (millis() - lastBlink > 500) {
       ledState = !ledState;
       digitalWrite(LED_PIN, ledState);
       lastBlink = millis();
     }
   } else if (WiFi.status() != WL_CONNECTED) {
     // Fast blink - No WiFi
     if (millis() - lastBlink > 200) {
       ledState = !ledState;
       digitalWrite(LED_PIN, ledState);
       lastBlink = millis();
     }
   } else if (!deviceLinked) {
     // Slow blink - WiFi OK but not linked
     if (millis() - lastBlink > 1000) {
       ledState = !ledState;
       digitalWrite(LED_PIN, ledState);
       lastBlink = millis();
     }
   } else {
     // Solid on - Everything OK
     digitalWrite(LED_PIN, HIGH);
   }
 }
 
 void printStatus() {
   Serial.println("\n📊 ═══════════════════════════════");
   Serial.println("           DEVICE STATUS          ");
   Serial.println("═══════════════════════════════");
   Serial.println("🆔 API Key: " + DEVICE_API_KEY.substring(0, 8) + "...");
   Serial.print("📡 Mode: ");
   Serial.println(gsmMode ? "GSM 📱" : "WiFi 🌐");
   
   if (!gsmMode) {
     Serial.print("🌐 WiFi: ");
     Serial.println(WiFi.status() == WL_CONNECTED ? "Connected ✅" : "Disconnected ❌");
     
     if (WiFi.status() == WL_CONNECTED) {
       Serial.print("📍 IP: ");
       Serial.println(WiFi.localIP());
       Serial.print("📶 Signal: ");
       Serial.print(WiFi.RSSI());
       Serial.println(" dBm");
     }
     
     Serial.print("🔗 Device Linked: ");
     Serial.println(deviceLinked ? "Yes ✅" : "No ❌");
   } else {
     Serial.print("📱 GSM: ");
     Serial.println(gsmReady ? "Ready ✅" : "Not Ready ❌");
     Serial.println("📞 SMS to: " + ALERT_PHONE_NUMBER);
   }
   
   Serial.print("💧 Moisture: ");
   Serial.print(moisturePercent);
   Serial.println("%");
   Serial.print("⏰ Uptime: ");
   Serial.print(millis() / 1000);
   Serial.println(" seconds");
   Serial.println("═══════════════════════════════\n");
 }