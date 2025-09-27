# FXD Testing Guide

Comprehensive testing documentation for the FXD (FX Disk) framework.

## Overview

The FXD testing suite provides multi-layered testing coverage including:

- **Unit Tests** - Individual component testing
- **Integration Tests** - Module interaction testing
- **Performance Tests** - Benchmarks and stress testing
- **UI Tests** - Browser-based interface testing with Puppeteer
- **Persistence Tests** - SQLite database operations testing
- **Coverage Reporting** - Detailed code coverage analysis
- **CI/CD Integration** - Automated testing pipeline

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm run test:all

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:sqlite        # Database tests only
npm run test:ui            # UI tests only
npm run test:performance   # Performance benchmarks

# Generate coverage reports
npm run coverage

# Run tests with watch mode
npm run test:watch

# Run Deno tests (if Deno available)
npm run test:deno
```

## Test Structure

```
test-node/
├── unit/                  # Unit tests for core components
│   └── core.test.js      # FXNode, proxy, type system tests
├── integration/           # Integration tests
│   └── integration.test.js # Module interaction tests
├── persistence/           # Database layer tests
│   └── sqlite.test.js    # SQLite persistence tests
├── performance/           # Performance and stress tests
│   └── benchmark.js      # Benchmarking suite
├── puppeteer/             # UI tests
│   └── ui-tests.js       # Browser-based testing
└── coverage/              # Coverage reporting
    └── coverage-reporter.js # Custom coverage reporter

test/                      # Deno-specific tests
├── fx-snippets.test.ts   # Snippet functionality
├── fx-markers.test.ts    # Marker system
├── fx-view.test.ts       # View rendering
├── fx-parse.test.ts      # Parsing logic
└── round-trip.test.ts    # Complete workflows
```

## Test Types

### Unit Tests (`test-node/unit/`)

Test individual components in isolation:

- **FXNode** - Core node structure and operations
- **FXProxy** - Proxy interface functionality
- **Type System** - Type registration and validation
- **Effect System** - Effect triggers and conditions
- **Event System** - Event emission and handling
- **Validation** - Data validation rules

```bash
npm run test:unit
```

### Integration Tests (`test-node/integration/`)

Test component interactions:

- **Core Module Integration** - FX core with node creation
- **Selector Engine Integration** - Node tree querying
- **Persistence Integration** - SQLite with node operations
- **UI Integration** - Web server with data layer
- **CLI Integration** - Command line interface testing
- **Plugin System** - Plugin loading and dependencies
- **Error Recovery** - Failure handling and recovery

```bash
npm run test:integration
```

### Persistence Tests (`test-node/persistence/`)

Test database operations:

- **Schema Operations** - Table creation and structure
- **Project Operations** - CRUD operations for projects
- **Node Operations** - Node storage and retrieval
- **Change Logging** - Operation history tracking
- **Snapshot Management** - Project state snapshots
- **Performance** - Large dataset handling
- **Error Handling** - Corruption and recovery

```bash
npm run test:sqlite
```

### UI Tests (`test-node/puppeteer/`)

Browser-based testing with Puppeteer:

- **Application Loading** - Page load and initialization
- **Node Tree Visualization** - Tree rendering and interaction
- **Real-time Updates** - Live data synchronization
- **Editor Interface** - Value editing and validation
- **Performance** - Large dataset rendering
- **Accessibility** - Keyboard navigation and ARIA
- **Mobile Responsiveness** - Touch interactions
- **Error Handling** - User-friendly error display

```bash
npm run test:ui
```

### Performance Tests (`test-node/performance/`)

Benchmarks and stress testing:

- **Node Creation** - Mass node creation performance
- **Selector Performance** - Query execution speed
- **Memory Usage** - Memory efficiency testing
- **Watcher Performance** - Event system efficiency
- **Concurrent Operations** - Multi-threaded scenarios
- **Stress Tests** - Prolonged heavy usage

```bash
npm run test:performance
```

## Coverage Reporting

The testing suite includes comprehensive coverage reporting:

### Coverage Metrics

- **Line Coverage** - Percentage of code lines executed
- **Function Coverage** - Percentage of functions called
- **Branch Coverage** - Percentage of code branches taken
- **Statement Coverage** - Percentage of statements executed

### Coverage Thresholds

- **Lines**: 80% minimum
- **Functions**: 80% minimum
- **Branches**: 70% minimum

### Report Formats

Coverage reports are generated in multiple formats:

- **HTML Report** - Interactive web-based report (`coverage.html`)
- **JSON Report** - Machine-readable data (`coverage.json`)
- **LCOV Report** - CI integration format (`lcov.info`)

```bash
# Generate coverage reports
npm run coverage

