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
      expect(renderTraceMarkdown(trace)).toMatchInlineSnapshot(`
        "# Trace \`019e0cdacd9ef7e5db394bad20d4a1df\`

        | Field | Value |
        |---|---|
        | Trace ID | \`019e0cdacd9ef7e5db394bad20d4a1df\` |
        | Source | axiom |
        | Spans | 4 |
        | Root Spans | 1 |
        | Duration | 4.21ms |

        ## Tree

        \`\`\`text
        S1 http.server POST [server] [OK] 4.21ms
        ├─ S1.1 connector.webhook.decode [internal] [OK] 1.14ms
        └─ S1.2 connector.webhook.handle [internal] [OK] 2.15ms
           └─ S1.2.1 polar/webhook/handle [internal] [OK] 2.07ms
        \`\`\`

        ## Index

        - S1 \`http.server POST\` [server] [OK]
        - S1.1 \`connector.webhook.decode\` [internal] [OK]
        - S1.2 \`connector.webhook.handle\` [internal] [OK]
        - S1.2.1 \`polar/webhook/handle\` [internal] [OK]

        ## Spans

        ### S1 \`http.server POST\`

        \`\`\`text
        span_id: eba776ac8e3144f7
        parent_span_id: 72e5c3ac2dd2f01a
        kind: server
        status: OK
        status_message: -
        duration: 4.21ms
        \`\`\`

        #### Attributes

        \`\`\`text
        client.address: ::ffff:127.0.0.1
        custom: {"http.request.header.accept":"*/*","http.request.header.accept-encoding":"gzip, deflate, zstd","http.request.header.content-length":"2991","http.request.header.content-type":"application/json","http.request.header.host":"mecbuk.tailee170.ts.net","http.request.header.tailscale-funnel-request":"?1","http.request.header.traceparent":"00-019e0cdacd9ef7e5db394bad20d4a1df-72e5c3ac2dd2f01a-01","http.request.header.user-agent":"polar.sh webhooks","http.request.header.webhook-id":"0e8667e7-bc52-45f5-877b-6e2e2746d3ae","http.request.header.webhook-signature":"<redacted>","http.request.header.webhook-timestamp":"1778332126","http.request.header.x-forwarded-for":"74.220.50.2","http.request.header.x-forwarded-host":"mecbuk.tailee170.ts.net","http.request.header.x-forwarded-proto":"https","http.response.header.content-length":"11","http.response.header.content-type":"application/json"}
        http.request.header.accept: */*
        http.request.header.accept-encoding: gzip, deflate, zstd
        http.request.header.content-length: 2991
        http.request.header.content-type: application/json
        http.request.header.host: mecbuk.tailee170.ts.net
        http.request.header.tailscale-funnel-request: ?1
        http.request.header.traceparent: 00-019e0cdacd9ef7e5db394bad20d4a1df-72e5c3ac2dd2f01a-01
        http.request.header.user-agent: polar.sh webhooks
        http.request.header.webhook-id: 0e8667e7-bc52-45f5-877b-6e2e2746d3ae
        http.request.header.webhook-signature: <redacted>
        http.request.header.webhook-timestamp: 1778332126
        http.request.header.x-forwarded-for: 74.220.50.2
        http.request.header.x-forwarded-host: mecbuk.tailee170.ts.net
        http.request.header.x-forwarded-proto: https
        http.request.method: POST
        http.response.header.content-length: 11
        http.response.header.content-type: application/json
        http.response.status_code: 200
        http.route: /webhooks/polar
        url.full: https://mecbuk.tailee170.ts.net/webhooks/polar
        url.path: /webhooks/polar
        url.scheme: https
        user_agent.original: polar.sh webhooks
        \`\`\`

        #### Events

        \`\`\`text
        -
        \`\`\`

        ### S1.1 \`connector.webhook.decode\`

        \`\`\`text
        span_id: 1a8af100c585a2c7
        parent_span_id: eba776ac8e3144f7
        kind: internal
        status: OK
        status_message: -
        duration: 1.14ms
        \`\`\`

        #### Attributes

        \`\`\`text
        airfoil.webhook.path: /webhooks/polar
        custom: {"airfoil.webhook.path":"/webhooks/polar"}
        \`\`\`

        #### Events

        \`\`\`text
        -
        \`\`\`

        ### S1.2 \`connector.webhook.handle\`

        \`\`\`text
        span_id: e692719b9b2d01ae
        parent_span_id: eba776ac8e3144f7
        kind: internal
        status: OK
        status_message: -
        duration: 2.15ms
        \`\`\`

        #### Attributes

        \`\`\`text
        airfoil.webhook.path: /webhooks/polar
        custom: {"airfoil.webhook.path":"/webhooks/polar"}
        \`\`\`

        #### Events

        \`\`\`text
        -
        \`\`\`

        ### S1.2.1 \`polar/webhook/handle\`

        \`\`\`text
        span_id: fbf621fb897d0959
        parent_span_id: e692719b9b2d01ae
        kind: internal
        status: OK
        status_message: -
        duration: 2.07ms
        \`\`\`

        #### Attributes

        \`\`\`text
        -
        \`\`\`

        #### Events

        \`\`\`text
        -
        \`\`\`
        "
      `);
    }).pipe(Effect.provide(vcrLayer), Effect.scoped),
  );

  it.effect("renders terminal output without markdown syntax", () =>
    Effect.gen(function* () {
      const source = yield* TraceSource;
      const trace = yield* source.fetch(TRACE_ID);
      expect(renderTraceTerminal(trace)).toMatchInlineSnapshot(`
        "Trace 019e0cdacd9ef7e5db394bad20d4a1df
        Source: axiom
        Spans: 4
        Root spans: 1
        Duration: 4.21ms

        Tree
        S1 http.server POST [server] [OK] 4.21ms
        ├─ S1.1 connector.webhook.decode [internal] [OK] 1.14ms
        └─ S1.2 connector.webhook.handle [internal] [OK] 2.15ms
           └─ S1.2.1 polar/webhook/handle [internal] [OK] 2.07ms

        Index
        - S1 http.server POST [server] [OK] 4.21ms
        - S1.1 connector.webhook.decode [internal] [OK] 1.14ms
        - S1.2 connector.webhook.handle [internal] [OK] 2.15ms
        - S1.2.1 polar/webhook/handle [internal] [OK] 2.07ms

        Spans

        S1 http.server POST
        span_id: eba776ac8e3144f7
        parent_span_id: 72e5c3ac2dd2f01a
        kind: server
        status: OK
        status_message: -
        duration: 4.21ms

        Attributes
        client.address: ::ffff:127.0.0.1
        custom: {"http.request.header.accept":"*/*","http.request.header.accept-encoding":"gzip, deflate, zstd","http.request.header.content-length":"2991","http.request.header.content-type":"application/json","http.request.header.host":"mecbuk.tailee170.ts.net","http.request.header.tailscale-funnel-request":"?1","http.request.header.traceparent":"00-019e0cdacd9ef7e5db394bad20d4a1df-72e5c3ac2dd2f01a-01","http.request.header.user-agent":"polar.sh webhooks","http.request.header.webhook-id":"0e8667e7-bc52-45f5-877b-6e2e2746d3ae","http.request.header.webhook-signature":"<redacted>","http.request.header.webhook-timestamp":"1778332126","http.request.header.x-forwarded-for":"74.220.50.2","http.request.header.x-forwarded-host":"mecbuk.tailee170.ts.net","http.request.header.x-forwarded-proto":"https","http.response.header.content-length":"11","http.response.header.content-type":"application/json"}
        http.request.header.accept: */*
        http.request.header.accept-encoding: gzip, deflate, zstd
        http.request.header.content-length: 2991
        http.request.header.content-type: application/json
        http.request.header.host: mecbuk.tailee170.ts.net
        http.request.header.tailscale-funnel-request: ?1
        http.request.header.traceparent: 00-019e0cdacd9ef7e5db394bad20d4a1df-72e5c3ac2dd2f01a-01
        http.request.header.user-agent: polar.sh webhooks
        http.request.header.webhook-id: 0e8667e7-bc52-45f5-877b-6e2e2746d3ae
        http.request.header.webhook-signature: <redacted>
        http.request.header.webhook-timestamp: 1778332126
        http.request.header.x-forwarded-for: 74.220.50.2
        http.request.header.x-forwarded-host: mecbuk.tailee170.ts.net
        http.request.header.x-forwarded-proto: https
        http.request.method: POST
        http.response.header.content-length: 11
        http.response.header.content-type: application/json
        http.response.status_code: 200
        http.route: /webhooks/polar
        url.full: https://mecbuk.tailee170.ts.net/webhooks/polar
        url.path: /webhooks/polar
        url.scheme: https
        user_agent.original: polar.sh webhooks

        Events
        -

        S1.1 connector.webhook.decode
        span_id: 1a8af100c585a2c7
        parent_span_id: eba776ac8e3144f7
        kind: internal
        status: OK
        status_message: -
        duration: 1.14ms

        Attributes
        airfoil.webhook.path: /webhooks/polar
        custom: {"airfoil.webhook.path":"/webhooks/polar"}

        Events
        -

        S1.2 connector.webhook.handle
        span_id: e692719b9b2d01ae
        parent_span_id: eba776ac8e3144f7
        kind: internal
        status: OK
        status_message: -
        duration: 2.15ms

        Attributes
        airfoil.webhook.path: /webhooks/polar
        custom: {"airfoil.webhook.path":"/webhooks/polar"}

        Events
        -

        S1.2.1 polar/webhook/handle
        span_id: fbf621fb897d0959
        parent_span_id: e692719b9b2d01ae
        kind: internal
        status: OK
        status_message: -
        duration: 2.07ms

        Attributes
        -

        Events
        -
        "
      `);
    }).pipe(Effect.provide(vcrLayer), Effect.scoped),
  );
});

