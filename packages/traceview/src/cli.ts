#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";

import packageJson from "../package.json";
import * as Program from "./program";
import * as Axiom from "./sources/axiom";
import * as Jaeger from "./sources/jaeger";
import { TraceWriter } from "./trace-writer";

const traceIdArg = Argument.string("trace-id");
const sourceFlag = Flag.choice("source", ["axiom", "jaeger"] as const).pipe(
  Flag.withDescription("Trace source to query"),
);
const outDirFlag = Flag.string("out-dir").pipe(
  Flag.withDefault("traces"),
  Flag.withDescription("Directory where the rendered trace is written"),
);

const runWithSource = (source: "axiom" | "jaeger", traceId: string, outDir: string) => {
  const program = Program.run({ traceId, outDir });

  switch (source) {
    case "axiom":
      return program.pipe(Effect.provide(Layer.mergeAll(TraceWriter.layer, Axiom.layer)));
    case "jaeger":
      return program.pipe(Effect.provide(Layer.mergeAll(TraceWriter.layer, Jaeger.layer)));
  }
};

const renderTraceCommand = Command.make(
  "traceview",
  {
    traceId: traceIdArg,
    source: sourceFlag,
    outDir: outDirFlag,
  },
  ({ traceId, source, outDir }) => runWithSource(source, traceId, outDir),
).pipe(Command.withDescription("Render a trace to a deterministic Markdown artifact"));

Command.run(renderTraceCommand, { version: packageJson.version }).pipe(
  Effect.provide(Layer.mergeAll(FetchHttpClient.layer, NodeServices.layer)),
  Effect.scoped,
  NodeRuntime.runMain,
);
