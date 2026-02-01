import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Extracts TypeScript code blocks from markdown and verifies they run correctly.
 *
 * Code blocks can include special comments for expectations:
 *   // @expect: expression === value
 *
 * These are converted into expect() assertions. Blocks must contain @expect
 * comments to be tested.
 */
describe('README code examples', () => {
  const readme = readFileSync(join(__dirname, '../README.md'), 'utf-8');
  const codeBlocks = extractTestableCodeBlocks(readme);

  for (const [index, block] of codeBlocks.entries()) {
    it(`code block ${index + 1} should run and pass expectations`, async () => {
      const { SCIP, Model, sum } = await import('../src/index.node.js');

      const expectations = extractExpectations(block);
      const cleanCode = prepareCode(block);

      // Extract variable names referenced in expectations
      const varNames = new Set<string>();
      for (const exp of expectations) {
        const matches = exp.match(/\b(result|solution|scip|model)\b/g);
        if (matches) matches.forEach(m => varNames.add(m));
      }

      // Create a function that runs the code and returns referenced variables
      const returnVars = Array.from(varNames).join(', ');
      const asyncFn = new Function(
        'SCIP',
        'Model',
        'sum',
        'console',
        `return (async () => {
          ${cleanCode}
          return { ${returnVars} };
        })()`
      );

      // Suppress console output during test
      const silentConsole = { log: () => {}, error: () => {} };
      const vars = await asyncFn(SCIP, Model, sum, silentConsole);

      // Check expectations
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
    // Only include blocks that have @expect comments
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
    // Remove import statements (we inject dependencies)
    .filter(line => !line.trim().startsWith('import '))
    // Remove @expect comments (keep other comments)
    .map(line => line.replace(/\/\/\s*@expect:.*/, ''))
    .join('\n');
}
