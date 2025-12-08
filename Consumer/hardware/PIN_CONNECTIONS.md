# ESP32 Pin Connections Reference

## Complete Pin Mapping

### OLED Display (SSD1306 - I2C)
| OLED Pin | ESP32 Pin | Notes |
|----------|-----------|-------|
| VCC | 3.3V | Power |
| GND | GND | Ground |
| SDA | GPIO 21 | I2C Data |
| SCL | GPIO 22 | I2C Clock |

---

### 4x4 Matrix Keypad

#### Row Pins (4 rows):
| Keypad Row | ESP32 Pin |
|------------|-----------|
| Row 1 | GPIO 19 |
| Row 2 | GPIO 18 |
| Row 3 | GPIO 5 |
| Row 4 | GPIO 17 |

#### Column Pins (4 columns):
| Keypad Column | ESP32 Pin |
|---------------|-----------|
| Column 1 | GPIO 16 |
| Column 2 | GPIO 4 |
| Column 3 | GPIO 0 |
| Column 4 | GPIO 2 |

**Keypad Layout:**
```
[1] [2] [3] [A]
[4] [5] [6] [B]
[7] [8] [9] [C]
[*] [0] [#] [D]
```

---

### LED (Burner Indicator)
| Component | ESP32 Pin | Notes |
|-----------|-----------|-------|
| LED Anode (+) | GPIO 25 | Through 220Ω resistor |
| LED Cathode (-) | GND | Direct to ground |

**Resistor:** 220Ω between GPIO 25 and LED anode

---

### Push Buttons (All with 10kΩ pull-up resistors)

#### Burner Button:
| Component | ESP32 Pin | Notes |
|-----------|-----------|-------|
| Button Pin 1 | GPIO 26 | With 10kΩ pull-up to 3.3V |
| Button Pin 2 | GND | Other side to ground |

#### Navigation Buttons:
| Button | ESP32 Pin | Notes |
|--------|-----------|-------|
| Up Button | GPIO 32 | With 10kΩ pull-up to 3.3V |
| Down Button | GPIO 33 | With 10kΩ pull-up to 3.3V |
| Select Button | GPIO 27 | With 10kΩ pull-up to 3.3V |

**Note:** All buttons connect one side to GPIO pin, other side to GND. Use internal pull-up or external 10kΩ resistor to 3.3V.

---

## Complete Pin Summary

### GPIO Pins Used:
- **GPIO 0** - Keypad Column 3
- **GPIO 2** - Keypad Column 4
- **GPIO 4** - Keypad Column 2
- **GPIO 5** - Keypad Row 3
- **GPIO 16** - Keypad Column 1
- **GPIO 17** - Keypad Row 4
- **GPIO 18** - Keypad Row 2
- **GPIO 19** - Keypad Row 1
- **GPIO 21** - OLED SDA (I2C)
- **GPIO 22** - OLED SCL (I2C)
- **GPIO 25** - Burner LED
- **GPIO 26** - Burner Button
- **GPIO 27** - Select Button
- **GPIO 32** - Up Button
- **GPIO 33** - Down Button

### Power Pins:
- **3.3V** - OLED VCC, Button pull-ups
- **GND** - All ground connections

---

## Wiring Diagram (Text)

```
ESP32                    Components
─────────────────────────────────────────────
GPIO 21 ──────────────── OLED SDA
GPIO 22 ──────────────── OLED SCL
3.3V    ──────────────── OLED VCC
GND     ──────────────── OLED GND

GPIO 19 ──────────────── Keypad Row 1
GPIO 18 ──────────────── Keypad Row 2
GPIO 5  ──────────────── Keypad Row 3
GPIO 17 ──────────────── Keypad Row 4
GPIO 16 ──────────────── Keypad Col 1
GPIO 4  ──────────────── Keypad Col 2
GPIO 0  ──────────────── Keypad Col 3
GPIO 2  ──────────────── Keypad Col 4

GPIO 25 ──[220Ω]─────── LED (+)
GND     ──────────────── LED (-)

GPIO 26 ──────────────── Burner Button
GPIO 32 ──────────────── Up Button
GPIO 33 ──────────────── Down Button
GPIO 27 ──────────────── Select Button
(All buttons: other side to GND)
```

---

## For Wokwi Simulation

In Wokwi, you can use these exact pin numbers. The simulator will handle the connections visually. Just make sure:

1. **OLED**: I2C connection to GPIO 21 (SDA) and GPIO 22 (SCL)
2. **Keypad**: Connect all 8 pins (4 rows + 4 columns) to the specified GPIOs
3. **LED**: Connect to GPIO 25 with a resistor
4. **Buttons**: Connect to their respective GPIO pins

---

## Important Notes

⚠️ **GPIO 0** is also the BOOT button on ESP32 - avoid pressing it during operation
⚠️ **GPIO 2** is connected to onboard LED on some ESP32 boards
⚠️ All GPIO pins are 3.3V logic - don't exceed this voltage
⚠️ Use pull-up resistors (10kΩ) for buttons or enable internal pull-ups in code

---

## Quick Reference Card

```
┌─────────────────────────────────┐
│  ESP32 Foodprint Device Pins    │
├─────────────────────────────────┤
│ OLED:    21 (SDA), 22 (SCL)     │
│ Keypad:  19,18,5,17 (rows)      │
│          16,4,0,2 (cols)        │
│ LED:     25                      │
│ Buttons: 26,32,33,27             │
└─────────────────────────────────┘
```

