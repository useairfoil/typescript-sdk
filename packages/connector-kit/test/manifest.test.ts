import { describe, expect, it } from "@effect/vitest";
import { Config, ConfigProvider, Effect, Exit, Option, Redacted, Schema } from "effect";

import * as Manifest from "../src/manifest";

describe("connector manifests", () => {
  it.effect("builds runtime config and serializable specs together", () => {
    const def = Manifest.defineConfig({
      token: Manifest.secret({ env: "API_TOKEN", description: "API token" }),
      baseUrl: Manifest.string({ env: "API_BASE_URL", default: "https://example.test" }),
      optionalRegion: Manifest.string({ env: "API_REGION", required: false, default: "us" }),
      optionalOrg: Manifest.optional(Manifest.string({ env: "ORG_ID" })),
      mode: Manifest.select({ env: "MODE", values: ["test", "live"], default: "test" }),
    });

    return Effect.gen(function* () {
      const value = yield* Config.unwrap(def.config);

      expect({
        value: {
          token: Redacted.value(value.token),
          baseUrl: value.baseUrl,
          optionalRegion: value.optionalRegion,
          optionalOrgIsNone: Option.isNone(value.optionalOrg),
          mode: value.mode,
        },
        spec: def.spec,
      }).toMatchInlineSnapshot(`
        {
          "spec": [
            {
              "description": "API token",
              "env": "API_TOKEN",
              "name": "token",
              "required": true,
              "secret": true,
              "type": "string",
            },
            {
              "default": "https://example.test",
              "env": "API_BASE_URL",
              "name": "baseUrl",
              "required": true,
              "secret": false,
              "type": "string",
            },
            {
              "default": "us",
              "env": "API_REGION",
              "name": "optionalRegion",
              "required": false,
              "secret": false,
              "type": "string",
            },
            {
              "env": "ORG_ID",
              "name": "optionalOrg",
              "required": false,
              "secret": false,
              "type": "string",
            },
            {
              "default": "test",
              "env": "MODE",
              "name": "mode",
              "required": true,
              "secret": false,
              "type": "select",
              "values": [
                "test",
                "live",
              ],
            },
          ],
          "value": {
            "baseUrl": "https://example.test",
            "mode": "test",
            "optionalOrgIsNone": true,
            "optionalRegion": "us",
            "token": "secret",
          },
        }
      `);
    }).pipe(
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            API_TOKEN: "secret",
          }),
        ),
      ),
    );
  });

  const formManifest = Manifest.define({
    name: "producer-test",
    title: "Test Producer",
    config: [
      {
        name: "token",
        env: "API_TOKEN",
        type: "string",
        required: true,
        secret: true,
      },
      {
        name: "optionalSecret",
        env: "OPTIONAL_SECRET",
        type: "string",
        required: false,
        secret: true,
      },
      {
        name: "optionalOrg",
        env: "ORG_ID",
        type: "string",
        required: false,
        secret: false,
      },
      {
        name: "port",
        env: "PORT",
        type: "number",
        required: true,
        secret: false,
      },
      {
        name: "enabled",
        env: "ENABLED",
        type: "boolean",
        required: true,
        secret: false,
      },
      {
        name: "mode",
        env: "MODE",
        type: "select",
        required: true,
        secret: false,
        values: ["test", "live"],
      },
      {
        name: "apiBaseUrl",
        env: "API_BASE_URL",
        type: "string",
        required: false,
        secret: false,
        default: "https://example.test",
      },
    ],
    resources: [{ name: "items", capabilities: ["backfill"] }],
  });

  const decodeConfig = (input: unknown) =>
    Schema.decodeUnknownEffect(Manifest.configSchema(formManifest))(input);

  it.effect("decodes form-shaped connector config values", () =>
    Effect.gen(function* () {
      const value = yield* decodeConfig({
        token: "abc",
        optionalOrg: "",
        optionalSecret: "",
        port: "8080",
        enabled: true,
        mode: "live",
      });

      expect(value).toMatchInlineSnapshot(`
        {
          "enabled": true,
          "mode": "live",
          "optionalOrg": undefined,
          "optionalSecret": undefined,
          "port": 8080,
          "token": "abc",
        }
      `);
    }),
  );

  it.effect("decodes JSON-shaped connector config values", () =>
    Effect.gen(function* () {
      const value = yield* decodeConfig({
        token: "abc",
        port: 8080,
        enabled: true,
        mode: "live",
      });

      expect(value).toMatchInlineSnapshot(`
        {
          "enabled": true,
          "mode": "live",
          "port": 8080,
          "token": "abc",
        }
      `);
    }),
  );

  it.effect("rejects an empty required string", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        decodeConfig({ token: "", port: "8080", enabled: true, mode: "live" }),
      );
      expect(Exit.isFailure(result)).toBe(true);
    }),
  );

  it.effect("rejects an empty number", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        decodeConfig({ token: "abc", port: "", enabled: true, mode: "live" }),
      );
      expect(Exit.isFailure(result)).toBe(true);
    }),
  );

  it.effect("rejects an invalid number", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        decodeConfig({ token: "abc", port: "abc", enabled: true, mode: "live" }),
      );
      expect(Exit.isFailure(result)).toBe(true);
    }),
  );

  it.effect("rejects an invalid select literal", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        decodeConfig({ token: "abc", port: "8080", enabled: true, mode: "sandbox" }),
      );
      expect(Exit.isFailure(result)).toBe(true);
    }),
  );

  it.effect("exposes a standard-schema compatible validator", () =>
    Effect.gen(function* () {
      const standardSchema = Schema.toStandardSchemaV1(Manifest.configSchema(formManifest));
      const validResult = yield* Effect.promise(() =>
        Promise.resolve(
          standardSchema["~standard"].validate({
            token: "abc",
            port: "8080",
            enabled: true,
            mode: "live",
          }),
        ),
      );
      const invalidResult = yield* Effect.promise(() =>
        Promise.resolve(
          standardSchema["~standard"].validate({
            token: "abc",
            port: "",
            enabled: true,
            mode: "live",
          }),
        ),
      );

      expect(validResult).toMatchInlineSnapshot(`
        {
          "value": {
            "enabled": true,
            "mode": "live",
            "port": 8080,
            "token": "abc",
          },
        }
      `);
      expect("issues" in invalidResult).toBe(true);
    }),
  );
});
