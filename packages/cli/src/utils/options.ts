import { Config } from "effect";
import { Flag, GlobalFlag } from "effect/unstable/cli";

export const WingsUri = GlobalFlag.setting("uri")({
  flag: Flag.string("uri").pipe(
    Flag.withDefault("http://localhost:7777"),
    Flag.withDescription("Server URI"),
  ),
});

export const Output = GlobalFlag.setting("output")({
  flag: Flag.choice("output", ["default", "json"] as const).pipe(
    Flag.withDefault("default"),
    Flag.withDescription("Log output format"),
  ),
});

export const catalogFlag = Flag.string("catalog").pipe(
  Flag.withDescription("Catalog ID. Alternatively, use the AIRFOIL_CATALOG environment variable"),
  Flag.withFallbackConfig(Config.nonEmptyString("AIRFOIL_CATALOG")),
);
