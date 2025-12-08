/*
 * Foodprint ESP32 Device Firmware
 * 
 * Hardware:
 * - ESP32
 * - 4x4 Matrix Keypad
 * - OLED 96x64 (SSD1306)
 * - LED (for burner indicator)
 * - Push Button (for burner trigger)
 * - Additional navigation buttons (optional)
 * 
 * Libraries needed:
 * - WiFi
 * - HTTPClient
 * - Keypad
 * - Adafruit_SSD1306
 * - Adafruit_GFX
 * - ArduinoJson
 */

 #include <WiFi.h>
 #include <HTTPClient.h>
 #include <WiFiClientSecure.h>
 #include <Keypad.h>
 #include <Wire.h>
 #include <Adafruit_GFX.h>
 #include <Adafruit_SSD1306.h>
 #include <ArduinoJson.h>
 
 // ========== CONFIGURATION ==========
 // WiFi credentials for Wokwi (virtual access point - no password required)
 // For real ESP32: use your actual WiFi credentials
 const char* ssid = "Wokwi-GUEST";  // Wokwi's virtual WiFi (open, no password)
 const char* password = "";  // No password needed for Wokwi-GUEST
 
 // TODO: Set your backend URL (use ngrok URL, Render URL, etc.)
 // For local testing:  "http://192.168.x.x:5000" (LAN) or "http://localhost:5000" (with tunnel)
 // For Wokwi/ESP32:    Prefer deploying backend to Render/Vercel so HTTPS certs are valid
 // For real ESP32:     Use HTTPS endpoint (ngrok/Render) with a pinned API key
 const char* backendUrl = "https://bubt-food.onrender.com";  // Render deployment URL
 const bool backendUsesHttps = true;                         // Flip to false if using HTTP
 
 // TODO: Set your device API key (hardcoded in firmware)
 // This will be shown on display - use this to pair device in web app
 const char* API_KEY = "api1";  // Device API key
 
 // ========== HARDWARE PINS ==========
 // Keypad 4x4
 const byte ROWS = 4;
 const byte COLS = 4;
 char keys[ROWS][COLS] = {
   {'1','2','3','A'},
   {'4','5','6','B'},
   {'7','8','9','C'},
   {'*','0','#','D'}
 };
 byte rowPins[ROWS] = {19, 18, 5, 17};  // Adjust to your wiring
 byte colPins[COLS] = {16, 4, 0, 2};    // Adjust to your wiring
 
 // OLED Display (I2C)
 #define OLED_SDA 21
 #define OLED_SCL 22
 #define OLED_RESET -1
 #define SCREEN_WIDTH 128
 #define SCREEN_HEIGHT 64
 
// LED and Button
#define BURNER_LED_PIN 25
#define BURNER_BUTTON_PIN 26

// Navigation buttons (optional)
#define NAV_UP_PIN 32
#define NAV_DOWN_PIN 33
#define NAV_SELECT_PIN 27

// Fridge door sensor + buzzer
#define DOOR_SENSOR_PIN 14   // Door closed when pin is pulled LOW (shorted to GND)
#define BUZZER_PIN 15        // Active buzzer (through transistor) - HIGH = buzzing
 
 // ========== GLOBAL OBJECTS ==========
 Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);
 Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
 
 // ========== STATE VARIABLES ==========
 struct InventoryItem {
   String id;
   String name;
   float quantity;
   String unit;
   String category;
 };
 
 InventoryItem inventory[20];  // Max 20 items
 int inventoryCount = 0;
 int selectedIndex = 0;
 bool isPaired = false;
 unsigned long lastUsageCheck = 0;
 bool hasUsageToday = false;
 String currentScreen = "api_key";  // "api_key", "inventory", "usage", "message"
 String quantityInput = "";         // Buffer for keypad-entered quantity while logging usage
