export type DefectType =
  | "sleeper_crack" | "rail_crack" | "rust" | "ballast" | "fastener" | "burnt" | "jerk" | "orientation";
export type Severity = "low" | "medium" | "high" | "critical";
export type EventStatus = "open" | "ack" | "resolved";

export interface TrackEvent {
  id: string;
  journeyId: string;
  type: DefectType;
  severity: Severity;
  confidence: number;
  km: number;
  ts: number;
  status: EventStatus;
}

export interface Sample {
  t: number;
  speed: number;
  vib: number;
  ax: number;
  ay: number;
  az: number;
  roll: number;
  pitch: number;
  yaw: number;
  temp: number;
}

export interface JourneySim {
  km: number;
  speed: number;
  target: number;
  spikeV: number;
  spikeRoll: number;
  sample: Sample;
  history: Sample[];
  seq: number;
  lastEvent?: TrackEvent;
  laps: number;
}

export interface Operator {
  name: string;
  empId: string;
  role: string;
  division: string;
  shift: string;
  phone: string;
  email: string;
}

export interface HardwareConfig {
  mode: "simulator" | "hardware";
  ip: string;
  port: string;
  streamPath: string;
  sensorPath: string;
  statusPath: string;
  connected: boolean;
}

export interface Prefs {
  timeScale: number;
  vibWarn: number;
  eventRate: number;
  navCollapsed: boolean;
  overlay: boolean;
}
