/*
 * ITMS control-room receiver (Node 2) - ESP32 DevKit + Ra-02 (SX1278, 433 MHz) + I2C OLED
 *
 * Receives the 28-byte alert packets sent by heltec_tx.ino, prints each one on the Serial Monitor
 * (115200 baud) and shows the latest on the OLED. LoRa settings must match the transmitter.
 *
 * Arduino IDE: board "ESP32 Dev Module". Libraries: "RadioLib" and "U8g2".
 *
 * Wiring (as built):
 *   Ra-02:  VCC 3.3V, GND, MISO 19, MOSI 23, SCK 18, NSS 5, RST 4, DIO0 26, ANT 433 MHz antenna
 *   OLED:   VCC 3.3V, GND, SDA 21, SCL 22
 * Attach the antenna before powering the board.
 */
#include <Arduino.h>
#include <SPI.h>
#include <RadioLib.h>
#include <U8g2lib.h>

#define LORA_NSS   5
#define LORA_RST   4
#define LORA_DIO0  26
#define OLED_SH1106 0          // set to 1 if the OLED is an SH1106 (shifted picture) instead of SSD1306

// ---- LoRa settings: must be identical to heltec_tx.ino ----
const float  LORA_FREQ = 433.0;
const float  LORA_BW   = 125.0;
const uint8_t LORA_SF  = 9;
const uint8_t LORA_CR  = 5;
const uint8_t LORA_SYNC = 0x12;                 // private network (same as the SX1262 transmitter)
const unsigned long LINK_LOST_MS = 90000;       // no packet for this long = NO SIGNAL (heartbeat is 30 s)
// -----------------------------------------------------------

#pragma pack(push, 1)
struct Pkt {
  uint8_t  ver, node;
  uint16_t seq;
  uint32_t ts;            // unix time, seconds
  uint8_t  flags, sev, cls, conf;
  int16_t  acc_cms2;      // forward acceleration x100 (m/s2)
  uint16_t vert_mg, lat_mg, roll_dps10;
  int32_t  lat_e6, lon_e6;
};
#pragma pack(pop)
static_assert(sizeof(Pkt) == 28, "packet size");

const char *CLASS_NAMES[] = {"Rail_Gap", "Severe_Crack", "Severe_Gap", "Sleeper_Crack", "Sleeper_weak"};
const int32_t NO_FIX = 2147483647;

SX1278 radio = new Module(LORA_NSS, LORA_DIO0, LORA_RST, RADIOLIB_NC);

#if OLED_SH1106
U8G2_SH1106_128X64_NONAME_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE);
#else
U8G2_SSD1306_128X64_NONAME_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE);
#endif

volatile bool rxFlag = false;
void IRAM_ATTR onRx() { rxFlag = true; }

Pkt last;
bool haveLast = false;
float lastRssi = 0, lastSnr = 0;
unsigned long lastRxMs = 0, lastDraw = 0;
unsigned long rxCount = 0, badCount = 0;

void flagsText(uint8_t f, char *out, size_t n) {
  out[0] = 0;
  auto add = [&](const char *s) {
    if (out[0]) strncat(out, "+", n - strlen(out) - 1);
    strncat(out, s, n - strlen(out) - 1);
  };
  if (f & 128) add("HEARTBEAT");
  if (f & 1)   add("DEFECT");
  if (f & 2)   add("ACCEL");
  if (f & 4)   add("BRAKE");
  if (f & 8)   add("WOBBLE");
  if (f & 16)  add("VIB");
  if (f & 32)  add("JERK");
  if (!out[0]) strncpy(out, "-", n);
}

