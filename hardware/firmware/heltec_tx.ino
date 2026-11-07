/*
 * ITMS node transmitter - Heltec WiFi LoRa 32 V3.2 (SX1262, ESP32-S3) + external I2C OLED
 *
 * The Radxa joins this board's Wi-Fi access point "ITMS-NODE" and sends each alert as one
 * 28-byte UDP packet to 192.168.4.1:4210. This sketch puts the same 28 bytes on LoRa, replies to
 * the Radxa with a 4-byte ack (0xAC, status 0 = sent, seq uint16 little-endian), and shows on the
 * OLED: Wi-Fi/Radxa link, UDP activity, what was transmitted and whether LoRa succeeded.
 *
 * Arduino IDE: board "Heltec WiFi LoRa 32(V3)" (Heltec ESP32 package).
 * Libraries: "RadioLib" and "U8g2".
 * OLED wiring: VCC 3.3V, GND, SDA GPIO4, SCL GPIO5.
 * ATTACH THE 433 MHz ANTENNA BEFORE POWERING THE BOARD (transmitting without one can damage it).
 */
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <SPI.h>
#include <RadioLib.h>
#include <U8g2lib.h>

// Heltec WiFi LoRa 32 V3 LoRa pins
#define LORA_NSS   8
#define LORA_SCK   9
#define LORA_MOSI  10
#define LORA_MISO  11
#define LORA_RST   12
#define LORA_BUSY  13
#define LORA_DIO1  14

// External OLED
#define OLED_SDA   4
#define OLED_SCL   5
#define OLED_SH1106 0          // set to 1 if the OLED is an SH1106 (shifted picture) instead of SSD1306

// ---- settings ----
const char *AP_SSID = "ITMS-NODE";
const char *AP_PASS = "itms12345";          // at least 8 characters
const uint16_t UDP_PORT = 4210;

const float  LORA_FREQ  = 433.0;            // MHz. Must match the receiver and your board's band.
const float  LORA_BW    = 125.0;            // kHz
const uint8_t LORA_SF   = 9;                // 7 = fastest, 12 = longest range
const uint8_t LORA_CR   = 5;                // coding rate 4/5
const int8_t LORA_POWER = 14;               // dBm (max 22). Check the local rules for 433 MHz.
// ------------------

const size_t  PKT_SIZE = 28;
const uint8_t PKT_VER  = 0xA1;

SX1262 radio = new Module(LORA_NSS, LORA_DIO1, LORA_RST, LORA_BUSY);
WiFiUDP udp;

#if OLED_SH1106
U8G2_SH1106_128X64_NONAME_F_SW_I2C oled(U8G2_R0, OLED_SCL, OLED_SDA, U8X8_PIN_NONE);
#else
U8G2_SSD1306_128X64_NONAME_F_SW_I2C oled(U8G2_R0, OLED_SCL, OLED_SDA, U8X8_PIN_NONE);
#endif

struct Status {
  uint32_t ok = 0, fail = 0;
  uint16_t seq = 0;
  uint8_t flags = 0, sev = 0;
  uint32_t lastTxMs = 0, lastUdpMs = 0;
  int8_t result = -1;                       // -1 nothing yet, 0 sent, 2 LoRa error, 3 bad UDP packet
  bool sending = false;
  bool any = false;
} S;

