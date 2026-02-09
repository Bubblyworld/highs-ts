import { describe, it, expect } from 'vitest';
import { HiGHS } from '../src/index.node.js';
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
    const highs = await HiGHS.create({
      console: { log: (text) => logs.push(text), error: null },
    });

    await highs.readProblem(examplePath('simple'));
    await highs.solve();
    highs.free();

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((log) => log.includes('HiGHS'))).toBe(true);
  });
});
