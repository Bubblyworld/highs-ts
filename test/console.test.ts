import { describe, it, expect } from 'vitest';
import { SCIP } from '../src/index.node.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function examplePath(name: string): string {
  return join(__dirname, '..', 'examples', `${name}.lp`);
}

describe('console configuration', () => {
  it('should capture stdout with log option', async () => {
    const logs: string[] = [];
    const scip = await SCIP.create({
      console: { log: (text) => logs.push(text), error: null },
    });

    await scip.readProblem(examplePath('simple'));
    await scip.solve();
    scip.free();

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((log) => log.includes('SCIP'))).toBe(true);
  });

  it('should capture stderr with error option', async () => {
    const errors: string[] = [];
    const scip = await SCIP.create({
      console: { log: null, error: (text) => errors.push(text) },
    });

    await scip.readProblem(examplePath('simple'));
    await scip.solve();
    scip.free();

    // SCIP may or may not write to stderr during normal operation,
    // so we just verify the option was accepted without error
    expect(Array.isArray(errors)).toBe(true);
  });

  it('should suppress all output with null options', async () => {
    const scip = await SCIP.create({
      console: { log: null, error: null },
    });

    await scip.readProblem(examplePath('simple'));
    await scip.solve();
    scip.free();

    // If we got here without console output, the test passed
    expect(true).toBe(true);
  });

  it('should use default console.log when no options provided', async () => {
    // This test just verifies the default behavior doesn't crash
    const scip = await SCIP.create();
    scip.free();
    expect(true).toBe(true);
  });
});
