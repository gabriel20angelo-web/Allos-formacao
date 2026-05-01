import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("warn e error sempre logam, com prefixo entre []", async () => {
    const { logger } = await import("./logger");
    logger.warn("CTX", "warning msg");
    logger.error("CTX", "error msg");
    expect(warnSpy).toHaveBeenCalledWith("[CTX]", "warning msg");
    expect(errorSpy).toHaveBeenCalledWith("[CTX]", "error msg");
  });

  it("debug e info logam em dev (NODE_ENV != production)", async () => {
    // Vitest roda em mode test, NODE_ENV pode ser "test" — não é production,
    // logo debug/info devem passar.
    const { logger } = await import("./logger");
    logger.debug("CTX", "debug msg");
    logger.info("CTX", "info msg");
    expect(logSpy).toHaveBeenCalledWith("[CTX]", "debug msg");
    expect(infoSpy).toHaveBeenCalledWith("[CTX]", "info msg");
  });
});
