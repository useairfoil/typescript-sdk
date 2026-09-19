import { describe, expect, it, vi } from "@effect/vitest";
import { Cause, Effect } from "effect";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

import { reportError } from "../src/utils/logger";

const cliPath = fileURLToPath(new URL("../src/index.ts", import.meta.url));
const cwd = fileURLToPath(new URL("..", import.meta.url));

// Every case fails, so resolve either way and let the test check the output.
const run = (args: ReadonlyArray<string>) =>
  new Promise<{ failed: boolean; stdout: string; stderr: string }>((resolve) => {
    execFile(
      process.execPath,
      ["--import", "tsx", cliPath, ...args],
      { cwd, env: { ...process.env, NODE_NO_WARNINGS: "1" } },
      (error, stdout, stderr) => resolve({ failed: error !== null, stdout, stderr }),
    );
  });

// Nothing listens on this port, so these tests need no server.
const unreachable = ["--uri", "http://127.0.0.1:1", "catalog", "get", "missing"];

describe("airfoil CLI errors", () => {
  it("reports a failed command on stderr, leaving stdout clean", async () => {
    const { failed, stdout, stderr } = await run(unreachable);

    expect(failed).toBe(true);
    expect(stdout).toBe("");
    expect(stderr.trimEnd()).toMatchInlineSnapshot(`
      "error:
        name: CatalogManagerError
        message: Catalog request failed
        cause:
          name: HttpClientError
          message: "Transport error (GET http://127.0.0.1:1/catalogs/missing)"
          cause:
            name: TypeError
            message: fetch failed
            cause:
              name: Error
              message: bad port"
    `);
  });

  it("reports a failed command as JSON", async () => {
    const { failed, stdout, stderr } = await run(["--output", "json", ...unreachable]);

    expect(failed).toBe(true);
    expect(stdout).toBe("");
    expect(JSON.parse(stderr)).toMatchObject({
      error: {
        message: "Catalog request failed",
        cause: {
          message: "Transport error (GET http://127.0.0.1:1/catalogs/missing)",
        },
      },
    });
  });

  // No command dies on purpose, so go through the reporter directly.
  it("adds the stack of an unexpected defect", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await Effect.runPromise(reportError(Cause.die(new Error("boom"))));

    const [output] = consoleError.mock.calls[0] ?? [];

    expect(output).toContain("message: boom");
    expect(output).toContain("at ");

    consoleError.mockRestore();
  });

  it("leaves usage errors to the CLI", async () => {
    const { failed, stdout, stderr } = await run(["--output", "json", "nope"]);

    expect(failed).toBe(true);
    expect(stderr).toContain('Unknown subcommand "nope"');
    expect(stdout).toContain("USAGE");
    // The CLI already printed it, so we should not print it again.
    expect(stderr).not.toContain("error:");
  });
});
