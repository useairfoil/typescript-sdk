import { Context, Data, Effect, FileSystem, Layer, Path } from "effect";

import type { Trace } from "./model";

export class TraceOutputError extends Data.TaggedError("TraceOutputError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface TraceWriterService {
  readonly write: (
    trace: Trace,
    outDir: string,
    output: string,
  ) => Effect.Effect<string, TraceOutputError>;
}

// Trace IDs from Axiom/Jaeger may contain characters that are unsafe in filenames.
const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_");

export class TraceWriter extends Context.Service<TraceWriter, TraceWriterService>()(
  "@useairfoil/traceview/TraceWriter",
) {
  static readonly layer: Layer.Layer<TraceWriter, never, FileSystem.FileSystem | Path.Path> =
    Layer.effect(
      TraceWriter,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;

        const write = Effect.fnUntraced(function* (trace: Trace, outDir: string, output: string) {
          const filePath = path.resolve(outDir, `${sanitizeFileName(trace.traceId)}.md`);
          const dir = path.dirname(filePath);

          yield* fs
            .makeDirectory(dir, { recursive: true })
            .pipe(
              Effect.mapError(
                (cause) => new TraceOutputError({ message: `Failed to create ${dir}`, cause }),
              ),
            );
          yield* fs
            .writeFileString(filePath, output)
            .pipe(
              Effect.mapError(
                (cause) => new TraceOutputError({ message: `Failed to write ${filePath}`, cause }),
              ),
            );

          return filePath;
        });

        return TraceWriter.of({ write });
      }),
    );
}
