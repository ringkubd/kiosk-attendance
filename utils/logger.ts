// Logger utility

type LogLevel = "debug" | "info" | "warn" | "error";

// Default global logger instance used by static methods
class GlobalLogger {
  enabled: boolean = true;
  minLevel: LogLevel = "debug";

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  setMinLevel(level: LogLevel) {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false;

    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const currentIndex = levels.indexOf(level);
    const minIndex = levels.indexOf(this.minLevel);

    return currentIndex >= minIndex;
  }

  debug(message: string, ...args: any[]) {
    if (this.shouldLog("debug")) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.shouldLog("info")) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.shouldLog("warn")) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (this.shouldLog("error")) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

const defaultLogger = new GlobalLogger();

// Logger class for creating per-module loggers
export class Logger {
  private ctx?: string;

  constructor(ctx?: string) {
    this.ctx = ctx;
  }

  private formatMessage(message: string) {
    return this.ctx ? `[${this.ctx}] ${message}` : message;
  }

  debug(message: string, ...args: any[]) {
    defaultLogger.debug(this.formatMessage(message), ...args);
  }

  info(message: string, ...args: any[]) {
    defaultLogger.info(this.formatMessage(message), ...args);
  }

  warn(message: string, ...args: any[]) {
    defaultLogger.warn(this.formatMessage(message), ...args);
  }

  error(message: string, ...args: any[]) {
    defaultLogger.error(this.formatMessage(message), ...args);
  }

  // Static methods for direct usage: Logger.info("msg")
  static debug(message: string, ...args: any[]) {
    defaultLogger.debug(message, ...args);
  }

  static info(message: string, ...args: any[]) {
    defaultLogger.info(message, ...args);
  }

  static warn(message: string, ...args: any[]) {
    defaultLogger.warn(message, ...args);
  }

  static error(message: string, ...args: any[]) {
    defaultLogger.error(message, ...args);
  }

  static setEnabled(enabled: boolean) {
    defaultLogger.setEnabled(enabled);
  }

  static setMinLevel(level: LogLevel) {
    defaultLogger.setMinLevel(level);
  }
}

export default defaultLogger;
