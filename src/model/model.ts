import { SCIP as BaseSCIP } from '../solver.js';
import type { SCIPOptions } from '../types.js';
import { Var } from './var.js';
import { LinExpr } from './expr.js';
import { Constraint } from './constraint.js';
import { Solution } from './solution.js';
import { toLPFormat } from './lp-format.js';
import { toMPSFormat } from './mps-format.js';

export type ModelFormat = 'lp' | 'mps';

/** High-level model builder for optimization problems. */
export class Model {
  private variables: Var[] = [];
  private constraints: Constraint[] = [];
  private objective: LinExpr | null = null;
  private sense: 'minimize' | 'maximize' = 'minimize';
  private varCounter = 0;

  /** Creates a continuous variable with the given bounds and optional name. */
  numVar(lb = 0, ub = Infinity, name?: string): Var {
    const varName = name ?? `x${this.varCounter++}`;
    const v = new Var(varName, 'continuous', lb, ub);
    this.variables.push(v);
    return v;
  }

  /** Creates an integer variable with the given bounds and optional name. */
  intVar(lb = 0, ub = Infinity, name?: string): Var {
    const varName = name ?? `x${this.varCounter++}`;
    const v = new Var(varName, 'integer', lb, ub);
    this.variables.push(v);
    return v;
  }

  /** Creates a binary (0-1) variable with an optional name. */
  boolVar(name?: string): Var {
    const varName = name ?? `x${this.varCounter++}`;
    const v = new Var(varName, 'binary', 0, 1);
    this.variables.push(v);
    return v;
  }

  /** Adds a constraint to the model with an optional name. */
  addConstraint(constraint: Constraint, name?: string): void {
    if (name !== undefined) {
      constraint.name = name;
    }
    this.constraints.push(constraint);
  }

  /** Sets the objective to minimize the given expression. */
  minimize(expr: LinExpr | Var): void {
    this.objective = expr instanceof Var ? expr.times(1) : expr;
    this.sense = 'minimize';
  }

  /** Sets the objective to maximize the given expression. */
  maximize(expr: LinExpr | Var): void {
    this.objective = expr instanceof Var ? expr.times(1) : expr;
    this.sense = 'maximize';
  }

  /** Prints the model in the specified format (defaults to LP). */
  print(format: ModelFormat = 'lp'): string {
    const input = {
      objective: this.objective,
      sense: this.sense,
      constraints: this.constraints,
      variables: this.variables,
    };
    return format === 'mps' ? toMPSFormat(input) : toLPFormat(input);
  }

  /** Solves the model and returns the solution. */
  async solve(options?: SCIPOptions): Promise<Solution> {
    const lpString = this.print();
    const scip = await BaseSCIP.create(options);
    try {
      await scip.parse(lpString, 'lp');
      const result = await scip.solve();
      return new Solution(result);
    } finally {
      scip.free();
    }
  }
}
