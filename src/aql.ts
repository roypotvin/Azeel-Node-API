import { AzeelApiError, isAzeelSuccess } from "./errors.js";

export type AzQueryRunner = (
  sql: string,
  values: unknown[],
) => Promise<Record<string, unknown>>;

/**
 * TL / `azQuery` helpers (`key === "azQuery"`).
 */
export class AqlApi {
  constructor(private readonly runAzQuery: AzQueryRunner) {}

  /**
   * Run a TL query; returns the `data` field (must be an array).
   */
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values: unknown[] = [],
  ): Promise<T[]> {
    const r = await this.runAzQuery(sql, values);
    if (!isAzeelSuccess(r.suc)) {
      throw AzeelApiError.fromBody(r);
    }
    const data = r.data;
    if (data == null) {
      return [];
    }
    if (!Array.isArray(data)) {
      throw new Error("Azeel azQuery response `data` is not an array; use queryRaw()");
    }
    return data as T[];
  }

  /**
   * First row or `undefined` if `data` is empty.
   */
  async queryOne<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values: unknown[] = [],
  ): Promise<T | undefined> {
    const rows = await this.query<T>(sql, values);
    return rows[0];
  }

  /**
   * Full JSON body after a successful TL request (includes `total`, `page`, `limit` when present).
   */
  async queryRaw(sql: string, values: unknown[] = []): Promise<Record<string, unknown>> {
    const r = await this.runAzQuery(sql, values);
    if (!isAzeelSuccess(r.suc)) {
      throw AzeelApiError.fromBody(r);
    }
    return r;
  }
}
