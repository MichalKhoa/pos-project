import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSalePayload } from '../utils/buildSalePayload';

// Golden fixtures shared with backend/tests/test_sale_contract.py.
// Fixtures with knownBugs.frontend are expected to fail until the bug is fixed
// (it.fails). When a fix lands the test reports it, so delete the knownBugs entry then.
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
    const run = fx.knownBugs?.frontend ? it.fails : it;
    run(`${fx.name}${fx.knownBugs?.frontend ? ` (known bug ${fx.knownBugs.frontend})` : ''}`, () => {
      const { sale } = buildSalePayload(fx.input);
      expect(sale).toMatchObject(fx.payload);
    });
  }
});