bool doorClosedState = true;
bool doorOpenedSinceLastClose = false;
unsigned long doorStateChangedAt = 0;
const unsigned long doorDebounceMs = 100;
bool buzzerActive = false;
 
 // ========== SETUP ==========
 void setup() {
   Serial.begin(115200);
   delay(1000);
   Serial.println("\n\n=== Foodprint ESP32 Starting ===");
   
   // Initialize display
   Serial.println("Initializing OLED...");
   Wire.begin(OLED_SDA, OLED_SCL);
   if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
     Serial.println("SSD1306 allocation failed");
     for (;;);
   }
   Serial.println("OLED initialized");
   display.clearDisplay();
   display.setTextColor(SSD1306_WHITE);
   
   // Initialize pins
   Serial.println("Initializing pins...");
   pinMode(BURNER_LED_PIN, OUTPUT);
   pinMode(BURNER_BUTTON_PIN, INPUT_PULLUP);
   pinMode(NAV_UP_PIN, INPUT_PULLUP);
   pinMode(NAV_DOWN_PIN, INPUT_PULLUP);
   pinMode(NAV_SELECT_PIN, INPUT_PULLUP);
  pinMode(DOOR_SENSOR_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  doorClosedState = digitalRead(DOOR_SENSOR_PIN) == LOW;
  doorStateChangedAt = millis();
   
   // Show API key on startup
   Serial.print("API Key: ");
   Serial.println(API_KEY);
   showApiKey();
   
   // Connect to WiFi
   Serial.println("Connecting to WiFi...");
   connectWiFi();
   
   // Check WiFi status before API calls
   Serial.print("WiFi Status: ");
   Serial.println(WiFi.status() == WL_CONNECTED ? "CONNECTED" : "DISCONNECTED");
   if (WiFi.status() == WL_CONNECTED) {
     Serial.print("IP Address: ");
     Serial.println(WiFi.localIP());
   }
   
   // Check if device is paired
   Serial.println("Checking pairing status...");
   checkPairing();
   Serial.print("Paired: ");
   Serial.println(isPaired ? "YES" : "NO");
   
   // Load inventory if paired
   if (isPaired) {
     Serial.println("Device is paired, loading inventory...");
     fetchInventory();
     checkUsageToday();
     currentScreen = "inventory";
     showInventory();
   } else {
     Serial.println("Device not paired, showing API key");
   }
   
   Serial.println("Setup complete!");
 }
 
 // ========== MAIN LOOP ==========
 void loop() {
   // Handle burner button
   if (digitalRead(BURNER_BUTTON_PIN) == LOW) {
     delay(50);  // Debounce
     if (digitalRead(BURNER_BUTTON_PIN) == LOW) {
       handleBurnerButton();
       delay(500);  // Prevent multiple triggers
     }
   }
   
   // Handle keypad
   char key = keypad.getKey();
   if (key) {
     handleKeypad(key);
   }
   
   // Handle navigation buttons
   if (digitalRead(NAV_UP_PIN) == LOW) {
     delay(50);
     if (digitalRead(NAV_UP_PIN) == LOW) {
       navigateUp();
       delay(300);
     }
   }
   
   if (digitalRead(NAV_DOWN_PIN) == LOW) {
     delay(50);
     if (digitalRead(NAV_DOWN_PIN) == LOW) {
       navigateDown();
       delay(300);
     }
   }
   
   if (digitalRead(NAV_SELECT_PIN) == LOW) {
     delay(50);
     if (digitalRead(NAV_SELECT_PIN) == LOW) {
       handleSelect();
       delay(300);
     }
   }
   
  monitorDoorSensor();
  
   // Periodic checks
   if (millis() - lastUsageCheck > 60000) {  // Every minute
     if (isPaired) {
       checkUsageToday();
     }
     lastUsageCheck = millis();
   }
   
   delay(10);
 }
 
 // ========== DISPLAY FUNCTIONS ==========
 void showApiKey() {
   display.clearDisplay();
   display.setTextSize(1);
   display.setCursor(0, 0);
   display.println("Foodprint Device");
   display.println("API Key:");
   display.setTextSize(2);
   display.setCursor(0, 20);
   display.println(API_KEY);
   display.setTextSize(1);
   display.setCursor(0, 50);
   display.println("Pair in app");
   display.display();
 }
 
 void showInventory() {
   display.clearDisplay();
   display.setTextSize(1);
   display.setCursor(0, 0);
   display.print("Inventory (");
   display.print(selectedIndex + 1);
   display.print("/");
   display.print(inventoryCount);
   display.println(")");
   
   if (inventoryCount == 0) {
     display.setCursor(0, 20);
     display.println("No items");
     display.println("Press * to refresh");
   } else {
     display.setCursor(0, 15);
     if (selectedIndex < inventoryCount) {
       display.println(inventory[selectedIndex].name);
       display.print(inventory[selectedIndex].quantity);
       display.print(" ");
       display.println(inventory[selectedIndex].unit);
       display.print("Cat: ");
       display.println(inventory[selectedIndex].category);
       display.print("> Select to log");
     }
   }
   display.display();
 }
 
 void showMessage(String message, int duration = 5000) {
   display.clearDisplay();
   display.setTextSize(1);
   display.setCursor(0, 20);
   display.println(message);
   display.display();
   delay(duration);
   if (currentScreen == "inventory") {
     showInventory();
   } else {
     showApiKey();
   }
 }
 
 void showUsageScreen() {
   display.clearDisplay();
   display.setTextSize(1);
   display.setCursor(0, 0);
   display.println("Log Usage:");
   if (selectedIndex < inventoryCount) {
     display.println(inventory[selectedIndex].name);
     display.print("Avail: ");
     display.print(inventory[selectedIndex].quantity, 2);
     display.print(" ");
     display.println(inventory[selectedIndex].unit);
   }
   display.println("--------------------");
   display.print("Qty: ");
   if (quantityInput.length() == 0) {
     display.println("1 (default)");
   } else {
     display.println(quantityInput);
   }
   display.println("A=Clr  D=Decimal");
   display.println("*=Back  #=Confirm");
   display.display();
 }
 
 // ========== WIFI FUNCTIONS ==========
 void connectWiFi() {
   Serial.print("Connecting to WiFi: ");
   Serial.println(ssid);
   display.clearDisplay();
   display.setTextSize(1);
   display.setCursor(0, 0);
   display.println("Connecting WiFi...");
   display.display();
   
   // Set WiFi mode to station (client)
   WiFi.mode(WIFI_STA);
   WiFi.disconnect();
   delay(100);
   
   Serial.print("WiFi mode set. Starting connection...");
   // Try without channel first (Wokwi should auto-detect)
   WiFi.begin(ssid, password);
   
   int attempts = 0;
   while (WiFi.status() != WL_CONNECTED && attempts < 30) {
     delay(500);
     Serial.print(".");
     display.print(".");
     display.display();
     attempts++;
   }
   Serial.println();
   
   if (WiFi.status() == WL_CONNECTED) {
     Serial.println("WiFi Connected!");
     Serial.print("IP Address: ");
     Serial.println(WiFi.localIP());
     display.clearDisplay();
     display.setCursor(0, 0);
     display.println("WiFi Connected!");
     display.print("IP: ");
     display.println(WiFi.localIP());
     display.display();
     delay(2000);
     // Show API key after WiFi connection
     showApiKey();
   } else {
     Serial.println("WiFi Connection FAILED!");
     Serial.print("Status code: ");
     Serial.println(WiFi.status());
     display.clearDisplay();
     display.println("WiFi Failed!");
     display.display();
     delay(2000);
     showApiKey();
   }
 }
 
 // ========== API FUNCTIONS ==========
 void checkPairing() {
   HTTPClient http;
   WiFiClient *clientPtr = nullptr;
   WiFiClientSecure secureClient;
   WiFiClient plainClient;
   String url = String(backendUrl) + "/api/devices/check-usage";
   Serial.print("Checking pairing at: ");
   Serial.println(url);
   Serial.print("Sending API Key: ");
   Serial.println(API_KEY);
   Serial.print("Using protocol: ");
   Serial.println(backendUsesHttps ? "HTTPS" : "HTTP");
   
   if (backendUsesHttps) {
     secureClient.setInsecure();
     clientPtr = &secureClient;
   } else {
     clientPtr = &plainClient;
   }
   http.begin(*clientPtr, url);
   http.addHeader("X-API-Key", API_KEY);
   http.addHeader("ngrok-skip-browser-warning", "true");  // Skip ngrok warning page
   
   // Set timeout
   http.setTimeout(10000);
   
   int httpCode = http.GET();
   String response = http.getString();
   
   if (httpCode == -1) {
     Serial.println("Connection failed! Check:");
     Serial.println("1. Ngrok is running");
     Serial.println("2. Backend is running");
     Serial.println("3. URL is correct");
   }
   
   Serial.print("HTTP Code: ");
   Serial.println(httpCode);
   Serial.print("Response: ");
   Serial.println(response);
   
   bool wasPaired = isPaired;
   
   if (httpCode == 200) {
     isPaired = true;
     Serial.println("Device is PAIRED!");
     // If just got paired, fetch inventory and show it
     if (!wasPaired) {
       fetchInventory();
       checkUsageToday();
       currentScreen = "inventory";
       showInventory();
     }
   } else if (httpCode == 401) {
     isPaired = false;
     Serial.println("Device NOT paired (401 Unauthorized)");
     // If just got unpaired, show API key
     if (wasPaired) {
       currentScreen = "api_key";
       showApiKey();
     }
   } else {
     Serial.print("Unexpected HTTP code: ");
     Serial.println(httpCode);
   }
   
   http.end();
 }
 
 void fetchInventory() {
   HTTPClient http;
   WiFiClientSecure secureClient;
   WiFiClient plainClient;
   WiFiClient* clientPtr = nullptr;
   String url = String(backendUrl) + "/api/inventory";
   
   if (backendUsesHttps) {
     secureClient.setInsecure();
     clientPtr = &secureClient;
   } else {
     clientPtr = &plainClient;
   }
   http.begin(*clientPtr, url);
   http.addHeader("X-API-Key", API_KEY);
   
   int httpCode = http.GET();
   if (httpCode == 200) {
     String payload = http.getString();
     parseInventory(payload);
   }
   
   http.end();
 }
 
 void parseInventory(String json) {
   DynamicJsonDocument doc(4096);
   deserializeJson(doc, json);
   
   inventoryCount = 0;
   JsonArray items = doc["items"];
   for (JsonObject item : items) {
     if (inventoryCount < 20) {
       inventory[inventoryCount].id = item["id"].as<String>();
       inventory[inventoryCount].name = item["custom_name"].as<String>();
       if (inventory[inventoryCount].name == "null") {
         inventory[inventoryCount].name = "Unnamed";
       }
       inventory[inventoryCount].quantity = item["quantity"].as<float>();
       inventory[inventoryCount].unit = item["unit"].as<String>();
       inventory[inventoryCount].category = item["category"].as<String>();
       inventoryCount++;
     }
   }
 }
 
 void checkUsageToday() {
   HTTPClient http;
   WiFiClientSecure secureClient;
   WiFiClient plainClient;
   WiFiClient* clientPtr = nullptr;
   String url = String(backendUrl) + "/api/devices/check-usage";
   
   if (backendUsesHttps) {
     secureClient.setInsecure();
     clientPtr = &secureClient;
   } else {
     clientPtr = &plainClient;
   }
   http.begin(*clientPtr, url);
   http.addHeader("X-API-Key", API_KEY);
   
   int httpCode = http.GET();
   if (httpCode == 200) {
     String payload = http.getString();
     DynamicJsonDocument doc(256);
     deserializeJson(doc, payload);
     hasUsageToday = doc["hasUsageToday"].as<bool>();
   }
   
   http.end();
   
   // Update LED
   digitalWrite(BURNER_LED_PIN, hasUsageToday ? HIGH : LOW);
 }
 
 void logUsage(String inventoryId, float quantity) {
   HTTPClient http;
   WiFiClientSecure secureClient;
   WiFiClient plainClient;
   WiFiClient* clientPtr = nullptr;
   String url = String(backendUrl) + "/api/logs";
   
   if (backendUsesHttps) {
     secureClient.setInsecure();
     clientPtr = &secureClient;
   } else {
     clientPtr = &plainClient;
   }
   http.begin(*clientPtr, url);
   http.addHeader("X-API-Key", API_KEY);
   http.addHeader("Content-Type", "application/json");
   
   DynamicJsonDocument doc(256);
   doc["inventoryItemId"] = inventoryId;
   doc["quantity"] = quantity;
   
   String json;
   serializeJson(doc, json);
   
   int httpCode = http.POST(json);
   if (httpCode == 201) {
     showMessage("Usage logged!", 2000);
     checkUsageToday();
     fetchInventory();  // Refresh inventory
   } else {
     showMessage("Log failed!", 2000);
   }
   
   http.end();
 }
 
 // ========== INPUT HANDLERS ==========
 void handleKeypad(char key) {
   if (currentScreen == "api_key") {
     if (key == '*') {
       // Show checking message
       display.clearDisplay();
       display.setTextSize(1);
       display.setCursor(0, 20);
       display.println("Checking pairing...");
       display.display();
       
       checkPairing();
       
       if (isPaired) {
         fetchInventory();
         currentScreen = "inventory";
         showInventory();
       } else {
         // Still not paired, show message
         showMessage("Not paired yet", 2000);
         showApiKey();
       }
     }
   } else if (currentScreen == "inventory") {
     if (key == '*') {
       fetchInventory();
       showInventory();
     } else if (key == '#') {
       // Enter usage mode for selected item
       if (selectedIndex < inventoryCount) {
         enterUsageMode();
       }
     }
   } else if (currentScreen == "usage") {
     if (key >= '0' && key <= '9') {
       if (quantityInput.length() < 7) {
         quantityInput += key;
         showUsageScreen();
       }
     } else if (key == 'D') {
       if (quantityInput.indexOf('.') == -1) {
         if (quantityInput.length() == 0) {
           quantityInput = "0";
         }
         quantityInput += ".";
         showUsageScreen();
       }
     } else if (key == 'A') {
       quantityInput = "";
       showUsageScreen();
     } else if (key == '*') {
       if (quantityInput.length() > 0) {
         quantityInput.remove(quantityInput.length() - 1);
         showUsageScreen();
       } else {
         currentScreen = "inventory";
         showInventory();
       }
     } else if (key == '#') {
       confirmUsage();
     }
   }
 }
 
 void navigateUp() {
   if (currentScreen == "inventory" && inventoryCount > 0) {
     selectedIndex = (selectedIndex - 1 + inventoryCount) % inventoryCount;
     showInventory();
   }
 }
 
 void navigateDown() {
   if (currentScreen == "inventory" && inventoryCount > 0) {
     selectedIndex = (selectedIndex + 1) % inventoryCount;
     showInventory();
   }
 }
 
 void handleSelect() {
  if (buzzerActive) {
    stopBuzzer();
    showMessage("Alert acknowledged", 1500);
    return;
  }

   if (currentScreen == "api_key") {
     // Check pairing when on API key screen
     display.clearDisplay();
     display.setTextSize(1);
     display.setCursor(0, 20);
     display.println("Checking pairing...");
     display.display();
     
     checkPairing();
     
     if (isPaired) {
       fetchInventory();
       currentScreen = "inventory";
       showInventory();
     } else {
       showMessage("Not paired yet", 2000);
       showApiKey();
     }
   } else if (currentScreen == "inventory" && selectedIndex < inventoryCount) {
     enterUsageMode();
   }
 }
 
 void enterUsageMode() {
   currentScreen = "usage";
   quantityInput = "";
   showUsageScreen();
 }
 
 void confirmUsage() {
   float qty = 1.0;
   if (quantityInput.length() > 0 && quantityInput != ".") {
     qty = quantityInput.toFloat();
   }
   
   if (qty <= 0) {
     showMessage("Qty must be > 0", 2000);
     showUsageScreen();
     return;
   }
   
   logUsage(inventory[selectedIndex].id, qty);
   currentScreen = "inventory";
   quantityInput = "";
   showInventory();
 }

