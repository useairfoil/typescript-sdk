import { afterEach } from "vitest";

afterEach(() => new Promise((resolve) => setTimeout(resolve, 200)));
