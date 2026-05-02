import { AzeelApiError, isAzeelSuccess } from "./errors.js";
import { createUid, hashUid } from "./crypto.js";
import { KeyRequestBuilder } from "./builder.js";
import type { AzeelProgrammaticPayload } from "./types.js";
import { AqlApi } from "./aql.js";

export const AZ_QUERY_KEY = "azQuery";

export interface AzeelClientConfig {
  account: string;
  apiKey1: string;
  apiKey2: string;
  mode?: "live" | "beta" | "alpha";
  /** Sent as `did`; default `azeel-node-api`. */
  deviceId?: string;
  /** Override full API URL (no trailing slash). Normally derived from `account` + `mode`. */
  baseUrl?: string;
  /** Override `fetch` (e.g. tests). @default globalThis.fetch */
  fetchImpl?: typeof globalThis.fetch;
  /** Request timeout in ms; @default 300_000 */
  timeoutMs?: number;
}

export class AzeelClient {
  readonly aql: AqlApi;

  constructor(private readonly config: AzeelClientConfig) {
    this.aql = new AqlApi((sql, vals) =>
      this.run(AZ_QUERY_KEY, { azQuery: sql, azQueryVals: vals }),
    );
  }

  private resolveUrl(): string {
    const c = this.config;
    if (c.baseUrl) {
      return c.baseUrl.replace(/\/$/, "");
    }
    const mode = c.mode ?? "live";
    const path = mode === "live" ? "" : `${mode}/`;
    return `https://${c.account}.azeel.net/${path}api`;
  }

  /**
   * Start a programmatic request for `key` (e.g. `Projects.get`, `Tasks.edit`).
   */
  key(requestKey: string): KeyRequestBuilder {
    return new KeyRequestBuilder((k, payload) => this.runProgrammatic(k, payload), requestKey);
  }

  private runProgrammatic(requestKey: string, payload: AzeelProgrammaticPayload): Promise<Record<string, unknown>> {
    return this.run(requestKey, {
      cols: payload.cols,
      filters: payload.filters,
      data: payload.data,
      opts: payload.opts,
    });
  }

  /**
   * Low-level POST. For `azQuery`, pass `{ azQuery, azQueryVals }`.
   * For other keys, pass `{ cols, filters, data, opts }` (missing keys default to empty).
   * Throws {@link AzeelApiError} when HTTP fails or JSON indicates failure (`suc` falsey).
   */
  async run(requestKey: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const inner =
      requestKey === AZ_QUERY_KEY
        ? body
        : {
            cols: body.cols ?? [],
            filters: body.filters ?? [],
            data: body.data ?? {},
            opts: body.opts ?? {},
          };

    const uid = createUid(25);
    const huid = hashUid(uid, this.config.apiKey2);
    const envelope = {
      key: requestKey,
      d: JSON.stringify(inner),
      bz: this.config.account,
      did: this.config.deviceId ?? "azeel-node-api",
      ak: this.config.apiKey1,
      uid,
      huid,
    };

    const url = this.resolveUrl();
    const fetchImpl = this.config.fetchImpl ?? globalThis.fetch;
    const timeoutMs = this.config.timeoutMs ?? 300_000;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(envelope),
        signal: ac.signal,
      });
    } catch (e) {
      clearTimeout(t);
      if (e instanceof Error && e.name === "AbortError") {
        throw new AzeelApiError(`Request timed out after ${timeoutMs}ms`, null, null, { cause: e });
      }
      throw e;
    } finally {
      clearTimeout(t);
    }

    const text = await res.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      /* non-json */
    }

    if (!res.ok) {
      throw AzeelApiError.fromHttp(res.status, text);
    }

    if (!parsed || typeof parsed !== "object") {
      throw new AzeelApiError("Invalid JSON response", res.status, text);
    }

    if (!isAzeelSuccess(parsed.suc)) {
      throw AzeelApiError.fromBody(parsed);
    }

    return parsed;
  }
}

export function createClient(config: AzeelClientConfig): AzeelClient {
  return new AzeelClient(config);
}
