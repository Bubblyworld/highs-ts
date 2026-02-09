import { describe, it, expect, afterEach } from 'vitest';
import { HiGHS } from '../src/index.node.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fixtures } from './fixtures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function examplePath(name: string): string {
  return join(__dirname, '..', 'examples', `${name}.lp`);
}

describe('HiGHS', () => {
  let highs: HiGHS | null = null;

  afterEach(() => {
    if (highs) {
      highs.free();
      highs = null;
    }
  });

  describe('instance lifecycle', () => {
    it('should create a HiGHS instance', async () => {
      highs = await HiGHS.create({ console: { log: null, error: null } });
      expect(highs).toBeDefined();
    });

    it('should read a problem from file', async () => {
      highs = await HiGHS.create({ console: { log: null, error: null } });
      await expect(highs.readProblem(examplePath('simple'))).resolves.not.toThrow();
    });

    it('should throw when using a freed instance', async () => {
      highs = await HiGHS.create({ console: { log: null, error: null } });
      highs.free();

      await expect(highs.readProblem(examplePath('simple'))).rejects.toThrow(
        'HiGHS instance has been freed'
      );

      highs = null;
    });

    it('should handle multiple free calls gracefully', async () => {
      highs = await HiGHS.create({ console: { log: null, error: null } });
      highs.free();
      expect(() => highs!.free()).not.toThrow();
      highs = null;
    });
  });

  describe('solving examples', () => {
    for (const fixture of fixtures) {
      it(`should solve ${fixture.name}`, async () => {
        highs = await HiGHS.create({ console: { log: null, error: null } });
        await highs.readProblem(examplePath(fixture.name));
        const result = await highs.solve();

        expect(result.status).toBe(fixture.expected.status);

        if (fixture.expected.objective !== undefined) {
          expect(result.objective).toBeCloseTo(fixture.expected.objective, 5);
        } else {
          expect(result.objective).toBeUndefined();
        }

        if (fixture.expected.solution !== undefined) {
          expect(result.solution).toBeDefined();
          for (const [key, value] of Object.entries(fixture.expected.solution)) {
            expect(result.solution!.get(key)).toBeCloseTo(value, 5);
          }
        } else if (fixture.expected.status === 'infeasible') {
          expect(result.solution).toBeUndefined();
        }
      });
    }
  });
});
