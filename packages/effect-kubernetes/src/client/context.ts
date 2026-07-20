import { Context } from "effect";

import type { Service } from "./service";

/** Service for the Effect wrapper around `@kubernetes/client-node`. */
export class Kubernetes extends Context.Service<Kubernetes, Service>()(
  "@useairfoil/effect-kubernetes/Kubernetes",
) {}
