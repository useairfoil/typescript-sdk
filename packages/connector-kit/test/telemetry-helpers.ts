import { Layer, Tracer } from "effect";

export const makeRecordingTracer = () => {
  const spans: Array<Tracer.NativeSpan> = [];

  const tracer = Tracer.make({
    span: (options) => {
      const span = new Tracer.NativeSpan(options);
      const originalEnd: Tracer.Span["end"] = span.end.bind(span);

      span.end = (endTime, exit) => {
        originalEnd(endTime, exit);
        spans.push(span);
      };

      return span;
    },
  });

  return {
    layer: Layer.succeed(Tracer.Tracer, tracer),
    spans,
  };
};
