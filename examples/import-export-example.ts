/**
 * FXD Import/Export Example
 * Demonstrates how to use the import/export system
 * @agent: agent-modules-io
 */

import { importSingleFile, importCodebase } from '../modules/fx-import.ts';
import { exportView, exportEntireDisk, TRANSFORM_RULES } from '../modules/fx-export.ts';

// Example 1: Import a single JavaScript file
console.log('Example 1: Import Single File');
console.log('==============================\n');

const jsFile = `
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

class ShoppingCart {
  constructor() {
    this.items = [];
  }

  addItem(item) {
    this.items.push(item);
  }

  getTotal() {
    return calculateTotal(this.items);
  }
}

export { calculateTotal, ShoppingCart };
`;

await Deno.writeTextFile('./temp-cart.js', jsFile);
const result = await importSingleFile('./temp-cart.js', 'shopping-cart');
console.log(`✓ Imported file with ${result.snippets?.length} snippets`);
await Deno.remove('./temp-cart.js');

// Example 2: Export a view
console.log('\nExample 2: Export View');
console.log('======================\n');

await exportView('shopping-cart', './exported-cart.js', {
  includeMarkers: true,
  metadata: { author: 'FXD System', version: '1.0.0' }
});
console.log('✓ Exported view to ./exported-cart.js');

// Clean up
await Deno.remove('./exported-cart.js');

// Example 3: Export with transforms
console.log('\nExample 3: Export with Transforms');
console.log('==================================\n');

await exportView('shopping-cart', './exported-timestamped.js', {
  transformRules: [TRANSFORM_RULES.addTimestamp]
});
console.log('✓ Exported with timestamp added');

// Clean up
await Deno.remove('./exported-timestamped.js');

// Example 4: Export entire FXD as archive
console.log('\nExample 4: Export Full Archive');
console.log('===============================\n');

await exportEntireDisk('./fxd-backup', {
  format: 'archive',
  metadata: { purpose: 'Example backup' }
});
console.log('✓ Created full FXD archive in ./fxd-backup/');

// Clean up
await Deno.remove('./fxd-backup', { recursive: true });

console.log('\nAll examples completed successfully!');
