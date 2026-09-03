import type { Var } from "./var.js";
import type { Term } from "./types.js";
import { LinExpr } from "./expr.js";

export type Summand = Var | LinExpr | number;

/** Returns the sum of the given variables, expressions, and constants. */
export function sum(items: readonly Summand[]): LinExpr;
export function sum(...items: Summand[]): LinExpr;
export function sum(...args: (Summand | readonly Summand[])[]): LinExpr {
  const terms: Term[] = [];
  let constant = 0;

  const add = (item: Summand): void => {
    if (typeof item === "number") {
      constant += item;
    } else if (item instanceof LinExpr) {
      for (const term of item.terms) terms.push(term);
      constant += item.constant;
    } else {
      terms.push({ coeff: 1, var: item });
    }
  };

  for (const arg of args) {
    if (Array.isArray(arg)) {
      for (const item of arg as readonly Summand[]) add(item);
    } else {
      add(arg as Summand);
    }
  }

  return new LinExpr(terms, constant);
}
