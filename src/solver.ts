import { loadSCIPModule } from './module.js';
import type { EmscriptenModule, SCIPOptions, SolveResult, SolveStatus } from './types.js';

const SCIP_STATUS_MAP: Record<number, SolveStatus> = {
  0: 'unknown',
  1: 'optimal',
  2: 'infeasible',
  3: 'unbounded',
  4: 'inforunbd',
  5: 'timelimit',
  6: 'nodelimit',
  7: 'stallnodelimit',
  8: 'gaplimit',
  9: 'sollimit',
  10: 'bestsollimit',
  11: 'restartlimit',
};

/** Low-level wrapper around the SCIP optimization solver. */
export class SCIP {
  private module: EmscriptenModule;
  private scipPtr: number;
  private freed = false;

  protected constructor(module: EmscriptenModule, scipPtr: number) {
    this.module = module;
    this.scipPtr = scipPtr;
  }

  /** Creates a new SCIP solver instance. */
  static async create(options?: SCIPOptions): Promise<SCIP> {
    const module = await loadSCIPModule(options);

    const scipPtrPtr = module._malloc(4);
    try {
      module.ccall('SCIPcreate', 'number', ['number'], [scipPtrPtr]);
      const scipPtr = module.getValue(scipPtrPtr, 'i32');

      if (scipPtr === 0) {
        throw new Error('SCIPcreate failed to create instance');
      }

      module.ccall(
        'SCIPincludeDefaultPlugins',
        'number',
        ['number'],
        [scipPtr]
      );

      return new SCIP(module, scipPtr);
    } finally {
      module._free(scipPtrPtr);
    }
  }

  /** Reads a problem from a string in the given format (e.g., 'lp', 'mps'). */
  async readProblemFromString(content: string, format: string): Promise<void> {
    this.ensureNotFreed();

    const filename = `/tmp/problem.${format}`;
    this.module.FS.writeFile(filename, content);

    try {
      this.module.ccall(
        'SCIPreadProb',
        'number',
        ['number', 'string', 'string'],
        [this.scipPtr, filename, format]
      );
    } finally {
      try {
        this.module.FS.unlink(filename);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /** Solves the loaded problem and returns the result. */
  async solve(): Promise<SolveResult> {
    this.ensureNotFreed();

    this.module.ccall('SCIPsolve', 'number', ['number'], [this.scipPtr]);

    const statusCode = this.module.ccall(
      'SCIPgetStatus',
      'number',
      ['number'],
      [this.scipPtr]
    ) as number;
    const status = SCIP_STATUS_MAP[statusCode] ?? 'unknown';

    const result: SolveResult = { status };

    if (status === 'optimal' || status === 'timelimit' || status === 'gaplimit' ||
        status === 'sollimit' || status === 'bestsollimit') {
      const solPtr = this.module.ccall(
        'SCIPgetBestSol',
        'number',
        ['number'],
        [this.scipPtr]
      ) as number;

      if (solPtr !== 0) {
        result.objective = this.module.ccall(
          'SCIPgetSolOrigObj',
          'number',
          ['number', 'number'],
          [this.scipPtr, solPtr]
        ) as number;

        result.solution = this.extractSolution(solPtr);
      }
    }

    return result;
  }

  private extractSolution(solPtr: number): Map<string, number> {
    const solution = new Map<string, number>();

    const nVars = this.module.ccall(
      'SCIPgetNOrigVars',
      'number',
      ['number'],
      [this.scipPtr]
    ) as number;

    const varsPtr = this.module.ccall(
      'SCIPgetOrigVars',
      'number',
      ['number'],
      [this.scipPtr]
    ) as number;

    for (let i = 0; i < nVars; i++) {
      const varPtr = this.module.getValue(varsPtr + i * 4, 'i32');

      const namePtr = this.module.ccall(
        'SCIPvarGetName',
        'number',
        ['number'],
        [varPtr]
      ) as number;
      const name = this.module.UTF8ToString(namePtr);

      const value = this.module.ccall(
        'SCIPgetSolVal',
        'number',
        ['number', 'number', 'number'],
        [this.scipPtr, solPtr, varPtr]
      ) as number;

      solution.set(name, value);
    }

    return solution;
  }

  /** Frees the SCIP instance. Safe to call multiple times. */
  free(): void {
    if (this.freed) {
      return;
    }

    const scipPtrPtr = this.module._malloc(4);
    try {
      this.module.setValue(scipPtrPtr, this.scipPtr, 'i32');
      this.module.ccall('SCIPfree', 'number', ['number'], [scipPtrPtr]);
    } finally {
      this.module._free(scipPtrPtr);
    }

    this.freed = true;
  }

  private ensureNotFreed(): void {
    if (this.freed) {
      throw new Error('SCIP instance has been freed');
    }
  }
}
