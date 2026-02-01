import { describe, it, expect } from 'vitest';
import { Model, sum } from '../src/index.node.js';

describe('Model', () => {
  describe('simple LP', () => {
    it('should solve a simple maximization problem', async () => {
      const model = new Model();
      const x = model.numVar(0, 10, 'x');
      const y = model.numVar(0, 10, 'y');

      model.addConstraint(x.plus(y).leq(10), 'c1');
      model.addConstraint(x.leq(5), 'c2');
      model.maximize(x.plus(y.times(2)));

      const solution = await model.solve();

      expect(solution.status).toBe('optimal');
      expect(solution.objective).toBeCloseTo(20, 5);
      expect(solution.getValue(x)).toBeCloseTo(0, 5);
      expect(solution.getValue(y)).toBeCloseTo(10, 5);
    });

    it('should solve a minimization problem', async () => {
      const model = new Model();
      const x = model.numVar(0, 10, 'x');
      const y = model.numVar(0, 10, 'y');

      model.addConstraint(x.plus(y).geq(5));
      model.minimize(x.plus(y));

      const solution = await model.solve();

      expect(solution.status).toBe('optimal');
      expect(solution.objective).toBeCloseTo(5, 5);
    });
  });

  describe('MILP', () => {
    it('should solve a mixed-integer problem', async () => {
      const model = new Model();
      const x_a = model.intVar(0, 10, 'x_a');
      const x_b = model.intVar(0, 8, 'x_b');
      const y_a = model.boolVar('y_a');
      const y_b = model.boolVar('y_b');

      model.addConstraint(x_a.minus(y_a.times(10)).leq(0), 'cap_a');
      model.addConstraint(x_b.minus(y_b.times(8)).leq(0), 'cap_b');
      model.addConstraint(x_a.plus(x_b).leq(12), 'material');

      model.maximize(
        x_a.times(10).plus(x_b.times(12)).minus(y_a.times(50)).minus(y_b.times(60))
      );

      const solution = await model.solve();

      expect(solution.status).toBe('optimal');
      expect(solution.objective).toBeCloseTo(50, 5);
      expect(solution.getValue(y_a)).toBeCloseTo(1, 5);
      expect(solution.getValue(y_b)).toBeCloseTo(0, 5);
      expect(solution.getValue(x_a)).toBeCloseTo(10, 5);
      expect(solution.getValue(x_b)).toBeCloseTo(0, 5);
    });

    it('should handle binary variables correctly', async () => {
      const model = new Model();
      const x = model.boolVar('x');
      const y = model.boolVar('y');

      model.addConstraint(x.plus(y).geq(1));
      model.minimize(x.plus(y));

      const solution = await model.solve();

      expect(solution.status).toBe('optimal');
      expect(solution.objective).toBeCloseTo(1, 5);
    });
  });

  describe('infeasible problems', () => {
    it('should detect infeasible problems', async () => {
      const model = new Model();
      const x = model.numVar(0, 10, 'x');

      model.addConstraint(x.geq(5));
      model.addConstraint(x.leq(3));
      model.minimize(x);

      const solution = await model.solve();

      expect(solution.status).toBe('infeasible');
      expect(solution.objective).toBeUndefined();
    });
  });

  describe('expression building', () => {
    it('should support chained operations', async () => {
      const model = new Model();
      const x = model.numVar(0, 10, 'x');
      const y = model.numVar(0, 10, 'y');
      const z = model.numVar(0, 10, 'z');

      model.addConstraint(x.plus(y).plus(z).leq(15));
      model.maximize(x.plus(y.times(2)).plus(z.times(3)));

      const solution = await model.solve();

      expect(solution.status).toBe('optimal');
      expect(solution.objective).toBeCloseTo(40, 5);
      expect(solution.getValue(z)).toBeCloseTo(10, 5);
    });

    it('should support negation', async () => {
      const model = new Model();
      const x = model.numVar(0, 10, 'x');
      const y = model.numVar(0, 10, 'y');

      model.addConstraint(x.minus(y).leq(0));
      model.addConstraint(x.geq(5));
      model.maximize(y.minus(x));

      const solution = await model.solve();

      expect(solution.status).toBe('optimal');
      expect(solution.getValue(x)).toBeCloseTo(5, 5);
      expect(solution.getValue(y)).toBeCloseTo(10, 5);
    });

    it('should support equality constraints', async () => {
      const model = new Model();
      const x = model.numVar(0, 10, 'x');
      const y = model.numVar(0, 10, 'y');

      model.addConstraint(x.plus(y).eq(10));
      model.addConstraint(x.eq(3));
      model.maximize(y);

      const solution = await model.solve();

      expect(solution.status).toBe('optimal');
      expect(solution.getValue(x)).toBeCloseTo(3, 5);
      expect(solution.getValue(y)).toBeCloseTo(7, 5);
    });
  });

  describe('helper functions', () => {
    it('sum() should combine variables and expressions', async () => {
      const model = new Model();
      const x = model.numVar(0, 10, 'x');
      const y = model.numVar(0, 10, 'y');
      const z = model.numVar(0, 10, 'z');

      model.addConstraint(sum(x, y, z).leq(20));
      model.maximize(sum(x, y.times(2), z.times(3)));

      const solution = await model.solve();

      expect(solution.status).toBe('optimal');
      expect(solution.objective).toBeCloseTo(50, 5);
    });

    it('sum() should handle constants', async () => {
      const model = new Model();
      const x = model.numVar(0, 10, 'x');

      model.addConstraint(sum(x, 5).leq(12));
      model.maximize(x);

      const solution = await model.solve();

      expect(solution.status).toBe('optimal');
      expect(solution.getValue(x)).toBeCloseTo(7, 5);
    });

  });

  describe('print', () => {
    it('should generate valid LP format', () => {
      const model = new Model();
      const x = model.numVar(0, 10, 'x');
      const y = model.numVar(0, 10, 'y');

      model.addConstraint(x.plus(y).leq(10), 'c1');
      model.maximize(x.plus(y.times(2)));

      const lp = model.print();

      expect(lp).toContain('Maximize');
      expect(lp).toContain('obj:');
      expect(lp).toContain('Subject To');
      expect(lp).toContain('c1:');
      expect(lp).toContain('Bounds');
      expect(lp).toContain('End');
    });

    it('should include General section for integer variables', () => {
      const model = new Model();
      const x = model.intVar(0, 10, 'x');

      model.addConstraint(x.leq(5));
      model.maximize(x);

      const lp = model.print();

      expect(lp).toContain('General');
      expect(lp).toContain('x');
    });

    it('should include Binary section for binary variables', () => {
      const model = new Model();
      const x = model.boolVar('x');

      model.addConstraint(x.leq(1));
      model.maximize(x);

      const lp = model.print();

      expect(lp).toContain('Binary');
      expect(lp).toContain('x');
    });

    it('should generate valid MPS format', () => {
      const model = new Model();
      const x = model.numVar(0, 10, 'x');
      const y = model.numVar(0, 10, 'y');

      model.addConstraint(x.plus(y).leq(10), 'c1');
      model.maximize(x.plus(y.times(2)));

      const mps = model.print('mps');

      expect(mps).toContain('NAME');
      expect(mps).toContain('OBJSENSE');
      expect(mps).toContain('MAX');
      expect(mps).toContain('ROWS');
      expect(mps).toContain('N  obj');
      expect(mps).toContain('L  c1');
      expect(mps).toContain('COLUMNS');
      expect(mps).toContain('RHS');
      expect(mps).toContain('BOUNDS');
      expect(mps).toContain('ENDATA');
    });

    it('should include integer markers in MPS format', () => {
      const model = new Model();
      const x = model.intVar(0, 10, 'x');

      model.addConstraint(x.leq(5));
      model.maximize(x);

      const mps = model.print('mps');

      expect(mps).toContain("'INTORG'");
      expect(mps).toContain("'INTEND'");
    });

    it('should mark binary variables in MPS format', () => {
      const model = new Model();
      const x = model.boolVar('x');

      model.addConstraint(x.leq(1));
      model.maximize(x);

      const mps = model.print('mps');

      expect(mps).toContain('BV bnd  x');
    });
  });

  describe('auto-generated names', () => {
    it('should auto-generate variable names', async () => {
      const model = new Model();
      const x = model.numVar(0, 10);
      const y = model.numVar(0, 10);

      model.addConstraint(x.plus(y).leq(10));
      model.maximize(x.plus(y));

      const solution = await model.solve();

      expect(solution.status).toBe('optimal');
      expect(x.name).toBe('x0');
      expect(y.name).toBe('x1');
    });

    it('should auto-generate constraint names', () => {
      const model = new Model();
      const x = model.numVar(0, 10);

      model.addConstraint(x.leq(5));
      model.addConstraint(x.geq(0));

      const lp = model.print();

      expect(lp).toContain('c0:');
      expect(lp).toContain('c1:');
    });
  });

  describe('LP format compatibility', () => {
    it('should generate LP that produces same result as example milp.lp', async () => {
      const model = new Model();
      const x_a = model.intVar(0, 10, 'x_a');
      const x_b = model.intVar(0, 8, 'x_b');
      const y_a = model.boolVar('y_a');
      const y_b = model.boolVar('y_b');

      model.addConstraint(x_a.minus(y_a.times(10)).leq(0), 'cap_a');
      model.addConstraint(x_b.minus(y_b.times(8)).leq(0), 'cap_b');
      model.addConstraint(x_a.plus(x_b).leq(12), 'material');

      model.maximize(
        x_a.times(10).plus(x_b.times(12)).minus(y_a.times(50)).minus(y_b.times(60))
      );

      const solution = await model.solve();

      expect(solution.status).toBe('optimal');
      expect(solution.objective).toBeCloseTo(50, 5);
    });

    it('generated LP should be readable by low-level API', async () => {
      const { SCIP } = await import('../src/index.node.js');

      const model = new Model();
      const x = model.numVar(0, 10, 'x');
      const y = model.numVar(0, 10, 'y');

      model.addConstraint(x.plus(y).leq(10), 'c1');
      model.addConstraint(x.leq(5), 'c2');
      model.maximize(x.plus(y.times(2)));

      const lp = model.print();

      const scip = await SCIP.create({ console: { log: null, error: null } });
      try {
        await scip.parse(lp, 'lp');
        const result = await scip.solve();

        expect(result.status).toBe('optimal');
        expect(result.objective).toBeCloseTo(20, 5);
      } finally {
        scip.free();
      }
    });
  });
});
