# Azeel-Node-API

Node.js **ESM** client for the Azeel.net remote HTTP API (API key pair + signed requests). Requires **Node 18+** (global `fetch`).

## Install

From this repository:

```bash
npm install
npm run build
```

In another project (after `npm pack` or publish):

```bash
npm install azeel-node-api
```

Import as ESM (`"type": "module"` or `.mjs`). From CommonJS, use `import('azeel-node-api')` / `createRequire`.

## Setup

You configure an **account** (subdomain), **`apiKey1`** (sent as `ak`), **`apiKey2`** (used only to compute `huid = sha256(uid + apiKey2)`), optional **mode** (`live`, `beta`, `alpha`), and a stable **device id** (`did`, default `azeel-node-api`). The client posts JSON to `https://{account}.azeel.net/{mode}/api` with the same envelope as `RemoteApi/apiDirectRequest.php`.

## Two ways to call the API

### 1. TL query string (“Azeel query language”)

Send a single TL string with **`?` placeholders** and pass values in order as a **positional array**. The library maps this to `key: "azQuery"` and payload `{ azQuery, azQueryVals }`.

Typical usage:

- **Many rows:** run the TL string, read `response.data` (array of records).
- **One row:** same query, return the first element of `data` (or a helper such as `one()`).
- **Full envelope:** return the parsed JSON (pagination fields like `total`, `page`, `limit` when present).

You express **columns**, **WHERE**, **ORDER BY**, **GROUP BY**, **LIMIT**, and **PAGE** in the string. Bracket **options** at the end of the query (for example `[limit=25, page=2, SKIP_CALC_ROWS]` or file flags like `AZFILESFULL`) stay in TL syntax unless you add a small helper that appends them from an object.

Multi-statement TL (semicolon-separated) is a string-level feature: you still send one `azQuery` if the server accepts it that way.

### 2. Programmatic request (class + action `key`)

For operations that use a concrete endpoint such as `Projects.get`, `Projects.edit`, or `Projects.insert`, the library sends `key` set to that string and a JSON body with:

| Field     | Role |
|----------|------|
| `cols`   | Column list (`*`, simple names, FK paths, `col as alias`). |
| `filters`| Array of `{ type, col, val }` (for example `eq`, `in`, `gte`, …). |
| `data`   | Parameters for insert/update/custom actions (field assignments). |
| `opts`   | Everything else: pagination, sort, grouping, performance flags, file/email options, advanced column options, raw extra filters, etc. |

Fluent chaining is syntactic sugar over that object, for example: add columns and filters, set sort and limit/page, set arbitrary options, then `execute()`.

## Mapping concepts to the wire format

| What the app cares about | TL string | Programmatic payload |
|--------------------------|-----------|----------------------|
| Columns                  | `GET …` clause | `cols[]` |
| Filters                  | `WHERE …` | `filters[]` with `type` / `col` / `val` |
| Sort                     | `ORDER BY …` | `opts.order`: `[{ col, dir }]` |
| Limit / page             | `LIMIT` / `PAGE` and/or `[limit=…, page=…]` | `opts.limit`, `opts.page` |
| Group by                 | `GROUP BY …` | `opts.group` |
| Other behavior           | Bracket `[…]` options | `opts` keys (e.g. `SKIP_CALC_ROWS`, `levels`, file/email flags, `adlFilters`, …) |
| Insert/update fields     | `ADD` / `SET` in TL | `data` map |

## Responses

Success and error handling are normalized from the JSON body (for example `suc`, `msg`, `data`, and for lists `total` / `page` / `limit`). Helpers can return **rows only**, **one row**, or the **full response** depending on the method.

## Example code

TypeScript examples match the exported API. Imports use the package name `azeel-node-api` (adjust to a relative path if you load the built files directly).

### Create a client

```ts
import { createClient, AzeelApiError } from 'azeel-node-api';

const client = createClient({
  account: 'mybiz',
  apiKey1: process.env.AZEEL_API_KEY1!,
  apiKey2: process.env.AZEEL_API_KEY2!,
  mode: 'live',
  deviceId: 'my-service-v1',
});
```

### TL queries (`azQuery`)

Many rows, one row, and full JSON (pagination, `total`, etc.):

```ts
const rows = await client.aql.query(
  'GET proj_id, proj_name FROM Projects WHERE proj_status = ? ORDER BY proj_name LIMIT 50',
  ['active'],
);

const row = await client.aql.queryOne(
  'GET * FROM Projects WHERE proj_id = ?',
  [376],
);

const page = await client.aql.queryRaw(
  `
  GET * FROM Tasks
  WHERE task_status = ? AND user_id = ?
  ORDER BY task_due_date DESC
  LIMIT 25
  `,
  ['open', 123],
);
// page.data, page.total, page.page, page.limit when present
```

Parameter binding is **positional only** (`?` in the string, values in order):

```ts
await client.aql.query(
  'SET task_status = ?, task_note = ? FROM Tasks WHERE task_id = ?',
  ['closed', 'Done', 456],
);

await client.aql.query(
  'ADD task_name = ?, proj_id = ? FROM Tasks',
  ['New task', 12],
);
```

Bracket options stay in the TL string:

```ts
await client.aql.query(
  'GET * FROM Projects [limit=25, page=2, SKIP_CALC_ROWS]',
  [],
);
```

### Programmatic: read (`Tasks.get`)

Fluent builder maps to `cols`, `filters`, `data`, `opts`. Use **`rows()`** when you want `data` as an array; use **`execute()`** for the full JSON object (pagination, etc.).

```ts
const tasks = await client
  .key('Tasks.get')
  .columns('task_id', 'task_name', 'proj_id.proj_name')
  .filter('task_status', 'open', 'eq')
  .filter('task_priority', 'high,medium', 'in')
  .orderBy('task_due_date', 'ASC')
  .limit(25)
  .page(1)
  .option('SKIP_CALC_ROWS', true)
  .rows();

const meta = await client
  .key('Tasks.get')
  .columns('task_id')
  .limit(25)
  .execute();
// meta.total, meta.page, meta.limit when present
```

Equivalent **raw payload** if you build `d` yourself:

```ts
await client.run('Tasks.get', {
  cols: ['task_id', 'task_name'],
  filters: [
    { type: 'eq', col: 'task_status', val: 'open' },
    { type: 'in', col: 'task_priority', val: 'high,medium' },
  ],
  data: {},
  opts: {
    limit: 25,
    page: 1,
    order: [
      { col: 'task_due_date', dir: 'ASC' },
    ],
    SKIP_CALC_ROWS: true,
  },
});
```

### Programmatic: insert / update

```ts
const inserted = await client
  .key('Projects.insert')
  .set('proj_name', 'Northwind rollout')
  .set('proj_status', 'active')
  .execute();
// inserted.new_id, inserted.insert, etc.

const updated = await client
  .key('Projects.edit')
  .filter('proj_id', 376, 'eq')
  .set('proj_status', 'archived')
  .execute();
// updated.recsUpdated, updated.data_valid, etc.
```

### Errors

```ts
import { AzeelApiError } from 'azeel-node-api';

try {
  await client.aql.queryOne('GET * FROM Projects WHERE proj_id = ?', [999999]);
} catch (e) {
  if (e instanceof AzeelApiError) {
    // e.message, e.body (parsed JSON if any), e.cause
  }
  throw e;
}
```

## Reference

Server contract and TL syntax are described in the Azeel 6.x docs (`Docs/Api/summary.md`, `Docs/Api/remote-api.md`, `RemoteApi/apiDirectRequest.php`). A copy may live under `./6.0` in this repo for offline reference.
