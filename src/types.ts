/** Status returned by HiGHS after solving a problem. */
export type SolveStatus =
  | 'optimal'
  | 'infeasible'
  | 'unbounded'
  | 'unboundedorinfeasible'
  | 'timelimit'
  | 'iterationlimit'
  | 'solutionlimit'
  | 'objectivebound'
  | 'objectivetarget'
  | 'error'
  | 'unknown';

/** Result of solving an optimization problem. */
export interface SolveResult {
  status: SolveStatus;
  objective?: number;
  solution?: Map<string, number>;
}

/** Console output configuration for the HiGHS module. */
export interface ConsoleOptions {
  /** Handler for stdout messages. Set to null to suppress. */
  log?: ((text: string) => void) | null;
  /** Handler for stderr messages. Set to null to suppress. */
  error?: ((text: string) => void) | null;
}

/** Options for HiGHS instance creation. */
export interface SolverOptions {
  /** Configure console output handling. */
  console?: ConsoleOptions;
}

/** The Emscripten module interface exposed by the compiled HiGHS WebAssembly. */
export interface EmscriptenModule {
  ccall: (
    name: string,
    returnType: string | null,
    argTypes: string[],
    args: unknown[]
  ) => unknown;
  cwrap: (
    name: string,
    returnType: string | null,
    argTypes: string[]
  ) => (...args: unknown[]) => unknown;
  getValue: (ptr: number, type: string) => number;
  setValue: (ptr: number, value: number, type: string) => void;
  UTF8ToString: (ptr: number) => string;
  stringToUTF8: (str: string, ptr: number, maxBytes: number) => void;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  FS: {
    writeFile: (path: string, data: string | Uint8Array) => void;
    readFile: (path: string, opts?: { encoding?: string }) => string | Uint8Array;
    unlink: (path: string) => void;
    mkdir: (path: string) => void;
  };
}

/** Factory function that creates the Emscripten HiGHS module. */
export type HiGHSModuleFactory = (
  options?: Record<string, unknown>
) => Promise<EmscriptenModule>;