describe("render", () => {
  // Mirrors the shape of a real webhook ingestion trace (4 spans, 3 levels deep).
  const trace = buildTrace("019e171d5bb39db80ed4a371985693d2", "axiom", [
    {
      traceId: "019e171d5bb39db80ed4a371985693d2",
      spanId: "2949b8a6ee13f2da",
      name: "http.server POST",
      kind: "server",
      status: "OK",
      attributes: {
        "http.request.method": "POST",
        "http.response.status_code": 200,
        "url.path": "/webhooks/polar",
      },
      events: [],
    },
    {
      traceId: "019e171d5bb39db80ed4a371985693d2",
      spanId: "0cbef45035623a4d",
      parentSpanId: "2949b8a6ee13f2da",
      name: "connector.webhook.decode",
      kind: "internal",
      status: "OK",
      attributes: { "airfoil.webhook.path": "/webhooks/polar" },
      events: [],
    },
    {
      traceId: "019e171d5bb39db80ed4a371985693d2",
      spanId: "658f1886851434dc",
      parentSpanId: "2949b8a6ee13f2da",
      name: "connector.webhook.handle",
      kind: "internal",
      status: "OK",
      attributes: { "airfoil.webhook.path": "/webhooks/polar" },
      events: [
        {
          name: "airfoil.batch.checkpoint",
          attributes: { "airfoil.batch.cursor": "2026-05-09T13:08:46Z" },
        },
      ],
    },
    {
      traceId: "019e171d5bb39db80ed4a371985693d2",
      spanId: "5c1e636f00000000",
      parentSpanId: "658f1886851434dc",
      name: "polar/webhook/handle",
      kind: "internal",
      status: "OK",
      attributes: {},
      events: [],
    },
  ]);

  it("renderTraceMarkdown matches snapshot", () => {
    expect(renderTraceMarkdown(trace)).toMatchInlineSnapshot(`
      "# Trace \`019e171d5bb39db80ed4a371985693d2\`

      | Field | Value |
      |---|---|
      | Trace ID | \`019e171d5bb39db80ed4a371985693d2\` |
      | Source | axiom |
      | Spans | 4 |
      | Root Spans | 1 |
      | Duration | - |

      ## Tree

      \`\`\`text
      S1 http.server POST [server] [OK] -
      ├─ S1.1 connector.webhook.decode [internal] [OK] -
      └─ S1.2 connector.webhook.handle [internal] [OK] -
         └─ S1.2.1 polar/webhook/handle [internal] [OK] -
      \`\`\`

      ## Index

      - S1 \`http.server POST\` [server] [OK]
      - S1.1 \`connector.webhook.decode\` [internal] [OK]
      - S1.2 \`connector.webhook.handle\` [internal] [OK]
      - S1.2.1 \`polar/webhook/handle\` [internal] [OK]

      ## Spans

      ### S1 \`http.server POST\`

      \`\`\`text
      span_id: 2949b8a6ee13f2da
      parent_span_id: -
      kind: server
      status: OK
      status_message: -
      duration: -
      \`\`\`

      #### Attributes

      \`\`\`text
      http.request.method: POST
      http.response.status_code: 200
      url.path: /webhooks/polar
      \`\`\`

      #### Events

      \`\`\`text
      -
      \`\`\`

      ### S1.1 \`connector.webhook.decode\`

      \`\`\`text
      span_id: 0cbef45035623a4d
      parent_span_id: 2949b8a6ee13f2da
      kind: internal
      status: OK
      status_message: -
      duration: -
      \`\`\`

      #### Attributes

      \`\`\`text
      airfoil.webhook.path: /webhooks/polar
      \`\`\`

      #### Events

      \`\`\`text
      -
      \`\`\`

      ### S1.2 \`connector.webhook.handle\`

      \`\`\`text
      span_id: 658f1886851434dc
      parent_span_id: 2949b8a6ee13f2da
      kind: internal
      status: OK
      status_message: -
      duration: -
      \`\`\`

      #### Attributes

      \`\`\`text
      airfoil.webhook.path: /webhooks/polar
      \`\`\`

      #### Events

      \`\`\`text
      airfoil.batch.checkpoint:
        airfoil.batch.cursor: 2026-05-09T13:08:46Z
      \`\`\`

      ### S1.2.1 \`polar/webhook/handle\`

      \`\`\`text
      span_id: 5c1e636f00000000
      parent_span_id: 658f1886851434dc
      kind: internal
      status: OK
      status_message: -
      duration: -
      \`\`\`

      #### Attributes

      \`\`\`text
      -
      \`\`\`

      #### Events

      \`\`\`text
      -
      \`\`\`
      "
    `);
  });

  it("renderTraceTerminal matches snapshot", () => {
    expect(renderTraceTerminal(trace)).toMatchInlineSnapshot(`
      "Trace 019e171d5bb39db80ed4a371985693d2
      Source: axiom
      Spans: 4
      Root spans: 1
      Duration: -

      Tree
      S1 http.server POST [server] [OK] -
      ├─ S1.1 connector.webhook.decode [internal] [OK] -
      └─ S1.2 connector.webhook.handle [internal] [OK] -
         └─ S1.2.1 polar/webhook/handle [internal] [OK] -

      Index
      - S1 http.server POST [server] [OK] -
      - S1.1 connector.webhook.decode [internal] [OK] -
      - S1.2 connector.webhook.handle [internal] [OK] -
      - S1.2.1 polar/webhook/handle [internal] [OK] -

      Spans

      S1 http.server POST
      span_id: 2949b8a6ee13f2da
      parent_span_id: -
      kind: server
      status: OK
      status_message: -
      duration: -

      Attributes
      http.request.method: POST
      http.response.status_code: 200
      url.path: /webhooks/polar

      Events
      -

      S1.1 connector.webhook.decode
      span_id: 0cbef45035623a4d
      parent_span_id: 2949b8a6ee13f2da
      kind: internal
      status: OK
      status_message: -
      duration: -

      Attributes
      airfoil.webhook.path: /webhooks/polar

      Events
      -

      S1.2 connector.webhook.handle
      span_id: 658f1886851434dc
      parent_span_id: 2949b8a6ee13f2da
      kind: internal
      status: OK
      status_message: -
      duration: -

      Attributes
      airfoil.webhook.path: /webhooks/polar

      Events
      airfoil.batch.checkpoint:
        airfoil.batch.cursor: 2026-05-09T13:08:46Z

      S1.2.1 polar/webhook/handle
      span_id: 5c1e636f00000000
      parent_span_id: 658f1886851434dc
      kind: internal
      status: OK
      status_message: -
      duration: -

      Attributes
      -

      Events
      -
      "
    `);
  });
});
