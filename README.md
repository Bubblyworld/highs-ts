# highs-ts

[![npm version](https://img.shields.io/npm/v/@bubblyworld/highs-ts)](https://www.npmjs.com/package/@bubblyworld/highs-ts)
[![CI](https://github.com/Bubblyworld/highs-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/Bubblyworld/highs-ts/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

[WASM](https://webassembly.org/) build of the [HiGHS](https://highs.dev) solver with TypeScript bindings. Supports linear and mixed-integer linear programming, and runs in both node and browser environments with zero runtime dependencies.

The solver's emscripten glue is loaded with a plain relative `import()`, so the package works both unbundled (served as native ES modules) and under bundlers like webpack and vite, which statically resolve the import and include the glue and wasm in your bundle.

## Basic Usage

The `HiGHS` class provides direct access to the solver. Problems can be loaded from strings in [CPLEX LP](https://www.ibm.com/docs/en/icos/22.1.0?topic=cplex-lp-file-format-algebraic-representation) or [MPS](https://en.wikipedia.org/wiki/MPS_(format)) format.

```typescript
import { HiGHS } from '@bubblyworld/highs-ts';

const lp = `
Maximize
  obj: x + 2 y
Subject To
  c1: x + y <= 10
  c2: x <= 5
Bounds
  0 <= x <= 10
  0 <= y <= 10
End
`;

const highs = await HiGHS.create();
await highs.parse(lp, 'lp');
const result = await highs.solve();

console.log(result.status);     // @expect: result.status === 'optimal'
console.log(result.objective);  // @expect: result.objective === 20
console.log(result.solution);   // Map { 'x' => 0, 'y' => 10 }

highs.free();
```

## Raw Columnar Input

For large models, serializing to LP/MPS text and parsing it back becomes the
dominant cost. `passModel` skips both: it copies typed arrays straight into
solver memory via `Highs_passLp` (or `Highs_passMip` when `integrality` is
given). The constraint matrix is sparse, row-wise by default, and bounds
default to `0 <= x < +inf` for columns and `-inf < row < +inf` for rows —
pass `HIGHS_INF` explicitly where you need it. `getSolutionValues` reads the
solution back densely by column index, which is the natural pairing since
raw columns have no names.

```typescript
import { HiGHS } from '@bubblyworld/highs-ts';

// The same problem as above, in columnar form.
const highs = await HiGHS.create();
highs.passModel({
  numCol: 2,
  numRow: 2,
  sense: 'maximize',
  colCost: Float64Array.from([1, 2]),
  colUpper: Float64Array.from([10, 10]),
  rowUpper: Float64Array.from([10, 5]),
  matrix: {
    start: Int32Array.from([0, 2, 3]),
    index: Int32Array.from([0, 1, 0]),
    value: Float64Array.from([1, 1, 1]),
  },
});
const result = await highs.solve();
const values = highs.getSolutionValues();

console.log(result.status);     // @expect: result.status === 'optimal'
console.log(result.objective);  // @expect: result.objective === 20
console.log(values[1]);         // @expect: values[1] === 10

highs.free();
```

## High-Level API

The `Model` class provides a builder interface for defining problems programmatically.

```typescript
import { Model, sum } from '@bubblyworld/highs-ts';

const model = new Model();

// Variables: numVar (continuous), intVar (integer), boolVar (binary)
const x = model.numVar(0, 10, 'x');
const y = model.numVar(0, 10, 'y');

// Constraints with expressions
model.addConstraint(x.plus(y).leq(10), 'c1');
model.addConstraint(x.leq(5), 'c2');

// Objective
model.maximize(x.plus(y.times(2)));

const solution = await model.solve();
console.log(solution.status);      // @expect: solution.status === 'optimal'
console.log(solution.objective);   // @expect: solution.objective === 20
console.log(solution.getValue(x)); // 0
console.log(solution.getValue(y)); // 10
```

Variable and constraint names can be any whitespace-free string. `solve()` hands the model to the solver in MPS format, which — unlike the LP grammar — reserves no characters, so names like `item-cost` or `x[1,2]` are fine. To inspect a model yourself, `model.print()` returns CPLEX LP text and `model.print('mps')` returns MPS.

Expressions support chained arithmetic: `plus()`, `minus()`, `times()`, `neg()`. Constraints are created with `leq()`, `geq()`, and `eq()`. The `sum()` helper combines multiple terms, either spread as arguments or passed as a single array (prefer the array form for very large collections), and `solution.getValue()` evaluates a variable or any linear expression against the solution. You can mix and match different kinds of variables and constraints as you like:

```typescript
const model = new Model();
const x_a = model.intVar(0, 10, 'x_a');
const x_b = model.intVar(0, 8, 'x_b');
const y_a = model.boolVar('y_a');
const y_b = model.boolVar('y_b');

model.addConstraint(x_a.minus(y_a.times(10)).leq(0), 'cap_a');
model.addConstraint(x_b.minus(y_b.times(8)).leq(0), 'cap_b');
model.addConstraint(x_a.plus(x_b).leq(12), 'material');

model.maximize(
  x_a.times(10)
    .plus(x_b.times(12))
    .minus(y_a.times(50))
    .minus(y_b.times(60))
);

const solution = await model.solve();
console.log(solution.objective); // @expect: solution.objective === 50
```

## Modelling Primitives

The `Model` class includes a number of higher-level primitives for common MILP reformulations, built on top of the basic variable and constraint API. Logical operations (`and`, `or`, `not`, `xor`), cardinality constraints (`addAtMost`, `addAtLeast`, `addExactly`), indicators, `abs`, `max`, `min`, and `product` are all available — see the source for full details. The rest of this section covers some of the less obvious primitives.

### Semi-Continuous Variables

A semi-continuous variable is either exactly zero or lies within a range `[lb, ub]`, with no values in between. This is useful for modelling minimum-batch-size or on/off decisions where partial activation doesn't make sense.

```typescript
const model = new Model();
const batch = model.semiContVar(100, 500, 'batch');

model.maximize(batch);
const solution = await model.solve();
console.log(solution.objective); // @expect: solution.objective === 500
```

### Integer Division

`divMod(expr, d)` returns quotient and remainder variables for dividing a non-negative integer expression by a positive integer constant.

```typescript
const model = new Model();
const minutes = model.intVar(0, 1440, 'minutes');
const { quotient, remainder } = model.divMod(minutes, 60);

model.addConstraint(minutes.eq(145));
model.minimize(quotient);

const solution = await model.solve();
console.log(solution.objective); // @expect: solution.objective === 2
```

### Either-Or Constraints

`addEitherOr(c1, c2)` enforces that at least one of two constraints must hold, using indicator variables internally.

```typescript
const model = new Model();
const x = model.numVar(0, 100, 'x');
const y = model.numVar(0, 100, 'y');

model.addEitherOr(x.leq(10), y.leq(10));
model.maximize(x.plus(y));

const solution = await model.solve();
console.log(solution.objective); // @expect: solution.objective === 110
```

### Reification

`reify(constraint)` returns a binary variable `delta` that is 1 if and only if the constraint is satisfied. This is the most general way to convert a constraint into a variable for use in other expressions. It supports `<=`, `>=`, and `=` senses.

```typescript
const model = new Model();
const tasks = [
  model.intVar(0, 10, 'a'),
  model.intVar(0, 10, 'b'),
  model.intVar(0, 10, 'c'),
];

const overloaded = tasks.map(t => model.reify(t.geq(8)));
model.addConstraint(sum(...overloaded).leq(1));

model.maximize(sum(...tasks));
const solution = await model.solve();
console.log(solution.objective); // @expect: solution.objective === 24
```

Epsilon defaults to 1 for purely-integer expressions (exact reification) and 1e-6 for continuous expressions. Both epsilon and Big-M can be overridden via options:

```typescript
const model = new Model();
const x = model.numVar(0, 100, 'x');
const delta = model.reify(x.leq(50), { bigM: 200, epsilon: 1e-4 });

model.addConstraint(delta.eq(1));
model.maximize(x);

const solution = await model.solve();
console.log(solution.objective); // @expect: solution.objective === 50
```

## Configuration

### Console Output

By default, solver output is suppressed. To enable progress logging, pass an explicit console configuration:

```typescript
const highs = await HiGHS.create({
  console: {
    log: (msg) => console.log(msg),
    error: (msg) => console.error(msg)
  }
});
```

The same option works for `Model.solve()`:

```typescript
const solution = await model.solve({
  console: { log: console.log, error: console.error }
});
```

## Building

Build the project (requires Emscripten for WASM compilation):

```bash
npm run build
npm run build:ts
npm run build:wasm
```

Run the test suite (requires a playwright-compatible browser):

```bash
npm test
npm run test:node    # Node only
npm run test:browser # Browser only (using Playwright)
```

Start the development server:

```bash
npm run serve
```

## Licensing

This package is licensed under the MIT License. The WASM bundle includes [HiGHS](https://highs.dev), also licensed under MIT ([license](https://github.com/ERGO-Code/HiGHS/blob/master/LICENSE.txt)).

## Acknowledgements

The vast majority of the credit here goes to the authors of [HiGHS](https://highs.dev). I've just packaged it nicely for use in the javascript/typescript world.