uint32_t lastDraw = 0;

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
  uint32_t now = millis();
  oled.clearBuffer();
  oled.setFont(u8g2_font_6x10_tf);

  snprintf(l, sizeof l, "ITMS NODE %.1fMHz", LORA_FREQ);
  oled.drawStr(0, 9, l);

  if (WiFi.softAPgetStationNum() == 0)
    snprintf(l, sizeof l, "Radxa: no Wi-Fi link");
  else if (S.lastUdpMs == 0)
    snprintf(l, sizeof l, "Radxa:linked UDP --");
  else
    snprintf(l, sizeof l, "Radxa:linked UDP %lus", (unsigned long)((now - S.lastUdpMs) / 1000));
  oled.drawStr(0, 21, l);

  snprintf(l, sizeof l, "TX#%u ok:%lu fail:%lu", S.seq, (unsigned long)S.ok, (unsigned long)S.fail);
  oled.drawStr(0, 33, l);

  if (S.any) {
    flagsText(S.flags, ft, sizeof ft);
    snprintf(l, sizeof l, "S%u %s", S.sev, ft);
  } else {
    snprintf(l, sizeof l, "No packet yet");
  }
  oled.drawStr(0, 45, l);

  if (S.sending)
    snprintf(l, sizeof l, "LoRa: SENDING...");
  else if (S.result == 0)
    snprintf(l, sizeof l, "LoRa: SENT %lus ago", (unsigned long)((now - S.lastTxMs) / 1000));
  else if (S.result == 2)
    snprintf(l, sizeof l, "LoRa: FAILED");
  else if (S.result == 3)
    snprintf(l, sizeof l, "UDP: bad packet");
  else
    snprintf(l, sizeof l, "LoRa: waiting");
  oled.drawStr(0, 57, l);

  oled.sendBuffer();
  lastDraw = now;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\nITMS LoRa transmitter");

  oled.begin();
  oled.clearBuffer();
  oled.setFont(u8g2_font_6x10_tf);
  oled.drawStr(0, 12, "ITMS NODE");
  oled.drawStr(0, 28, "Starting...");
  oled.sendBuffer();

  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);
  Serial.print("AP ");
  Serial.print(AP_SSID);
  Serial.print(" at ");
  Serial.println(WiFi.softAPIP());
  udp.begin(UDP_PORT);

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);
  int st = radio.begin(LORA_FREQ, LORA_BW, LORA_SF, LORA_CR,
                       RADIOLIB_SX126X_SYNC_WORD_PRIVATE, LORA_POWER, 8, 1.8, false);
  if (st != RADIOLIB_ERR_NONE) {
    Serial.printf("LoRa init failed, code %d\n", st);
    oled.clearBuffer();
    oled.drawStr(0, 12, "LoRa init FAILED");
    char l[24];
    snprintf(l, sizeof l, "code %d", st);
    oled.drawStr(0, 28, l);
    oled.sendBuffer();
    while (true) delay(1000);
  }
  Serial.printf("LoRa ready: %.1f MHz SF%d BW%.0f, %d dBm\n", LORA_FREQ, LORA_SF, LORA_BW, LORA_POWER);
  drawScreen();
}

void loop() {
  if (millis() - lastDraw >= 500) drawScreen();

  int n = udp.parsePacket();
  if (n <= 0) return;

  uint8_t buf[64];
  int len = udp.read(buf, sizeof(buf));
  IPAddress rip = udp.remoteIP();
  uint16_t rport = udp.remotePort();
  S.lastUdpMs = millis();

  uint8_t status = 1;                       // 1 = bad packet
  uint16_t seq = 0;
  if (len == (int)PKT_SIZE && buf[0] == PKT_VER) {
    seq = buf[2] | (buf[3] << 8);
    S.seq = seq;
    S.flags = buf[8];
    S.sev = buf[9];
    S.any = true;
    S.sending = true;
    drawScreen();                           // show "SENDING..." before the radio blocks
    unsigned long t0 = millis();
    int st = radio.transmit(buf, PKT_SIZE);
    S.sending = false;
    if (st == RADIOLIB_ERR_NONE) {
      status = 0;
      S.ok++;
      S.result = 0;
      S.lastTxMs = millis();
    } else {
      status = 2;                           // 2 = radio error
      S.fail++;
      S.result = 2;
    }
    Serial.printf("seq %u flags 0x%02X sev %u -> LoRa %s (%lu ms)\n", seq, buf[8], buf[9],
                  status == 0 ? "OK" : "FAILED", millis() - t0);
  } else {
    S.result = 3;
    Serial.printf("ignored UDP packet, %d bytes\n", len);
  }

  uint8_t ack[4] = {0xAC, status, (uint8_t)(seq & 0xFF), (uint8_t)(seq >> 8)};
  udp.beginPacket(rip, rport);
  udp.write(ack, 4);
  udp.endPacket();
  drawScreen();
}
