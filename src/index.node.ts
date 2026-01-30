import { readFileSync } from 'fs';
import { SCIP as BaseSCIP } from './solver.js';
import type { SCIPOptions } from './types.js';

export type { SCIPOptions, SolveResult, SolveStatus } from './types.js';
export {
  Model,
  Var,
  LinExpr,
  Constraint,
  Solution,
  sum,
} from './model/index.js';
export type { VarType, Sense, Term } from './model/index.js';

/** SCIP solver with Node.js-specific file reading support. */
export class SCIP extends BaseSCIP {
  /** Reads a problem from a file path. The format is inferred from the extension. */
  async readProblem(path: string): Promise<void> {
    const content = readFileSync(path, 'utf-8');
    const ext = path.split('.').pop() || 'lp';
    await this.readProblemFromString(content, ext);
  }

  static override async create(options?: SCIPOptions): Promise<SCIP> {
    const base = await BaseSCIP.create(options);
    return Object.setPrototypeOf(base, SCIP.prototype) as SCIP;
  }
}
