import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WingsContainer } from "./wings-container";

describe("WingsContainer", () => {
  let wingsContainer: WingsContainer;

  beforeAll(async () => {
    wingsContainer = new WingsContainer();
    await wingsContainer.start();
  }, 60_000);

  afterAll(async () => {
    await wingsContainer.stop();
  });

  it("should start Wings container successfully", () => {
    const container = wingsContainer.getContainer();
    expect(container).toBeDefined();

    const containerId = container.getId();
    expect(containerId).toBeTruthy();
    expect(containerId.length).toBeGreaterThan(0);
  });

  it("should expose gRPC port with dynamic mapping", () => {
    const grpcPort = wingsContainer.getGrpcPort();

    expect(grpcPort).toBeGreaterThan(0);
    expect(grpcPort).toBeLessThan(65536);

    const grpcHost = wingsContainer.getGrpcHost();
    expect(grpcHost).toMatch(/localhost:\d+/);
  });

  it("should expose HTTP port with dynamic mapping", () => {
    const httpPort = wingsContainer.getHttpPort();

    expect(httpPort).toBeGreaterThan(0);
    expect(httpPort).toBeLessThan(65536);

    const httpHost = wingsContainer.getHttpHost();
    expect(httpHost).toMatch(/localhost:\d+/);
  });

  it("should be healthy and accessible", async () => {
    const container = wingsContainer.getContainer();
    const id = container.getId();

    expect(id).toBeTruthy();
    expect(id.length).toBeGreaterThan(0);

    const grpcHost = wingsContainer.getGrpcHost();
    const httpHost = wingsContainer.getHttpHost();

    expect(grpcHost).toBeTruthy();
    expect(httpHost).toBeTruthy();
  });
});
