import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Experimental test that makes sure all the code examples in the REAME.md
 * work correctly. You can include "@expect: expression === value" comments
 * in the code blocks to explicitly test the output.
 */
describe('README code examples', () => {
  const readme = readFileSync(join(__dirname, '../README.md'), 'utf-8');
  const codeBlocks = extractTestableCodeBlocks(readme);

  for (const [index, block] of codeBlocks.entries()) {
    it(`code block ${index + 1} should run and pass expectations`, async () => {
      const { HiGHS, Model, sum } = await import('../src/index.node.js');

      const code = prepareCode(block);
      const expectations = extractExpectations(block);

      const varNames = new Set<string>();
      for (const exp of expectations) {
        const matches = exp.match(/\b(result|solution|highs|model)\b/g);
        if (matches) matches.forEach(m => varNames.add(m));
      }

      const returnVars = Array.from(varNames).join(', ');
      const asyncFn = new Function(
        'HiGHS',
        'Model',
        'sum',
        'console',
        `return (async () => {
          ${code}
          return { ${returnVars} };
        })()`
      );

      const vars = await asyncFn(HiGHS, Model, sum, {
        log: () => {},
        error: () => {},
      });

      for (const exp of expectations) {
        const checkFn = new Function(...Object.keys(vars), `return ${exp}`);
        const passed = checkFn(...Object.values(vars));
        expect(passed, `Expected: ${exp}`).toBe(true);
      }
    });
  }
});

function extractTestableCodeBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  const regex = /```typescript\n([\s\S]*?)```/g;

  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const code = match[1];
    if (code.includes('@expect:')) {
      blocks.push(code);
    }
  }

  return blocks;
}

function extractExpectations(code: string): string[] {
  const expectations: string[] = [];
  const lines = code.split('\n');

  for (const line of lines) {
    const match = line.match(/\/\/\s*@expect:\s*(.+)/);
    if (match) {
      expectations.push(match[1].trim());
    }
  }

  return expectations;
}

function prepareCode(code: string): string {
  return code
    .split('\n')
    .filter(line => !line.trim().startsWith('import '))
    .map(line => line.replace(/\/\/\s*@expect:.*/, ''))
    .join('\n');
}
