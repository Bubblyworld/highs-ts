import { test, expect } from '@playwright/test';
import { fixtures } from './fixtures.js';

test('page loads correctly', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('example-select')).toBeVisible();
  await expect(page.getByTestId('run-button')).toBeDisabled();
});

test('examples are loaded in dropdown', async ({ page }) => {
  await page.goto('/');
  const select = page.getByTestId('example-select');
  await expect(select.locator('option')).toHaveCount(fixtures.length + 1);
});

for (const fixture of fixtures) {
  /**
   * CI uses a small container which often times out while running the more
   * expensive test fixtures inside a headless browser. Too many layers.
   */
  if (process.env.CI && fixture.expensive) continue;

  test(`solves ${fixture.name} example correctly`, async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('example-select').selectOption(fixture.name);
    await expect(page.getByTestId('problem-display')).not.toBeEmpty();
    await expect(page.getByTestId('run-button')).toBeEnabled();

    await page.getByTestId('run-button').click();

    await expect(page.getByTestId('result-status')).not.toHaveText('Running...', {
      timeout: 60000,
    });
    await expect(page.getByTestId('result-status')).toHaveText(fixture.expected.status);

    if (fixture.expected.objective !== undefined) {
      const objectiveText = await page.getByTestId('result-objective').textContent();
      const objective = parseFloat(objectiveText || '');
      expect(objective).toBeCloseTo(fixture.expected.objective, 1);
    } else {
      await expect(page.getByTestId('result-objective')).toHaveText('-');
    }

    if (fixture.expected.solution !== undefined) {
      const solutionText = await page.getByTestId('result-solution').textContent();
      const solution = JSON.parse(solutionText || '{}');
      for (const [key, value] of Object.entries(fixture.expected.solution)) {
        expect(solution[key]).toBeCloseTo(value, 1);
      }
    }

    const consoleText = await page.getByTestId('console-output').textContent();
    expect(consoleText).toContain('SCIP');
  });
}
