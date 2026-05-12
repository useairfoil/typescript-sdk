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
      expect(renderTraceMarkdown(trace)).toMatchInlineSnapshot(`
        "# Trace \`019e171d5bb39db80ed4a371985693d2\`

        | Field | Value |
        |---|---|
        | Trace ID | \`019e171d5bb39db80ed4a371985693d2\` |
        | Source | jaeger |
        | Spans | 4 |
        | Root Spans | 1 |
        | Duration | 29.3ms |

        ## Tree

        \`\`\`text
        S1 http.server POST [server] [OK] 29.3ms
        ├─ S1.1 connector.webhook.decode [internal] [OK] 27.6ms
        └─ S1.2 connector.webhook.handle [internal] [OK] 1.16ms
           └─ S1.2.1 polar/webhook/handle [internal] [OK] 1.09ms
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
        parent_span_id: 14cf9d89e678aac6
        kind: server
        status: OK
        status_message: -
        duration: 29.3ms
        \`\`\`

        #### Attributes

        \`\`\`text
        client.address: ::ffff:127.0.0.1
        http.request.header.accept: */*
        http.request.header.accept-encoding: gzip, deflate, zstd
        http.request.header.content-length: 2989
        http.request.header.content-type: application/json
        http.request.header.host: mecbuk.tailee170.ts.net
        http.request.header.tailscale-funnel-request: ?1
        http.request.header.traceparent: 00-019e171d5bb39db80ed4a371985693d2-14cf9d89e678aac6-01
        http.request.header.user-agent: polar.sh webhooks
        http.request.header.webhook-id: 43115e02-3bc0-49d0-97b0-a0fd1fceb65e
        http.request.header.webhook-signature: <redacted>
        http.request.header.webhook-timestamp: 1778504260
        http.request.header.x-forwarded-for: 74.220.50.2
        http.request.header.x-forwarded-host: mecbuk.tailee170.ts.net
        http.request.header.x-forwarded-proto: https
        http.request.method: POST
        http.response.header.content-length: 11
        http.response.header.content-type: application/json
        http.response.status_code: 200
        http.route: /webhooks/polar
        service.name: airfoil-producer-polar
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
        span_id: 0cbef45035623a4d
        parent_span_id: 2949b8a6ee13f2da
        kind: internal
        status: OK
        status_message: -
        duration: 27.6ms
        \`\`\`

        #### Attributes

        \`\`\`text
        airfoil.webhook.path: /webhooks/polar
        service.name: airfoil-producer-polar
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
        duration: 1.16ms
        \`\`\`

        #### Attributes

        \`\`\`text
        airfoil.webhook.path: /webhooks/polar
        service.name: airfoil-producer-polar
        \`\`\`

        #### Events

        \`\`\`text
        -
        \`\`\`

        ### S1.2.1 \`polar/webhook/handle\`

        \`\`\`text
        span_id: 5c1e636fc9cee41c
        parent_span_id: 658f1886851434dc
        kind: internal
        status: OK
        status_message: -
        duration: 1.09ms
        \`\`\`

        #### Attributes

        \`\`\`text
        service.name: airfoil-producer-polar
        \`\`\`

        #### Events

        \`\`\`text
        -
        \`\`\`
        "
      `);
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
      expect(renderTraceTerminal(trace)).toMatchInlineSnapshot(`
        "Trace 019e171d5bb39db80ed4a371985693d2
        Source: jaeger
        Spans: 4
        Root spans: 1
        Duration: 29.3ms

        Tree
        S1 http.server POST [server] [OK] 29.3ms
        ├─ S1.1 connector.webhook.decode [internal] [OK] 27.6ms
        └─ S1.2 connector.webhook.handle [internal] [OK] 1.16ms
           └─ S1.2.1 polar/webhook/handle [internal] [OK] 1.09ms

        Index
        - S1 http.server POST [server] [OK] 29.3ms
        - S1.1 connector.webhook.decode [internal] [OK] 27.6ms
        - S1.2 connector.webhook.handle [internal] [OK] 1.16ms
        - S1.2.1 polar/webhook/handle [internal] [OK] 1.09ms

        Spans

        S1 http.server POST
        span_id: 2949b8a6ee13f2da
        parent_span_id: 14cf9d89e678aac6
        kind: server
        status: OK
        status_message: -
        duration: 29.3ms

        Attributes
        client.address: ::ffff:127.0.0.1
        http.request.header.accept: */*
        http.request.header.accept-encoding: gzip, deflate, zstd
        http.request.header.content-length: 2989
        http.request.header.content-type: application/json
        http.request.header.host: mecbuk.tailee170.ts.net
        http.request.header.tailscale-funnel-request: ?1
        http.request.header.traceparent: 00-019e171d5bb39db80ed4a371985693d2-14cf9d89e678aac6-01
        http.request.header.user-agent: polar.sh webhooks
        http.request.header.webhook-id: 43115e02-3bc0-49d0-97b0-a0fd1fceb65e
        http.request.header.webhook-signature: <redacted>
        http.request.header.webhook-timestamp: 1778504260
        http.request.header.x-forwarded-for: 74.220.50.2
        http.request.header.x-forwarded-host: mecbuk.tailee170.ts.net
        http.request.header.x-forwarded-proto: https
        http.request.method: POST
        http.response.header.content-length: 11
        http.response.header.content-type: application/json
        http.response.status_code: 200
        http.route: /webhooks/polar
        service.name: airfoil-producer-polar
        url.full: https://mecbuk.tailee170.ts.net/webhooks/polar
        url.path: /webhooks/polar
        url.scheme: https
        user_agent.original: polar.sh webhooks

        Events
        -

        S1.1 connector.webhook.decode
        span_id: 0cbef45035623a4d
        parent_span_id: 2949b8a6ee13f2da
        kind: internal
        status: OK
        status_message: -
        duration: 27.6ms

        Attributes
        airfoil.webhook.path: /webhooks/polar
        service.name: airfoil-producer-polar

        Events
        -

        S1.2 connector.webhook.handle
        span_id: 658f1886851434dc
        parent_span_id: 2949b8a6ee13f2da
        kind: internal
        status: OK
        status_message: -
        duration: 1.16ms

        Attributes
        airfoil.webhook.path: /webhooks/polar
        service.name: airfoil-producer-polar

        Events
        -

        S1.2.1 polar/webhook/handle
        span_id: 5c1e636fc9cee41c
        parent_span_id: 658f1886851434dc
        kind: internal
        status: OK
        status_message: -
        duration: 1.09ms

        Attributes
        service.name: airfoil-producer-polar

        Events
        -
        "
      `);
    }).pipe(Effect.provide(vcrLayer), Effect.scoped),
  );
});
