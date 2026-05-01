/**
 * Logger leve com níveis. Em prod silencia `debug` e `info` por
 * default, mantendo só `warn` e `error`. Pra ligar em prod, exporte
 * `NEXT_PUBLIC_DEBUG_LOG=1`.
 *
 * Por que não logar tudo em prod: warn/error são úteis pra investigar
 * incidentes; debug/info viram ruído e atrapalham achar o problema
 * real.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const isDev =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

const debugFlag =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEBUG_LOG === "1";

const ENABLED: Record<LogLevel, boolean> = {
  debug: isDev || debugFlag,
  info: isDev || debugFlag,
  warn: true,
  error: true,
};

function fmt(prefix: string, args: unknown[]): unknown[] {
  return [`[${prefix}]`, ...args];
}

export const logger = {
  debug(prefix: string, ...args: unknown[]) {
    if (ENABLED.debug) console.log(...fmt(prefix, args));
  },
  info(prefix: string, ...args: unknown[]) {
    if (ENABLED.info) console.info(...fmt(prefix, args));
  },
  warn(prefix: string, ...args: unknown[]) {
    if (ENABLED.warn) console.warn(...fmt(prefix, args));
  },
  error(prefix: string, ...args: unknown[]) {
    if (ENABLED.error) console.error(...fmt(prefix, args));
  },
};
