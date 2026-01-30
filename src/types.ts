/** Status returned by SCIP after solving a problem. */
export type SolveStatus =
  | 'optimal'
  | 'infeasible'
  | 'unbounded'
  | 'inforunbd'
  | 'timelimit'
  | 'nodelimit'
  | 'stallnodelimit'
  | 'gaplimit'
  | 'sollimit'
  | 'bestsollimit'
  | 'restartlimit'
  | 'unknown';

/** Result of solving an optimization problem. */
export interface SolveResult {
  status: SolveStatus;
  objective?: number;
  solution?: Map<string, number>;
}

/** Console output configuration for the SCIP module. */
export interface SCIPConsoleOptions {
  /** Handler for stdout messages. Set to null to suppress. */
  log?: ((text: string) => void) | null;
  /** Handler for stderr messages. Set to null to suppress. */
  error?: ((text: string) => void) | null;
}

/** Options for SCIP instance creation. */
export interface SCIPOptions {
  /** Configure console output handling. */
  console?: SCIPConsoleOptions;
}

/** The Emscripten module interface exposed by the compiled SCIP WebAssembly. */
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

/** Factory function that creates the Emscripten SCIP module. */
export type SCIPModuleFactory = (
  options?: Record<string, unknown>
) => Promise<EmscriptenModule>;
