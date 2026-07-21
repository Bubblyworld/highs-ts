import { describe, it, expect } from 'vitest';
import { HiGHS, HIGHS_INF } from '../src/index.node.js';

// max x + 2y  s.t.  x + y <= 10,  x <= 5,  0 <= x,y <= 10  →  obj 20 at (0, 10)
const SIMPLE = {
  numCol: 2,
  numRow: 2,
  sense: 'maximize' as const,
  colCost: [1, 2],
  colUpper: [10, 10],
  rowUpper: [10, 5],
  matrix: {
    start: [0, 2, 3],
    index: [0, 1, 0],
    value: [1, 1, 1],
  },
};

describe('passModel', () => {
  it('reports support on this wasm build', async () => {
    const highs = await HiGHS.create();
    expect(highs.supportsPassModel()).toBe(true);
    highs.free();
  });

  it('solves an LP passed as raw columnar data', async () => {
    const highs = await HiGHS.create();
    highs.passModel(SIMPLE);
    const result = await highs.solve();
    highs.free();

    expect(result.status).toBe('optimal');
    expect(result.objective).toBeCloseTo(20, 5);
  });

  it('matches the parse() path on the same problem', async () => {
    const viaParse = await HiGHS.create();
    await viaParse.parse(
      `Maximize
 obj: x + 2 y
Subject To
 c1: x + y <= 10
 c2: x <= 5
Bounds
 0 <= x <= 10
 0 <= y <= 10
End`,
      'lp',
    );
    const parsed = await viaParse.solve();
    viaParse.free();

    const viaPass = await HiGHS.create();
    viaPass.passModel(SIMPLE);
    const passed = await viaPass.solve();
    viaPass.free();

    expect(passed.status).toBe(parsed.status);
    expect(passed.objective).toBeCloseTo(parsed.objective!, 8);
  });

  it('reads the solution back densely via getSolutionValues', async () => {
    const highs = await HiGHS.create();
    highs.passModel(SIMPLE);
    await highs.solve();
    const values = highs.getSolutionValues();
    highs.free();

    expect(values.length).toBe(2);
    expect(values[0]).toBeCloseTo(0, 5);
    expect(values[1]).toBeCloseTo(10, 5);
  });

  it('accepts typed arrays and default bounds', async () => {
    const highs = await HiGHS.create();
    highs.passModel({
      numCol: 2,
      numRow: 1,
      sense: 'maximize',
      colCost: Float64Array.from([3, 1]),
      colUpper: Float64Array.from([HIGHS_INF, HIGHS_INF]),
      rowUpper: Float64Array.from([4]),
      matrix: {
        start: Int32Array.from([0, 2]),
        index: Int32Array.from([0, 1]),
        value: Float64Array.from([1, 1]),
      },
    });
    const result = await highs.solve();
    highs.free();

    expect(result.status).toBe('optimal');
    expect(result.objective).toBeCloseTo(12, 5);
  });

  it('solves a MIP when integrality is given', async () => {
    // max x + y  s.t.  x + y <= 2.5, x,y integer in [0, 2]  →  obj 2
    const highs = await HiGHS.create();
    highs.passModel({
      numCol: 2,
      numRow: 1,
      sense: 'maximize',
      colCost: [1, 1],
      colUpper: [2, 2],
      rowUpper: [2.5],
      matrix: { start: [0, 2], index: [0, 1], value: [1, 1] },
      integrality: [1, 1],
    });
    const result = await highs.solve();
    const values = highs.getSolutionValues();
    highs.free();

    expect(result.status).toBe('optimal');
    expect(result.objective).toBeCloseTo(2, 5);
    expect(values[0] + values[1]).toBeCloseTo(2, 5);
    expect(Math.abs(values[0] - Math.round(values[0]))).toBeLessThan(1e-6);
  });

  it('validates array lengths', async () => {
    const highs = await HiGHS.create();
    expect(() => highs.passModel({ ...SIMPLE, colCost: [1] })).toThrow(/colCost/);
    expect(() => highs.passModel({
      ...SIMPLE, matrix: { ...SIMPLE.matrix, start: [0, 2] },
    })).toThrow(/matrix\.start/);
    highs.free();
  });
});
