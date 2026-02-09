import { loadHiGHSModule } from './module.js';
import type { EmscriptenModule, SolverOptions, SolveResult, SolveStatus } from './types.js';

const HIGHS_STATUS_MAP: Record<number, SolveStatus> = {
  0: 'unknown',               // kNotset
  1: 'error',                 // kLoadError
  2: 'error',                 // kModelError
  3: 'error',                 // kPresolveError
  4: 'error',                 // kSolveError
  5: 'error',                 // kPostsolveError
  6: 'error',                 // kModelEmpty
  7: 'optimal',               // kOptimal
  8: 'infeasible',            // kInfeasible
  9: 'unboundedorinfeasible', // kUnboundedOrInfeasible
  10: 'unbounded',            // kUnbounded
  11: 'objectivebound',       // kObjectiveBound
  12: 'objectivetarget',      // kObjectiveTarget
  13: 'timelimit',            // kTimeLimit
  14: 'iterationlimit',       // kIterationLimit
  15: 'unknown',              // kUnknown
  16: 'solutionlimit',        // kSolutionLimit
  17: 'unknown',              // kInterrupt
  18: 'unknown',              // kMemoryLimit
  19: 'unknown',              // kHighsInterrupt
};

/** Low-level wrapper around the HiGHS optimization solver. */
export class HiGHS {
  private module: EmscriptenModule;
  private highsPtr: number;
  private freed = false;

  protected constructor(module: EmscriptenModule, highsPtr: number) {
    this.module = module;
    this.highsPtr = highsPtr;
  }

  /** Creates a new HiGHS solver instance. */
  static async create(options?: SolverOptions): Promise<HiGHS> {
    const module = await loadHiGHSModule(options);

    const highsPtr = module.ccall('Highs_create', 'number', [], []) as number;
    if (highsPtr === 0) {
      throw new Error('Highs_create failed to create instance');
    }

    return new HiGHS(module, highsPtr);
  }

  /** Parses a problem from a string in the given format (e.g., 'lp', 'mps'). */
  async parse(content: string, format: string): Promise<void> {
    this.ensureNotFreed();

    const filename = `/tmp/problem.${format}`;
    this.module.FS.writeFile(filename, content);

    try {
      const status = this.module.ccall(
        'Highs_readModel',
        'number',
        ['number', 'string'],
        [this.highsPtr, filename]
      ) as number;

      if (status !== 0) {
        throw new Error(`Highs_readModel failed with status ${status}`);
      }
    } finally {
      try {
        this.module.FS.unlink(filename);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /** Sets a HiGHS option by name. Supports boolean, integer, real, and string values. */
  setParam(name: string, value: boolean | number | string): void {
    this.ensureNotFreed();

    if (typeof value === 'boolean') {
      this.module.ccall(
        'Highs_setBoolOptionValue', 'number',
        ['number', 'string', 'number'],
        [this.highsPtr, name, value ? 1 : 0],
      );
    } else if (typeof value === 'string') {
      this.module.ccall(
        'Highs_setStringOptionValue', 'number',
        ['number', 'string', 'string'],
        [this.highsPtr, name, value],
      );
    } else if (Number.isInteger(value)) {
      this.module.ccall(
        'Highs_setIntOptionValue', 'number',
        ['number', 'string', 'number'],
        [this.highsPtr, name, value],
      );
    } else {
      this.module.ccall(
        'Highs_setDoubleOptionValue', 'number',
        ['number', 'string', 'number'],
        [this.highsPtr, name, value],
      );
    }
  }

  /** Solves the loaded problem and returns the result. */
  async solve(): Promise<SolveResult> {
    this.ensureNotFreed();

    this.module.ccall('Highs_run', 'number', ['number'], [this.highsPtr]);

    const statusCode = this.module.ccall(
      'Highs_getModelStatus',
      'number',
      ['number'],
      [this.highsPtr]
    ) as number;
    const status = HIGHS_STATUS_MAP[statusCode] ?? 'unknown';

    const result: SolveResult = { status };

    if (status === 'optimal' || status === 'timelimit' ||
        status === 'solutionlimit' || status === 'objectivebound' ||
        status === 'objectivetarget') {
      result.objective = this.module.ccall(
        'Highs_getObjectiveValue',
        'number',
        ['number'],
        [this.highsPtr]
      ) as number;

      result.solution = this.extractSolution();
    }

    return result;
  }

  private extractSolution(): Map<string, number> {
    const solution = new Map<string, number>();

    const numCol = this.module.ccall(
      'Highs_getNumCol',
      'number',
      ['number'],
      [this.highsPtr]
    ) as number;

    const colValuePtr = this.module._malloc(numCol * 8);
    try {
      this.module.ccall(
        'Highs_getSolution',
        'number',
        ['number', 'number', 'number', 'number', 'number'],
        [this.highsPtr, colValuePtr, 0, 0, 0]
      );

      const nameBufferSize = 256;
      const namePtr = this.module._malloc(nameBufferSize);
      try {
        for (let i = 0; i < numCol; i++) {
          this.module.ccall(
            'Highs_getColName',
            'number',
            ['number', 'number', 'number'],
            [this.highsPtr, i, namePtr]
          );
          const name = this.module.UTF8ToString(namePtr);
          const value = this.module.getValue(colValuePtr + i * 8, 'double');
          solution.set(name, value);
        }
      } finally {
        this.module._free(namePtr);
      }
    } finally {
      this.module._free(colValuePtr);
    }

    return solution;
  }

  /** Frees the HiGHS instance. Safe to call multiple times. */
  free(): void {
    if (this.freed) {
      return;
    }

    this.freed = true;
    this.module.ccall('Highs_destroy', null, ['number'], [this.highsPtr]);
  }

  private ensureNotFreed(): void {
    if (this.freed) {
      throw new Error('HiGHS instance has been freed');
    }
  }
}