void monitorDoorSensor() {
  bool closed = digitalRead(DOOR_SENSOR_PIN) == LOW;
  if (closed != doorClosedState && (millis() - doorStateChangedAt) > doorDebounceMs) {
    doorClosedState = closed;
    doorStateChangedAt = millis();
    if (!closed) {
      doorOpenedSinceLastClose = true;
      Serial.println("Fridge door opened");
    } else {
      Serial.println("Fridge door closed");
      if (doorOpenedSinceLastClose) {
        handleDoorClosedAfterOpen();
        doorOpenedSinceLastClose = false;
      }
    }
  }
}

void handleDoorClosedAfterOpen() {
  showMessage("Fridge closed. Press Select to confirm.", 1500);
  Serial.println("Door closed after open, notifying backend and buzzing");
  if (isPaired) {
    sendDoorEventNotification();
  }
  startBuzzer();
}

void startBuzzer() {
  buzzerActive = true;
  digitalWrite(BUZZER_PIN, HIGH);
  Serial.println("Buzzer ON");
}

void stopBuzzer() {
  buzzerActive = false;
  digitalWrite(BUZZER_PIN, LOW);
  Serial.println("Buzzer OFF");
}

void sendDoorEventNotification() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  HTTPClient http;
  WiFiClientSecure secureClient;
  WiFiClient plainClient;
  WiFiClient* clientPtr = nullptr;
  String url = String(backendUrl) + "/api/notifications/device";

  if (backendUsesHttps) {
    secureClient.setInsecure();
    clientPtr = &secureClient;
  } else {
    clientPtr = &plainClient;
  }

  http.begin(*clientPtr, url);
  http.addHeader("X-API-Key", API_KEY);
  http.addHeader("Content-Type", "application/json");

  DynamicJsonDocument doc(256);
  doc["title"] = "Fridge door reminder";
  doc["body"] = "You just closed the fridge. Update your inventory or logs.";
  JsonObject meta = doc.createNestedObject("metadata");
  meta["event"] = "fridge-door";
  meta["timestamp"] = millis();

  String json;
  serializeJson(doc, json);
  int code = http.POST(json);
  String resp = http.getString();
  Serial.print("Notification POST code: ");
  Serial.println(code);
  Serial.print("Notification response: ");
  Serial.println(resp);
  http.end();
}
 
 void handleBurnerButton() {
   if (!isPaired) {
     showMessage("Device not paired!", 3000);
     return;
   }
   
   checkUsageToday();
   
   if (hasUsageToday) {
     // Turn on LED (simulate burner unlock)
     digitalWrite(BURNER_LED_PIN, HIGH);
     showMessage("Burner unlocked!", 2000);
     delay(2000);
     digitalWrite(BURNER_LED_PIN, LOW);
   } else {
     // Show warning
     showMessage("No usage logged today! Log usage first.", 5000);
   }
 }
 
 