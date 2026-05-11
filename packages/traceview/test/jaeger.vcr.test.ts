import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { renderTraceMarkdown, renderTraceTerminal } from "../src/render";
import * as Jaeger from "../src/sources/jaeger";
import { TraceSource } from "../src/trace-source";

const TRACE_ID = "019e171d5bb39db80ed4a371985693d2";

const vcrLayer = Jaeger.layer.pipe(
  Layer.provide(
    VcrHttpClient.layer({ vcrName: "traceview-jaeger" }).pipe(
      Layer.provide(FileSystemCassetteStore.layer()),
      Layer.provide(Layer.merge(NodeServices.layer, FetchHttpClient.layer)),
    ),
  ),
  Layer.provide(
    ConfigProvider.layer(
      ConfigProvider.fromUnknown({
        // During recording, dotenvx loads JAEGER_BASE_URL from .env.
        // During replay the URL is matched from the cassette so any value works.
        JAEGER_BASE_URL: process.env["JAEGER_BASE_URL"] ?? "http://localhost:16686",
      }),
    ),
  ),
);

describe("traceview jaeger (vcr)", () => {
  it.effect("fetches and builds a trace from Jaeger", () =>
    Effect.gen(function* () {
      const source = yield* TraceSource;
      const trace = yield* source.fetch(TRACE_ID);

      expect(trace.traceId).toBe(TRACE_ID);
      expect(trace.source).toBe("jaeger");
      expect(trace.spans.length).toBeGreaterThan(0);
      expect(trace.roots.length).toBeGreaterThan(0);
      expect(trace.roots[0]?.id).toBe("S1");
    }).pipe(Effect.provide(vcrLayer), Effect.scoped),
  );

  it.effect("renders markdown from the Jaeger VCR trace", () =>
    Effect.gen(function* () {
      const source = yield* TraceSource;
      const trace = yield* source.fetch(TRACE_ID);
      const md = renderTraceMarkdown(trace);

      expect(md).toContain(`# Trace \`${TRACE_ID}\``);
      expect(md).toContain("## Tree");
      expect(md).toContain("## Spans");
      expect(md).toContain("| Source | jaeger |");
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

      expect(terminal).toContain("Source: jaeger");
      expect(terminal).not.toContain("# Trace");
      expect(terminal).not.toContain("```");
    }).pipe(Effect.provide(vcrLayer), Effect.scoped),
  );
});
