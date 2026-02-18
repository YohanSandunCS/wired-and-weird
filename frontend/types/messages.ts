export type MessageType = "ping" | "pong" | "telemetry" | "event" | "command" | "vision_frame";

export interface BaseMessage<T = any> {
  type: MessageType;
  robotId: string;
  payload?: T;
  timestamp?: number;
}

export interface PingMessage extends BaseMessage {
  type: "ping";
  timestamp: number;
}

export interface PongMessage extends BaseMessage {
  type: "pong";
  timestamp: number;
}

export interface TelemetryMessage extends BaseMessage {
  type: "telemetry";
  payload: {
    battery: number;
  };
  timestamp: number;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: "info" | "error" | "success";
}

export interface Robot {
  robotId: string;
  name?: string;
  isOnline?: boolean;
  battery?: number;
  lastTelemetryUpdate?: number;
}

export interface CommandMessage extends BaseMessage {
  type: "command";
  payload: {
    action: "move" | "stop";
    direction?: "forward" | "backward" | "left" | "right";
  };
  timestamp: number;
}

export interface VisionFrameMessage extends BaseMessage {
  type: "vision_frame";
  role: string;
  robotId: string;
  payload: {
    mime: "image/jpeg";
    width: number;
    height: number;
    quality: number;
    data: string; // base64 encoded image
  };
  timestamp: number;
}

export interface TeamSession {
  teamCode: string;
  loggedIn: boolean;
}