# View HTML report
open test-reports/coverage.html
```

## Test Runner

The unified test runner (`test-runner.js`) orchestrates all test suites:

```bash
# Run all test suites
npm run test:all

# Run specific suite
npm run test:suite "Unit"

# Generate reports only
npm run test:reports

# CI/CD pipeline
npm run test:ci
```

### Test Runner Features

- **Parallel Execution** - Runs compatible tests concurrently
- **Failure Isolation** - Continues testing after failures
- **Comprehensive Reporting** - Unified results across all suites
- **Environment Detection** - Adapts to available tools (Deno, display)
- **CI Integration** - Appropriate exit codes for build systems

## CI/CD Integration

### GitHub Actions

The project includes comprehensive GitHub Actions workflows (`.github/workflows/test.yml`):

- **Multi-Node Testing** - Tests against Node.js 18, 20, 22
- **Deno Testing** - Runs Deno-specific tests
- **UI Testing** - Browser-based tests with headless Chrome
- **Security Scanning** - Dependency vulnerability checks
- **Quality Gates** - Coverage and test stability checks
- **Artifact Upload** - Saves reports and build outputs

### Local CI Simulation

```bash
# Simulate CI pipeline locally
npm run test:ci

# Check quality gates
npm run test:all && echo "Quality gates passed"
```

## Writing Tests

### Unit Test Example

```javascript
import { strict as assert } from 'node:assert';
import { test, describe, beforeEach } from 'node:test';

describe('My Component', () => {
    let component;

    beforeEach(() => {
        component = createComponent();
    });

    test('should perform basic operation', () => {
        const result = component.operation('input');
        assert.equal(result, 'expected');
    });

    test('should handle edge cases', () => {
        assert.throws(() => component.operation(null));
    });
});
```

### Integration Test Example

```javascript
test('should integrate components', async () => {
    const component1 = createComponent1();
    const component2 = createComponent2();

    component1.connect(component2);

    const result = await component1.processWithComponent2('data');
    assert(result.success);
    assert.equal(result.processedBy, 'component2');
});
```

### Performance Test Example

```javascript
test('should perform operation efficiently', () => {
    const startTime = performance.now();

    for (let i = 0; i < 1000; i++) {
        component.operation(i);
    }

    const duration = performance.now() - startTime;
    assert(duration < 100, `Should complete in under 100ms, took ${duration}ms`);
});
```

## Best Practices

### Test Organization

- **One test file per module** - Keep tests focused and organized
- **Descriptive test names** - Clearly state what is being tested
- **Setup and teardown** - Use `beforeEach`/`afterEach` for clean state
- **Test isolation** - Each test should be independent

### Test Quality

- **Test edge cases** - Don't just test the happy path
- **Use meaningful assertions** - Assert specific expected values
- **Mock external dependencies** - Isolate components under test
- **Test error conditions** - Verify proper error handling

### Performance Considerations

- **Mock expensive operations** - Don't hit real databases in unit tests
- **Use appropriate timeouts** - Some operations need more time
- **Clean up resources** - Prevent memory leaks in test suite
- **Batch similar tests** - Group related tests for efficiency

## Troubleshooting

### Common Issues

**Tests fail with "command not found"**
```bash
# Install missing dependencies
npm install

# Check Node.js version
node --version  # Should be >= 18.0.0
```

**UI tests fail with display errors**
```bash
# Install Chrome dependencies (Linux)
sudo apt-get install chromium-browser

# Set environment variable
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

**SQLite tests fail with permission errors**
```bash
# Ensure write permissions to temp directory
chmod 755 /tmp
```

**Coverage reports missing**
```bash
# Generate reports manually
npm run coverage
```

### Debug Mode

Enable verbose test output:

```bash
# Debug specific test
node --test --reporter=tap test-node/unit/core.test.js

# Debug with Node.js inspector
node --inspect --test test-node/unit/core.test.js
```

## Contributing

When adding new functionality:

1. **Write tests first** - Follow TDD principles
2. **Maintain coverage** - Ensure new code is well-tested
3. **Update documentation** - Keep this guide current
4. **Run full suite** - Verify no regressions before committing

### Test Contribution Guidelines

- Add unit tests for new core functionality
- Add integration tests for new module interactions
- Add performance tests for operations handling large data
- Add UI tests for new interface features
- Update coverage thresholds if necessary

## Resources

- [Node.js Test Runner](https://nodejs.org/api/test.html)
- [Puppeteer Documentation](https://pptr.dev/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Coverage Best Practices](https://testing.googleblog.com/2020/08/code-coverage-best-practices.html)

## Support

For testing-related questions:

1. Check this documentation
2. Review existing test examples
3. Run `npm run test:all -- --help` for CLI options
4. Check GitHub Actions logs for CI failures
5. Open an issue with test output and environment details