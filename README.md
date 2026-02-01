# scip-ts

[WASM](https://webassembly.org/) build of the [SCIP](https://scipopt.org) and [HiGHS](https://highs.dev) solvers with TypeScript bindings. Supports linear and mixed-integer linear programming, and runs in both node and browser environments with zero runtime dependencies. Note that the WASM module is ~8mb, so you may want to consider lazy-loading it instead of bundling it into your app.

## Basic Usage

The `SCIP` class provides direct access to the solver. Problems can be loaded from strings in [CPLEX LP](https://www.ibm.com/docs/en/icos/22.1.0?topic=cplex-lp-file-format-algebraic-representation) or [MPS](https://en.wikipedia.org/wiki/MPS_(format)) format.

```typescript
import { SCIP } from '@bubblyworld/scip-ts';

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

const scip = await SCIP.create();
await scip.parse(lp, 'lp');
const result = await scip.solve();

console.log(result.status);     // 'optimal'
console.log(result.objective);  // 20
console.log(result.solution);   // Map { 'x' => 0, 'y' => 10 }

scip.free();
```

## High-Level API

The `Model` class provides a builder interface for defining problems programmatically.

```typescript
import { Model, sum } from '@bubblyworld/scip-ts';

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
console.log(solution.status);      // 'optimal'
console.log(solution.objective);   // 20
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
console.log(solution.objective); // 50
```

## Configuration

### Console Output

By default, solver output is suppressed. To enable progress logging, pass an explicit console configuration:

```typescript
const scip = await SCIP.create({
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
npm run build        # Full build (WASM + TypeScript)
npm run build:ts     # TypeScript only
npm run build:wasm   # WASM only
```

Run the test suite:

```bash
npm test             # Node and browser tests
npm run test:node    # Node only
npm run test:browser # Browser only (using Playwright)
```

Start the development server:

```bash
npm run serve
```

## Acknowledgements

Obviously almost all the credit here goes to the authors of the SCIP and HiGHS solvers, which are pretty remarkable pieces of software. I've just packaged it nicely for use in the javascript world. Personally I think constraint solvers are high magic, and us programmers should really be using them more often as a primitive. If your optimisation problem is amenable to it, I've found that formulating a solution as a linear program is much more flexible than coding a solution directly (via dynamic programming, for instance). Small changes in requirements usually lead to small changes in the linear program - it's very maintainable in that sense. By contrast, almost any change in requirements for a dynamic programming algorithm requires rethinking the whole thing. Give it a try!
