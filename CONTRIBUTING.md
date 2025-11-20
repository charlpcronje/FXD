# Contributing to FXD

Thank you for your interest in contributing to FXD! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Development Setup](#development-setup)
- [Running Tests](#running-tests)
- [Code Style](#code-style)
- [Project Structure](#project-structure)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)
- [Development Workflow](#development-workflow)

## Development Setup

### Prerequisites

FXD is built with Deno. You'll need:

- **Deno** v1.30 or higher ([installation guide](https://deno.land/#installation))
- **Git** for version control
- **SQLite3** (optional, for inspecting .fxd files)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/fxd.git
   cd fxd
   ```

2. Verify installation by running tests:
   ```bash
   deno run -A test/run-all-tests.ts
   ```

3. Expected output:
   ```
   ✅ All 6 test files passing
   ✅ 165 test steps passing
   ✅ 100% pass rate
   ```

### Quick Start

Try the examples to understand how FXD works:

```bash
# Round-trip editing demo
deno run -A examples/repo-js/demo.ts

# Snippet management
deno run -A examples/snippet-management/demo.ts

# Persistence (save/load)
deno run -A examples/persistence-demo.ts
```

## Running Tests

### All Tests

Run the complete test suite:

```bash
deno run -A test/run-all-tests.ts
```

This runs all 6 test files (165 test steps) and provides a summary report.

### Individual Test Modules

Test specific functionality:

```bash
# Snippet tests (31 steps)
deno test -A --no-check test/fx-snippets.test.ts

# Marker tests (36 steps)
deno test -A --no-check test/fx-markers.test.ts

# Parse tests (32 steps)
deno test -A --no-check test/fx-parse.test.ts

# View tests (28 steps)
deno test -A --no-check test/fx-view.test.ts

# Round-trip tests (21 steps)
deno test -A --no-check test/round-trip.test.ts

# Persistence tests (17 steps)
deno test -A --no-check test/fx-persistence.test.ts
```

### Test Reports

Test results are saved to `test-results/`:
- `report.json` - JSON format with detailed results
- `*.log` - Per-module test logs

### Writing Tests

When adding new features:

1. **Create a test file** in `test/` directory
2. **Use Deno's built-in test framework**:
   ```typescript
   import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

   Deno.test("feature name - what it does", () => {
     // Arrange
     const input = ...;

     // Act
     const result = ...;

     // Assert
     assertEquals(result, expected);
   });
   ```

3. **Update `test/run-all-tests.ts`** if needed
4. **Verify all tests pass** before submitting PR

## Code Style

### General Guidelines

- **Use TypeScript** - All code should be properly typed
- **Use `fxn.ts`** - Not `fx.ts` (fxn.ts is the current working version)
- **Follow existing patterns** - Look at existing code for examples
- **Add JSDoc comments** for public APIs
- **Keep functions small** - Single responsibility principle

### Formatting

Use Deno's built-in formatter:

```bash
# Check formatting
deno fmt --check

# Auto-format
deno fmt
```

### Linting

Use Deno's built-in linter:

```bash
# Check for issues
deno lint

# Auto-fix where possible
deno lint --fix
```

### File Naming

- **Modules**: `fx-feature-name.ts`
- **Tests**: `fx-feature-name.test.ts`
- **Examples**: `feature-demo.ts`
- **Use kebab-case** for all file names

### Import Guidelines

- **Use absolute imports** from project root
- **Import from `fxn.ts`** (not `fx.ts`)
- **Group imports**:
  1. Standard library
  2. External dependencies
  3. Internal modules
  4. Types

Example:
```typescript
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";
import { $$, $_$$ } from "./fxn.ts";
import { createSnippet } from "./modules/fx-snippets.ts";
```

## Project Structure

```
fxd/
├── fxn.ts                    # Core FX framework (use this, not fx.ts)
├── fxd-cli.ts                # CLI entry point
├── modules/                  # Feature modules
│   ├── fx-snippets.ts        # Snippet management
│   ├── fx-view.ts            # View rendering
│   ├── fx-parse.ts           # Round-trip parsing
│   ├── fx-group-extras.ts    # Group operations
│   ├── fx-persistence.ts     # Core persistence engine
│   └── fx-persistence-deno.ts # Deno SQLite adapter
├── test/                     # Test files
│   ├── run-all-tests.ts      # Test runner
│   └── *.test.ts             # Individual test modules
├── examples/                 # Working examples
│   ├── repo-js/              # Round-trip demo
│   ├── snippet-management/   # Snippet API demo
│   └── persistence-demo.ts   # Save/load demo
├── docs/                     # Documentation
│   ├── archive/              # Historical reports
│   └── vision/               # Future plans
├── README.md                 # Main documentation
├── CHANGELOG.md              # Version history
└── CONTRIBUTING.md           # This file
```

## Pull Request Process

### Before You Start

1. **Check existing issues** - Someone might already be working on it
2. **Create an issue** - Discuss major changes before implementing
3. **Fork the repository** - Work in your own fork

### Development Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Write code
   - Add tests
   - Update documentation

3. **Verify everything works**:
   ```bash
   # Run all tests
   deno run -A test/run-all-tests.ts

   # Format code
   deno fmt

   # Lint code
   deno lint

   # Test examples
   deno run -A examples/repo-js/demo.ts
   ```

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

   Use conventional commit messages:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `test:` - Test additions/changes
   - `refactor:` - Code refactoring
   - `perf:` - Performance improvements
   - `chore:` - Maintenance tasks

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**:
   - Go to GitHub
   - Create PR from your branch to `main`
   - Fill out the PR template
   - Link any related issues

### PR Requirements

Your PR must:

- ✅ **Pass all tests** (165/165 steps)
- ✅ **Include new tests** for new features
- ✅ **Update documentation** if needed
- ✅ **Follow code style** (pass `deno fmt` and `deno lint`)
- ✅ **Have a clear description** of what and why
- ✅ **Reference related issues** if applicable

### Review Process

1. **Automated checks** will run (tests, formatting, linting)
2. **Maintainers will review** your code
3. **Address feedback** if requested
4. **Squash commits** if needed
5. **Merge** once approved

## Reporting Issues

### Bug Reports

When reporting bugs, include:

1. **Clear title** - Describe the issue briefly
2. **Environment**:
   - Deno version (`deno --version`)
   - OS and version
   - FXD version
3. **Steps to reproduce**:
   ```
   1. Run command X
   2. Do action Y
   3. See error Z
   ```
4. **Expected behavior** - What should happen
5. **Actual behavior** - What actually happens
6. **Error messages** - Full error output
7. **Code sample** - Minimal reproduction if possible

### Feature Requests

When requesting features, include:

1. **Clear description** - What feature you want
2. **Use case** - Why you need it
3. **Examples** - How you'd use it
4. **Alternatives** - Other solutions you've considered

## Development Workflow

### High Priority Areas

Current focus areas for contributions:

1. **CLI Integration** - Wire persistence to CLI commands
2. **Group Persistence** - Save/load group configurations
3. **Performance** - Optimize for large graphs (10k+ nodes)
4. **Documentation** - API reference, guides, tutorials
5. **Examples** - More real-world usage examples

### Medium Priority

6. File watcher integration
7. Web visualizer
8. Git import/export
9. VS Code extension

### Testing Philosophy

- **Every feature needs tests** - No exceptions
- **Test edge cases** - Empty inputs, large inputs, invalid inputs
- **Test integration** - Not just units
- **Keep tests fast** - Aim for <10 seconds full suite

### Documentation Standards

- **Update README.md** if user-facing changes
- **Add JSDoc comments** for public APIs
- **Create examples** for new features
- **Update CHANGELOG.md** for releases

## Getting Help

- **Discord**: [Join our community](#) (coming soon)
- **GitHub Discussions**: Ask questions, share ideas
- **GitHub Issues**: Report bugs, request features
- **Documentation**: Check `docs/` directory

## Code of Conduct

- Be respectful and professional
- Welcome newcomers
- Focus on what's best for the project
- Accept constructive criticism gracefully

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Credited in release notes
- Mentioned in documentation

Thank you for contributing to FXD!

---

**Questions?** Open an issue or discussion on GitHub.
