# Installation & Setup

## Prerequisites

### Deno (Recommended)
```bash
# Install Deno (if not already installed)
curl -fsSL https://deno.land/install.sh | sh

# Verify installation
deno --version
```

### Node.js (Alternative)
```bash
# Requires Node.js 20+ and npm
node --version
npm --version
```

## Installation

### Option 1: Clone Repository
```bash
# Clone the FXD repository
git clone https://github.com/yourusername/fxd.git
cd fxd

# Run the demo
deno run -A server/fxd-demo-simple.ts
```

### Option 2: Import as Module
```typescript
// In your Deno project
import { fx, $$, $_$$ } from "https://raw.githubusercontent.com/yourusername/fxd/main/fx.ts";
import { createSnippet } from "https://raw.githubusercontent.com/yourusername/fxd/main/modules/fx-snippets.ts";
import { renderView } from "https://raw.githubusercontent.com/yourusername/fxd/main/modules/fx-view.ts";
```

## Project Setup

### 1. Create Project Structure
```bash
mkdir my-fxd-project
cd my-fxd-project

# Create basic structure
mkdir modules
mkdir snippets
mkdir views
```

### 2. Initialize FX
```typescript
// main.ts
import { fx, $$, $_$$ } from "./fx.ts";

// Expose globals (optional but convenient)
Object.assign(globalThis, { fx, $$, $_$$ });

// Initialize FXD modules
import { createSnippet } from "./modules/fx-snippets.ts";
import { renderView } from "./modules/fx-view.ts";
import fxFsFuse from "./plugins/fx-fs-fuse.ts";

console.log("FXD initialized successfully!");
```

### 3. Configure FX
```typescript
// Set configuration
$$("config.fx.selectors.attrResolution").val(["meta", "type", "raw", "child"]);
$$("config.fx.selectors.classMatchesType").val(true);
$$("config.fx.groups.reactiveDefault").val(true);
$$("config.fx.groups.debounceMs").val(20);
```

## Environment Configuration

### Deno Permissions
FXD requires the following Deno permissions:
- `--allow-read`: Read files and configuration
- `--allow-write`: Write generated files
- `--allow-net`: Run HTTP server (optional)

Use `-A` for all permissions during development:
```bash
deno run -A main.ts
```

### Environment Variables
```bash
# Optional: Disable FX server
export FX_SERVE=false

# Optional: Set working directory
export FXD_ROOT=/path/to/project
```

## Verification

### Test Installation
```typescript
// test-install.ts
import { fx, $$ } from "./fx.ts";
import { createSnippet } from "./modules/fx-snippets.ts";

// Test basic FX functionality
$$("test.value").val("Hello FXD");
console.log("FX test:", $$("test.value").val());

// Test snippet creation
createSnippet(
  "test.snippet",
  "console.log('FXD works!');",
  { lang: "js", file: "test.js", id: "test-001" }
);
console.log("Snippet created successfully");

// If no errors, installation is complete!
```

Run the test:
```bash
deno run -A test-install.ts
```

## Troubleshooting

### Common Issues

#### 1. "Cannot access '$_$$' before initialization"
**Solution**: FX has a circular dependency issue. Ensure you're not using `$_$$` during FX initialization.

#### 2. "Classic workers are not supported"
**Solution**: This is expected in Deno. FX automatically disables workers in Deno environments.

#### 3. "Cannot find module"
**Solution**: Ensure all import paths are correct. Use absolute paths or proper relative paths.

#### 4. Permission Denied
**Solution**: Add required Deno permissions or use `-A` flag.

### Debug Mode
Enable debug logging:
```typescript
$$("config.fx.debug").val(true);
```

## Next Steps

- Follow the [Quick Start Guide](quickstart.md) to build your first FXD project
- Read [Core Concepts](concepts.md) to understand the architecture
- Explore the [API Reference](api-snippets.md) for detailed documentation