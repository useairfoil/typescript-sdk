import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from "testcontainers";

export class WingsContainer {
  private container: StartedTestContainer | null = null;

  async start(): Promise<WingsContainer> {
    const container = new GenericContainer(
      "docker.useairfoil.com/airfoil/wings:latest",
    )
      .withCommand([
        "dev",
        "--http-address=0.0.0.0:7780",
        "--metadata-address=0.0.0.0:7777",
      ])
      .withExposedPorts(7777, 7780)
      .withTmpFs({ "/tmp": "rw" })
      .withWaitStrategy(
        Wait.forLogMessage(/gRPC server listening on 0\.0\.0\.0:7777/),
      )
      .withStartupTimeout(30_000);

    this.container = await container.start();
    return this;
  }

  async stop(): Promise<void> {
    if (this.container) {
      await this.container.stop();
      this.container = null;
    }
  }

  getGrpcPort(): number {
    if (!this.container) {
      throw new Error("Container not started");
    }
    return this.container.getMappedPort(7777);
  }

  getHttpPort(): number {
    if (!this.container) {
      throw new Error("Container not started");
    }
    return this.container.getMappedPort(7780);
  }

  getGrpcHost(): string {
    return `${this.getHost()}:${this.getGrpcPort()}`;
  }

  getHttpHost(): string {
    return `${this.getHost()}:${this.getHttpPort()}`;
  }

  private getHost(): string {
    if (!this.container) {
      throw new Error("Container not started");
    }
    return this.container.getHost();
  }

  getContainer(): StartedTestContainer {
    if (!this.container) {
      throw new Error("Container not started");
    }
    return this.container;
  }
}
