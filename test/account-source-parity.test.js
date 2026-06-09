"use strict";

// Parity guard: the "account-level source" list (sources whose data comes from
// a per-ACCOUNT cloud API and must be DEDUPED across devices, not summed) is
// declared in four places that MUST stay in sync. Cross-device aggregation
// silently double-counts (or under-counts) if they drift:
//   1. src/lib/source-metadata.js     — ACCOUNT_LEVEL_SOURCES (local CLI scope)
//   2. scripts/ops/account-usage-grouped-rpc.sql — account_sources (RPC)
//   3. dashboard/edge-patches/tokentracker-leaderboard-refresh.ts
//   4. dashboard/edge-patches/tokentracker-leaderboard-profile.ts
// See the Cursor multi-device double-count fix (v0.44).

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function extractQuoted(body) {
  return [...body.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]).sort();
}

function match1(text, re, label) {
  const m = text.match(re);
  assert.ok(m, `could not locate account-level source list in ${label}`);
  return extractQuoted(m[1]);
}

test("account-level source list is in sync across JS, edge functions, and SQL RPC", () => {
  const meta = match1(
    read("src/lib/source-metadata.js"),
    /ACCOUNT_LEVEL_SOURCES\s*=\s*new Set\(\s*\[([^\]]*)\]/,
    "src/lib/source-metadata.js",
  );
  const sql = match1(
    read("scripts/ops/account-usage-grouped-rpc.sql"),
    /ARRAY\s*\[([^\]]*)\]\s*::text\[\]\s+AS\s+account_sources/,
    "account-usage-grouped-rpc.sql",
  );
  const refresh = match1(
    read("dashboard/edge-patches/tokentracker-leaderboard-refresh.ts"),
    /ACCOUNT_LEVEL_SOURCES\s*=\s*new Set<string>\(\s*\[([^\]]*)\]/,
    "tokentracker-leaderboard-refresh.ts",
  );
  const profile = match1(
    read("dashboard/edge-patches/tokentracker-leaderboard-profile.ts"),
    /ACCOUNT_LEVEL_SOURCES\s*=\s*new Set<string>\(\s*\[([^\]]*)\]/,
    "tokentracker-leaderboard-profile.ts",
  );

  assert.ok(meta.includes("cursor"), "cursor must be an account-level source");
  assert.deepStrictEqual(sql, meta, "account-usage-grouped-rpc.sql account_sources drifted from source-metadata.js");
  assert.deepStrictEqual(refresh, meta, "leaderboard-refresh.ts ACCOUNT_LEVEL_SOURCES drifted from source-metadata.js");
  assert.deepStrictEqual(profile, meta, "leaderboard-profile.ts ACCOUNT_LEVEL_SOURCES drifted from source-metadata.js");
});
