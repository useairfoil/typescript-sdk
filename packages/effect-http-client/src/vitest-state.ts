export type VitestState = {
  readonly testPath?: string;
  readonly currentTestName?: string;
};

export const getVitestState = (): VitestState => {
  const expectGlobal =
    // biome-ignore lint/suspicious/noExplicitAny: --
    (globalThis as { expect?: { getState?: () => any } }).expect;
  const symbolExpect =
    // biome-ignore lint/suspicious/noExplicitAny: --
    (globalThis as { [key: symbol]: { getState?: () => any } })[Symbol.for("expect-global")];
  const state = expectGlobal?.getState?.() ?? symbolExpect?.getState?.();
  return {
    testPath: state?.testPath as string | undefined,
    currentTestName: state?.currentTestName as string | undefined,
  };
};
