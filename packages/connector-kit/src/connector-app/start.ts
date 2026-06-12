import { NodeHttpServer } from "@effect/platform-node";
import { DateTime, Effect } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { createServer } from "node:http";

import type { ConnectorDefinition } from "../core";
import type { Cursor } from "../core/types";

import { run as runIngestion } from "../ingestion";

export type App = ConnectorDefinition;

export type StartOptions = {
  readonly port: number;
  readonly initialCutoff?: Cursor.Value;
  readonly healthPath?: HttpRouter.PathInput;
  readonly disableHttpLogger?: boolean;
};

export const start = (app: App, options: StartOptions) =>
  Effect.gen(function* () {
    const initialCutoff =
      options.initialCutoff ?? (yield* DateTime.now.pipe(Effect.map(DateTime.formatIso)));
    const routes = app.webhooks?.map((route) => route.path) ?? [];

    yield* Effect.logInfo("webhook server ready").pipe(
      Effect.annotateLogs({ port: options.port, routes }),
    );

    return yield* runIngestion(app, {
      initialCutoff,
      webhook: {
        routes: app.webhooks ?? [],
        healthPath: options.healthPath ?? "/health",
        disableHttpLogger: options.disableHttpLogger ?? true,
      },
    }).pipe(Effect.provide(NodeHttpServer.layer(createServer, { port: options.port })));
  });
