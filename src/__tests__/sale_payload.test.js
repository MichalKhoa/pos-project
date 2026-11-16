import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSalePayload } from '../utils/buildSalePayload';

// Golden fixtures shared with backend/tests/test_sale_contract.py.
// Fixtures with knownBugs.frontend (F-027) must show exactly that symptom: a
// fractional quantity truncated to 0. Any other mismatch still fails the test.
// When the fix lands the symptom check fails, so delete the knownBugs entry then.
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend/tests/fixtures/sales');
const fixtures = fs
  .readdirSync(dir)
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
  .filter(fx => fx.input);

describe('buildSalePayload matches shared sale fixtures', () => {
  it('loads the fixtures', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(7);
  });

  for (const fx of fixtures) {
    const bug = fx.knownBugs?.frontend;
    it(`${fx.name}${bug ? ` (known bug ${bug})` : ''}`, () => {
      const { sale } = buildSalePayload(fx.input);
      if (bug) {
        expect(
          sale.items.some(i => i.quantity === 0),
          `bug fixed (${bug}): remove knownBugs.frontend from the fixture`
        ).toBe(true);
        expect(() => expect(sale).toMatchObject(fx.payload)).toThrow();
      } else {
        expect(sale).toMatchObject(fx.payload);
      }
    });
  }
});
