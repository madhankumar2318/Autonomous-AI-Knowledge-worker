// Centralized Structured Security Audit & Telemetry Logger

export type AuditEventType =
  | "AUTH_LOGIN_SUCCESS"
  | "AUTH_LOGIN_FAILED"
  | "ACCOUNT_LOCKED"
  | "PASSWORD_CHANGED"
  | "FILE_UPLOADED"
  | "FILE_DELETED"
  | "THREAD_DELETED"
  | "RATE_LIMIT_TRIGGERED"
  | "CSRF_BLOCKED"
  | "MALICIOUS_FILE_BLOCKED";

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: AuditEventType;
  severity: "INFO" | "WARN" | "CRITICAL";
  username?: string;
  ip: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

// Global in-memory ring buffer for audit logs (capped to 500 recent events)
const globalLogs = globalThis as unknown as {
  __AKW_AUDIT_LOGS__?: AuditEvent[];
};

if (!globalLogs.__AKW_AUDIT_LOGS__) {
  globalLogs.__AKW_AUDIT_LOGS__ = [];
}

const auditLogsBuffer = globalLogs.__AKW_AUDIT_LOGS__;
const MAX_LOGS = 500;

export function logAuditEvent(params: {
  type: AuditEventType;
  severity?: "INFO" | "WARN" | "CRITICAL";
  username?: string;
  ip: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}): AuditEvent {
  const severity = params.severity || (
    params.type === "ACCOUNT_LOCKED" || params.type === "MALICIOUS_FILE_BLOCKED"
      ? "CRITICAL"
      : params.type === "AUTH_LOGIN_FAILED" || params.type === "CSRF_BLOCKED" || params.type === "RATE_LIMIT_TRIGGERED"
      ? "WARN"
      : "INFO"
  );

  const event: AuditEvent = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    type: params.type,
    severity,
    username: params.username || "anonymous",
    ip: params.ip,
    userAgent: params.userAgent,
    details: params.details,
  };

  // Prepend to ring buffer
  auditLogsBuffer.unshift(event);
  if (auditLogsBuffer.length > MAX_LOGS) {
    auditLogsBuffer.pop();
  }

  // Structured console log for container/serverless telemetry collectors
  const icon = severity === "CRITICAL" ? "🚨" : severity === "WARN" ? "⚠️" : "🔒";
  const logPrefix = `[SECURITY_AUDIT] ${icon} [${event.type}] [${event.severity}]`;
  const logPayload = JSON.stringify({
    timestamp: event.timestamp,
    user: event.username,
    ip: event.ip,
    details: event.details,
  });

  if (severity === "CRITICAL") {
    console.error(`${logPrefix} ${logPayload}`);
  } else if (severity === "WARN") {
    console.warn(`${logPrefix} ${logPayload}`);
  } else {
    console.log(`${logPrefix} ${logPayload}`);
  }

  return event;
}

export function getRecentAuditLogs(limit = 100): AuditEvent[] {
  return auditLogsBuffer.slice(0, Math.min(limit, MAX_LOGS));
}
