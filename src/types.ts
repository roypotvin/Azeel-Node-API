/**
 * Filter object sent in programmatic requests (`filters` array).
 * `type` matches Azeel TL / PHP filter codes (e.g. eq, in, gte).
 */
export interface AzeelFilter {
  type: string;
  col: string;
  val: unknown;
}

export interface AzeelOrder {
  col: string;
  dir: "ASC" | "DESC";
}

export interface AzeelGroup {
  col: string;
}

/**
 * Programmatic request body (JSON inside `d`) for non-azQuery keys.
 */
export interface AzeelProgrammaticPayload {
  cols: string[];
  filters: AzeelFilter[];
  data: Record<string, unknown>;
  opts: Record<string, unknown>;
}

export interface AzeelAzQueryPayload {
  azQuery: string;
  azQueryVals: unknown[];
}
