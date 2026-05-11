import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { buildTrace } from "../src/model";
import { renderTraceMarkdown, renderTraceTerminal } from "../src/render";
import * as Axiom from "../src/sources/axiom";
import { TraceSource } from "../src/trace-source";

const TRACE_ID = "019e0cdacd9ef7e5db394bad20d4a1df";

const vcrLayer = Axiom.layer.pipe(
  Layer.provide(
    VcrHttpClient.layer({ vcrName: "traceview-axiom" }).pipe(
      Layer.provide(FileSystemCassetteStore.layer()),
      Layer.provide(Layer.merge(NodeServices.layer, FetchHttpClient.layer)),
    ),
  ),
  Layer.provide(
    ConfigProvider.layer(
      ConfigProvider.fromUnknown({
        // During cassette recording, the real token is loaded by dotenvx from .env.
        // During replay the cassette is matched ignoring Authorization, so "test" is fine.
        AXIOM_API_TOKEN: process.env["AXIOM_API_TOKEN"] ?? "test",
        AXIOM_DATASET: process.env["AXIOM_DATASET"] ?? "airfoil-traces",
        AXIOM_DOMAIN: process.env["AXIOM_DOMAIN"] ?? "https://api.axiom.co",
      }),
    ),
  ),
);

describe("traceview axiom (vcr)", () => {
  it.effect("fetches and builds a trace from Axiom", () =>
    Effect.gen(function* () {
      const source = yield* TraceSource;
      const trace = yield* source.fetch(TRACE_ID);

      expect(trace.traceId).toBe(TRACE_ID);
      expect(trace.source).toBe("axiom");
      expect(trace.spans.length).toBeGreaterThan(0);
      expect(trace.roots.length).toBeGreaterThan(0);
      expect(trace.roots[0]?.id).toBe("S1");
    }).pipe(Effect.provide(vcrLayer), Effect.scoped),
  );

  it.effect("renders markdown from the VCR trace", () =>
    Effect.gen(function* () {
      const source = yield* TraceSource;
      const trace = yield* source.fetch(TRACE_ID);
      const md = renderTraceMarkdown(trace);

      expect(md).toContain(`# Trace \`${TRACE_ID}\``);
      expect(md).toContain("## Tree");
      expect(md).toContain("## Spans");
      expect(md).not.toMatch(/xaat-/);
    }).pipe(Effect.provide(vcrLayer), Effect.scoped),
  );

  it.effect("renders deterministic markdown", () =>
    Effect.gen(function* () {
      const source = yield* TraceSource;
      const trace = yield* source.fetch(TRACE_ID);
      expect(renderTraceMarkdown(trace)).toBe(renderTraceMarkdown(trace));
    }).pipe(Effect.provide(vcrLayer), Effect.scoped),
  );

  it.effect("renders terminal output without markdown syntax", () =>
    Effect.gen(function* () {
      const source = yield* TraceSource;
      const trace = yield* source.fetch(TRACE_ID);
      const terminal = renderTraceTerminal(trace);

      expect(terminal).toContain("Trace");
      expect(terminal).toContain("Source: axiom");
      expect(terminal).not.toContain("# Trace");
      expect(terminal).not.toContain("```");
    }).pipe(Effect.provide(vcrLayer), Effect.scoped),
  );
});

describe("traceview redaction", () => {
  it("redacts sensitive headers in markdown", () => {
    const trace = buildTrace("trace-redaction", "axiom", [
      {
        traceId: "trace-redaction",
        spanId: "span-1",
        name: "http.server POST",
        attributes: {
          "http.request.header.authorization": "Bearer secret-token",
          "http.request.header.webhook-signature": "secret-sig",
          safe: "visible",
        },
        events: [],
      },
    ]);
    const md = renderTraceMarkdown(trace);

    expect(md).not.toContain("secret-token");
    expect(md).not.toContain("secret-sig");
    expect(md).toContain("[REDACTED]");
    expect(md).toContain("visible");
  });
});
