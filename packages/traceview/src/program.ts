import { Console, Effect } from "effect";

import { renderTraceMarkdown, renderTraceTerminal } from "./render";
import { TraceSource } from "./trace-source";
import { TraceWriter } from "./trace-writer";

// Traces with many spans produce large renders. Beyond this threshold we skip stdout
// and only report the file path — terminal scrollback would truncate the content anyway,
// and the artifact on disk is the authoritative output for LLM agents.
const stdoutLimit = 20_000;

export type RenderTraceOptions = {
  readonly traceId: string;
  readonly outDir: string;
};

export const run = Effect.fnUntraced(function* (options: RenderTraceOptions) {
  const source = yield* TraceSource;
  const writer = yield* TraceWriter;
  const trace = yield* source.fetch(options.traceId);
  const output = renderTraceMarkdown(trace);
  const filePath = yield* writer.write(trace, options.outDir, output);

  if (output.length <= stdoutLimit) {
    yield* Console.log(renderTraceTerminal(trace));
    yield* Console.log(`\nTrace artifact written: ${filePath}`);
    return;
  }

  yield* Console.log(
    [
      `Trace render is ${output.length} characters, too large for stdout.`,
      "Read the Markdown artifact for full trace details.",
      `\nTrace artifact written: ${filePath}`,
    ].join("\n"),
  );
});
