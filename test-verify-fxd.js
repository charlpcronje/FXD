#!/usr/bin/env node
/**
 * Simple verification script to check .fxd file format
 * and basic FX functionality without external dependencies
 */

import fs from 'fs';
import path from 'path';

console.log('=== FXD Verification Report ===\n');

// 1. Check for .fxd files
console.log('1. .fxd FILE FORMAT VERIFICATION');
console.log('--------------------------------');

const exampleDir = './examples';
const fxdFiles = [];

if (fs.existsSync(exampleDir)) {
    const files = fs.readdirSync(exampleDir);
    for (const file of files) {
        if (file.endsWith('.fxd')) {
            const filepath = path.join(exampleDir, file);
            const stats = fs.statSync(filepath);
            const buffer = fs.readFileSync(filepath, null).slice(0, 16);
            const isSQLite = buffer.toString('ascii', 0, 6) === 'SQLite';

            fxdFiles.push({
                name: file,
                size: stats.size,
                isSQLite: isSQLite
            });
        }
    }
}

if (fxdFiles.length > 0) {
    console.log('✅ Found', fxdFiles.length, '.fxd SQLite database files:');
    for (const file of fxdFiles) {
        console.log(`   - ${file.name} (${file.size} bytes) ${file.isSQLite ? '[Valid SQLite]' : '[Invalid]'}`);
    }
} else {
    console.log('❌ No .fxd files found in examples/');
}

// 2. Check module structure
console.log('\n2. MODULE COMPLETENESS');
console.log('----------------------');

const requiredModules = [
    { path: './modules/fx-persistence.ts', desc: 'SQLite persistence layer' },
    { path: './modules/fx-snippets.ts', desc: 'Snippet management' },
    { path: './modules/fx-view.ts', desc: 'View functionality' },
    { path: './modules/fx-transaction-system.ts', desc: 'Transaction handling' },
    { path: './modules/fx-group-extras.ts', desc: 'Group functionality' },
    { path: './database/db-connection.ts', desc: 'Database connection' },
    { path: './database/schema.sql', desc: 'Database schema' }
];

let moduleCount = 0;
for (const mod of requiredModules) {
    if (fs.existsSync(mod.path)) {
        console.log(`✅ ${mod.desc}: ${mod.path}`);
        moduleCount++;
    } else {
        console.log(`❌ ${mod.desc}: ${mod.path} [MISSING]`);
    }
}

console.log(`\nModules found: ${moduleCount}/${requiredModules.length}`);

// 3. Check core FX system
console.log('\n3. CORE FX SYSTEM');
console.log('-----------------');

const coreFiles = [
    { path: './fxn.ts', desc: 'Core FX TypeScript' },
    { path: './fx.js', desc: 'Compiled FX JavaScript' }
];

for (const file of coreFiles) {
    if (fs.existsSync(file.path)) {
        const stats = fs.statSync(file.path);
        const content = fs.readFileSync(file.path, 'utf8');

        // Check for key features
        const hasNode = content.includes('FXNode');
        const hasProxy = content.includes('FXNodeProxy');
        const hasCore = content.includes('FXCore');

        console.log(`✅ ${file.desc}: ${file.path}`);
        console.log(`   - Size: ${stats.size} bytes`);
        console.log(`   - Has FXNode: ${hasNode ? '✓' : '✗'}`);
        console.log(`   - Has FXNodeProxy: ${hasProxy ? '✓' : '✗'}`);
        console.log(`   - Has FXCore: ${hasCore ? '✓' : '✗'}`);
    } else {
        console.log(`❌ ${file.desc}: ${file.path} [MISSING]`);
    }
}

// 4. Check persistence schema
console.log('\n4. DATABASE SCHEMA');
console.log('------------------');

if (fs.existsSync('./database/schema.sql')) {
    const schema = fs.readFileSync('./database/schema.sql', 'utf8');

    const tables = [
        'nodes',
        'snippets',
        'views',
        'view_components',
        'project_metadata',
        'schema_version'
    ];

    console.log('✅ Schema file exists');
    for (const table of tables) {
        if (schema.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
            console.log(`   ✓ Table: ${table}`);
        } else {
            console.log(`   ✗ Table: ${table} [NOT FOUND]`);
        }
    }
} else {
    console.log('❌ database/schema.sql not found');
}

// 5. Check for examples
console.log('\n5. EXAMPLES AND TESTS');
console.log('---------------------');

const examples = [
    './examples/persistence-demo.ts',
    './test-node/persistence/sqlite.test.js',
    './database/persistence.test.ts'
];

for (const example of examples) {
    if (fs.existsSync(example)) {
        const stats = fs.statSync(example);
        console.log(`✅ ${example} (${stats.size} bytes)`);
    } else {
        console.log(`⚠️ ${example} [NOT FOUND]`);
    }
}

// 6. Performance claims check
console.log('\n6. PERFORMANCE CHARACTERISTICS');
console.log('------------------------------');

// Check for performance-related code
const perfFiles = [
    './modules/fx-performance-monitoring.ts',
    './test-node/performance/benchmark.js'
];

for (const file of perfFiles) {
    if (fs.existsSync(file)) {
        console.log(`✅ Performance file: ${file}`);
    } else {
        console.log(`⚠️ Performance file not found: ${file}`);
    }
}

// Final summary
console.log('\n=== SUMMARY ===');
console.log('---------------');

const issues = [];
const successes = [];

// .fxd format
if (fxdFiles.filter(f => f.isSQLite).length > 0) {
    successes.push('.fxd files are valid SQLite databases');
} else {
    issues.push('.fxd files are not SQLite databases');
}

// Module completeness
if (moduleCount === requiredModules.length) {
    successes.push('All required modules present');
} else {
    issues.push(`Missing ${requiredModules.length - moduleCount} required modules`);
}

// Core system
if (fs.existsSync('./fxn.ts') || fs.existsSync('./fx.js')) {
    successes.push('Core FX system exists');
} else {
    issues.push('Core FX system missing');
}

console.log('\n✅ SUCCESSES:');
for (const success of successes) {
    console.log(`   - ${success}`);
}

if (issues.length > 0) {
    console.log('\n❌ ISSUES:');
    for (const issue of issues) {
        console.log(`   - ${issue}`);
    }
}

console.log('\n=== END OF REPORT ===');