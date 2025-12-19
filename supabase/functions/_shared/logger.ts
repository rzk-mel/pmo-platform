// Supabase Edge Functions - Shared Logger
// Structured logging with levels and context

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  functionName: string;
  requestId?: string;
  userId?: string;
  projectId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  data?: unknown;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private context: LogContext;
  private minLevel: LogLevel;

  private static levelOrder: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(functionName: string, minLevel: LogLevel = "info") {
    this.context = { functionName };
    this.minLevel = minLevel;
  }

  setRequestId(requestId: string): this {
    this.context.requestId = requestId;
    return this;
  }

  setUserId(userId: string): this {
    this.context.userId = userId;
    return this;
  }

  setProjectId(projectId: string): this {
    this.context.projectId = projectId;
    return this;
  }

  addContext(key: string, value: unknown): this {
    this.context[key] = value;
    return this;
  }

  private shouldLog(level: LogLevel): boolean {
    return Logger.levelOrder[level] >= Logger.levelOrder[this.minLevel];
  }

  private formatEntry(
    level: LogLevel,
    message: string,
    data?: unknown,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context },
    };

    if (data !== undefined) {
      entry.data = data;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private log(
    level: LogLevel,
    message: string,
    data?: unknown,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) return;

    const entry = this.formatEntry(level, message, data, error);
    const output = JSON.stringify(entry);

    switch (level) {
      case "debug":
      case "info":
        console.log(output);
        break;
      case "warn":
        console.warn(output);
        break;
      case "error":
        console.error(output);
        break;
    }
  }

  debug(message: string, data?: unknown): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: unknown): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log("warn", message, data);
  }

  error(message: string, error?: Error, data?: unknown): void {
    this.log("error", message, data, error);
  }

  // Create a child logger with additional context
  child(additionalContext: Partial<LogContext>): Logger {
    const child = new Logger(this.context.functionName, this.minLevel);
    child.context = { ...this.context, ...additionalContext };
    return child;
  }
}

export function createLogger(functionName: string): Logger {
  const minLevel = (Deno.env.get("LOG_LEVEL") as LogLevel) || "info";
  return new Logger(functionName, minLevel);
}

export { Logger };