void drawScreen() {
  char l[40], ft[40];
  unsigned long now = millis();
  bool lost = haveLast ? (now - lastRxMs > LINK_LOST_MS) : false;
  bool alertNow = haveLast && !lost && last.sev >= 2 && last.flags != 128 && (now - lastRxMs < 6000);

  oled.clearBuffer();
  oled.setFont(u8g2_font_6x10_tf);

  snprintf(l, sizeof l, "ITMS RX %.1fMHz", LORA_FREQ);
  if (alertNow) {                                   // inverted title bar for a fresh ALERT
    oled.drawBox(0, 0, 128, 11);
    oled.setDrawColor(0);
    oled.drawStr(1, 9, l);
    oled.setDrawColor(1);
  } else {
    oled.drawStr(0, 9, l);
  }

  if (!haveLast) {
    oled.drawStr(0, 24, "Waiting for packets");
    snprintf(l, sizeof l, "bad: %lu", badCount);
    oled.drawStr(0, 36, l);
    oled.sendBuffer();
    lastDraw = now;
    return;
  }

  snprintf(l, sizeof l, "n%u #%u S%u rx:%lu", last.node, last.seq, last.sev, rxCount);
  oled.drawStr(0, 21, l);

  flagsText(last.flags, ft, sizeof ft);
  oled.drawStr(0, 33, ft);

  bool hasLoc = last.lat_e6 != NO_FIX;
  if ((last.flags & 1) && last.cls < 5 && !(hasLoc && (now / 3000) % 2)) {
    snprintf(l, sizeof l, "%s %u%%", CLASS_NAMES[last.cls], last.conf);
  } else if (hasLoc && (now / 3000) % 2) {
    snprintf(l, sizeof l, "%.4f,%.4f", last.lat_e6 / 1e6, last.lon_e6 / 1e6);
  } else {
    snprintf(l, sizeof l, "a%+.1f v%.2f l%.2f r%.0f", last.acc_cms2 / 100.0, last.vert_mg / 1000.0,
             last.lat_mg / 1000.0, last.roll_dps10 / 10.0);
  }
  oled.drawStr(0, 45, l);

  if (lost)
    snprintf(l, sizeof l, "NO SIGNAL %lus", (now - lastRxMs) / 1000);
  else
    snprintf(l, sizeof l, "%.0fdBm %.1fdB %lus", lastRssi, lastSnr, (now - lastRxMs) / 1000);
  oled.drawStr(0, 57, l);

  oled.sendBuffer();
  lastDraw = now;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  oled.begin();
  oled.setFont(u8g2_font_6x10_tf);

  int st = radio.begin(LORA_FREQ, LORA_BW, LORA_SF, LORA_CR, LORA_SYNC, 10, 8, 0);
  if (st != RADIOLIB_ERR_NONE) {
    Serial.printf("LoRa init failed, code %d (check Ra-02 wiring and 3.3 V)\n", st);
    oled.clearBuffer();
    oled.drawStr(0, 12, "LoRa init FAILED");
    char l[24];
    snprintf(l, sizeof l, "code %d", st);
    oled.drawStr(0, 28, l);
    oled.drawStr(0, 44, "check wiring");
    oled.sendBuffer();
    while (true) delay(1000);
  }
  radio.setCRC(true);
  radio.setPacketReceivedAction(onRx);
  radio.startReceive();
  Serial.println("ITMS receiver ready");
  drawScreen();
}

void loop() {
  if (millis() - lastDraw >= 500) drawScreen();
  if (!rxFlag) return;
  rxFlag = false;

  size_t n = radio.getPacketLength();
  uint8_t buf[64];
  int st = radio.readData(buf, n < sizeof(buf) ? n : sizeof(buf));
  float rssi = radio.getRSSI(), snr = radio.getSNR();
  radio.startReceive();

  if (st != RADIOLIB_ERR_NONE || n != sizeof(Pkt) || buf[0] != 0xA1) {
    badCount++;
    Serial.printf("bad packet (%u bytes, code %d)\n", (unsigned)n, st);
    return;
  }
  memcpy(&last, buf, sizeof(last));
  haveLast = true;
  lastRssi = rssi;
  lastSnr = snr;
  lastRxMs = millis();
  rxCount++;

  char ft[40];
  flagsText(last.flags, ft, sizeof ft);
  Serial.printf("node %u seq %u t=%lu sev=%u [%s]", last.node, last.seq, (unsigned long)last.ts,
                last.sev, ft);
  if (last.flags & 1)
    Serial.printf(" defect=%s %u%%", last.cls < 5 ? CLASS_NAMES[last.cls] : "?", last.conf);
  Serial.printf(" acc=%.2f m/s2 vert=%.3f g lat=%.3f g roll=%.1f dps", last.acc_cms2 / 100.0,
                last.vert_mg / 1000.0, last.lat_mg / 1000.0, last.roll_dps10 / 10.0);
  if (last.lat_e6 != NO_FIX)
    Serial.printf(" loc=%.6f,%.6f", last.lat_e6 / 1e6, last.lon_e6 / 1e6);
  Serial.printf("  RSSI %.0f dBm SNR %.1f dB\n", rssi, snr);
  drawScreen();
}
