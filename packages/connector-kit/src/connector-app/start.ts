import { NodeHttpServer } from "@effect/platform-node";
import { DateTime, Effect } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { createServer } from "node:http";

import type { ConnectorDefinition, Cursor } from "../core";
import type { Route } from "../webhook/types";

import { run as runIngestion } from "../ingestion";

export type App<R extends Route = Route> = {
  readonly connector: ConnectorDefinition;
  readonly routes: ReadonlyArray<R>;
};

export type StartOptions = {
  readonly port: number;
  readonly initialCutoff?: Cursor;
  readonly healthPath?: HttpRouter.PathInput;
  readonly disableHttpLogger?: boolean;
};

export const start = (app: App, options: StartOptions) =>
  Effect.gen(function* () {
    const initialCutoff = options.initialCutoff ?? (yield* DateTime.now);
    const routes = app.routes.map((route) => route.path);

    yield* Effect.logInfo("webhook server ready").pipe(
      Effect.annotateLogs({ port: options.port, routes }),
    );

    return yield* runIngestion(app.connector, {
      initialCutoff,
      webhook: {
        routes: app.routes,
        healthPath: options.healthPath ?? "/health",
        disableHttpLogger: options.disableHttpLogger ?? true,
      },
    }).pipe(Effect.provide(NodeHttpServer.layer(createServer, { port: options.port })));
  });
