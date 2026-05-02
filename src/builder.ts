import type { AzeelFilter, AzeelProgrammaticPayload } from "./types.js";

/**
 * Fluent builder for programmatic API keys (e.g. `Tasks.get`, `Projects.insert`).
 */
export class KeyRequestBuilder {
  private readonly cols: string[] = [];
  private readonly filters: AzeelFilter[] = [];
  private readonly data: Record<string, unknown> = {};
  private readonly opts: Record<string, unknown> = {};

  constructor(
    private readonly submit: (key: string, payload: AzeelProgrammaticPayload) => Promise<Record<string, unknown>>,
    private readonly requestKey: string,
  ) {}

  columns(...cols: string[]): this {
    this.cols.push(...cols);
    return this;
  }

  /** If `asName` is set, sends `col as asName` in the column list. */
  column(col: string, asName?: string): this {
    this.cols.push(asName ? `${col} as ${asName}` : col);
    return this;
  }

  filter(column: string, value: unknown, filterType = "eq"): this {
    this.filters.push({ type: filterType, col: column, val: value });
    return this;
  }

  filterObject(filter: AzeelFilter): this {
    this.filters.push(filter);
    return this;
  }

  /** Body / parameter fields for insert, update, and custom actions. */
  set(field: string, value: unknown): this {
    this.data[field] = value;
    return this;
  }

  setMany(fields: Record<string, unknown>): this {
    Object.assign(this.data, fields);
    return this;
  }

  orderBy(column: string, direction: "ASC" | "DESC" = "ASC"): this {
    const order = (this.opts.order ??= []) as { col: string; dir: string }[];
    order.push({ col: column, dir: direction });
    return this;
  }

  limit(n: number): this {
    this.opts.limit = n;
    return this;
  }

  page(n: number): this {
    this.opts.page = n;
    return this;
  }

  option(key: string, value: unknown): this {
    this.opts[key] = value;
    return this;
  }

  addGroup(column: string): this {
    const group = (this.opts.group ??= []) as { col: string }[];
    group.push({ col: column });
    return this;
  }

  /** Replace the entire `opts` object (rare). */
  optsObject(opts: Record<string, unknown>): this {
    for (const k of Object.keys(this.opts)) {
      delete this.opts[k];
    }
    Object.assign(this.opts, opts);
    return this;
  }

  /** Full JSON body from the server; throws if `suc` is falsey. */
  execute(): Promise<Record<string, unknown>> {
    const payload: AzeelProgrammaticPayload = {
      cols: [...this.cols],
      filters: [...this.filters],
      data: { ...this.data },
      opts: { ...this.opts },
    };
    return this.submit(this.requestKey, payload);
  }

  /**
   * Convenience for GET-style responses: returns `data` as an array.
   * Throws if `data` is not an array.
   */
  async rows<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<T[]> {
    const r = await this.execute();
    const data = r.data;
    if (!Array.isArray(data)) {
      throw new Error("Azeel response `data` is not an array; use execute() for this action");
    }
    return data as T[];
  }
}
