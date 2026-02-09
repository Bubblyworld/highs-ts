import type { EmscriptenModule, HiGHSModuleFactory, SolverOptions } from './types.js';

/** Loads a fresh HiGHS WebAssembly module with the given options. */
export async function loadHiGHSModule(
  options?: SolverOptions,
): Promise<EmscriptenModule> {
  const createModule = await loadHiGHSFactory();

  const consoleConfig = options?.console ?? { log: null, error: null };
  const moduleOptions: Record<string, unknown> = {
    print: consoleConfig.log ?? (() => {}),
    printErr: consoleConfig.error ?? (() => {}),
  };

  return createModule(moduleOptions);
}

async function loadHiGHSFactory(): Promise<HiGHSModuleFactory> {
  const { default: HiGHSModuleFactory } = await import(
    new URL('../build/highs.js', import.meta.url).href,
  );

  return HiGHSModuleFactory;
}
