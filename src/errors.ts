export function isAzeelSuccess(suc: unknown): boolean {
  return suc === true || suc === 1 || suc === "1";
}

/**
 * Normalized failure for HTTP and API-level errors.
 */
export class AzeelApiError extends Error {
  readonly name = "AzeelApiError";

  constructor(
    message: string,
    readonly statusCode: number | null = null,
    readonly body: unknown = null,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }

  static fromHttp(status: number, bodyText: string): AzeelApiError {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(bodyText) as unknown;
    } catch {
      /* keep raw */
    }
    const msg =
      typeof parsed === "object" && parsed !== null && "msg" in parsed
        ? String((parsed as { msg: unknown }).msg)
        : bodyText.slice(0, 500);
    return new AzeelApiError(msg || `HTTP ${status}`, status, parsed);
  }

  static fromBody(body: Record<string, unknown>): AzeelApiError {
    const msg = body.msg != null ? String(body.msg) : "Azeel API returned suc=false";
    return new AzeelApiError(msg, 200, body);
  }
}
