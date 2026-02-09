# highs-ts

[![npm version](https://img.shields.io/npm/v/@bubblyworld/highs-ts)](https://www.npmjs.com/package/@bubblyworld/highs-ts)
[![CI](https://github.com/Bubblyworld/highs-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/Bubblyworld/highs-ts/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

[WASM](https://webassembly.org/) build of the [HiGHS](https://highs.dev) solver with TypeScript bindings. Supports linear and mixed-integer linear programming, and runs in both node and browser environments with zero runtime dependencies.

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

Expressions support chained arithmetic: `plus()`, `minus()`, `times()`, `neg()`. Constraints are created with `leq()`, `geq()`, and `eq()`. The `sum()` helper combines multiple terms. You can mix and match different kinds of variables and constraints as you like:

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

This package is licensed under the MIT License. The WASM bundle includes:

- **HiGHS** - Licensed under MIT by the HiGHS team ([license](https://github.com/ERGO-Code/HiGHS/blob/master/LICENSE))

## Acknowledgements

The vast majority of the credit here goes to the authors of [HiGHS](https://highs.dev). I've just packaged it nicely for use in the javascript/typescript world.
