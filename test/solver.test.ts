import { describe, it, expect, afterEach } from 'vitest';
import { SCIP } from '../src/index.node.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function examplePath(name: string): string {
  return join(__dirname, '..', 'examples', `${name}.lp`);
}

describe('SCIP', () => {
  let scip: SCIP | null = null;

  afterEach(() => {
    if (scip) {
      scip.free();
      scip = null;
    }
  });

  it('should create a SCIP instance', async () => {
    scip = await SCIP.create({ console: { log: null, error: null } });
    expect(scip).toBeDefined();
  });

  it('should read a problem from file', async () => {
    scip = await SCIP.create({ console: { log: null, error: null } });
    await expect(scip.readProblem(examplePath('simple'))).resolves.not.toThrow();
  });

  it('should solve a simple LP problem', async () => {
    scip = await SCIP.create({ console: { log: null, error: null } });
    await scip.readProblem(examplePath('simple'));
    const result = await scip.solve();

    expect(result.status).toBe('optimal');
    expect(result.objective).toBeCloseTo(20, 5);
    expect(result.solution).toBeDefined();
    expect(result.solution!.get('x')).toBeCloseTo(0, 5);
    expect(result.solution!.get('y')).toBeCloseTo(10, 5);
  });

  it('should detect infeasible problems', async () => {
    scip = await SCIP.create({ console: { log: null, error: null } });
    await scip.readProblem(examplePath('infeasible'));
    const result = await scip.solve();

    expect(result.status).toBe('infeasible');
    expect(result.objective).toBeUndefined();
    expect(result.solution).toBeUndefined();
  });

  it('should solve a travelling salesman problem', async () => {
    scip = await SCIP.create({ console: { log: null, error: null } });
    await scip.readProblem(examplePath('tsp'));
    const result = await scip.solve();

    expect(result.status).toBe('optimal');
    expect(result.objective).toBeCloseTo(80, 5);
  });

  it('should solve a bin packing problem', async () => {
    scip = await SCIP.create({ console: { log: null, error: null } });
    await scip.readProblem(examplePath('binpacking'));
    const result = await scip.solve();

    expect(result.status).toBe('optimal');
    expect(result.objective).toBeCloseTo(2, 5);
  });

  it('should solve a mixed-integer problem', async () => {
    scip = await SCIP.create({ console: { log: null, error: null } });
    await scip.readProblem(examplePath('milp'));
    const result = await scip.solve();

    expect(result.status).toBe('optimal');
    expect(result.objective).toBeCloseTo(50, 5);
    expect(result.solution!.get('y_a')).toBeCloseTo(1, 5);
    expect(result.solution!.get('y_b')).toBeCloseTo(0, 5);
    expect(result.solution!.get('x_a')).toBeCloseTo(10, 5);
    expect(result.solution!.get('x_b')).toBeCloseTo(0, 5);
  });

  it('should throw when using a freed instance', async () => {
    scip = await SCIP.create({ console: { log: null, error: null } });
    scip.free();

    await expect(scip.readProblem(examplePath('simple')))
      .rejects.toThrow('SCIP instance has been freed');

    scip = null;
  });

  it('should handle multiple free calls gracefully', async () => {
    scip = await SCIP.create({ console: { log: null, error: null } });
    scip.free();
    expect(() => scip!.free()).not.toThrow();
    scip = null;
  });
});
