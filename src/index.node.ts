import { readFileSync } from 'fs';
import { HiGHS as BaseHiGHS } from './solver.js';
import type { SolverOptions } from './types.js';

export type { SolverOptions, SolveResult, SolveStatus } from './types.js';
export {
  Model,
  Var,
  LinExpr,
  Constraint,
  Solution,
  sum,
} from './model/index.js';
export type { VarType, Sense, Term, ModelFormat } from './model/index.js';

/** HiGHS solver with Node.js-specific file reading support. */
export class HiGHS extends BaseHiGHS {
  /** Reads a problem from a file path. The format is inferred from the extension. */
  async readProblem(path: string): Promise<void> {
    const content = readFileSync(path, 'utf-8');
    const ext = path.split('.').pop() || 'lp';
    await this.parse(content, ext);
  }

  static override async create(options?: SolverOptions): Promise<HiGHS> {
    const base = await BaseHiGHS.create(options);
    return Object.setPrototypeOf(base, HiGHS.prototype) as HiGHS;
  }
}
