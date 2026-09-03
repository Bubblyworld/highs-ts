import type { SolveStatus, SolveResult } from "../types.js";
import type { Var } from "./var.js";
import { LinExpr } from "./expr.js";

/** The result of solving a Model. */
export class Solution {
  readonly status: SolveStatus;
  readonly objective?: number;
  private readonly values: Map<string, number>;

  /** @internal Use Model.solve() to obtain a Solution. */
  constructor(result: SolveResult) {
    this.status = result.status;
    this.objective = result.objective;
    this.values = result.solution ?? new Map();
  }

  /**
   * Returns the value of a variable or linear expression in the solution, or
   * undefined if any variable involved is not part of the solution.
   */
  getValue(target: Var | LinExpr): number | undefined {
    if (!(target instanceof LinExpr)) {
      return this.values.get(target.name);
    }

    let value = target.constant;
    for (const term of target.terms) {
      const v = this.values.get(term.var.name);
      if (v === undefined) return undefined;
      value += term.coeff * v;
    }
    return value;
  }
}
