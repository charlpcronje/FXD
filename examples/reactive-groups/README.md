# Reactive Groups Example

**Location:** `examples/reactive-groups/`
**Difficulty:** Intermediate-Advanced
**Time:** 20 minutes

## Overview

This example demonstrates FXD's reactive group system. Groups are collections of nodes that can:
- Automatically update when members change
- Be composed using CSS selectors
- Trigger events on changes
- Perform aggregate calculations
- Maintain ordered membership

## What You'll Learn

1. **Manual Groups**: Creating ordered collections with add/remove
2. **CSS Composition**: Using include/exclude for dynamic membership
3. **Hybrid Groups**: Combining manual and selector-based members
4. **Group Operations**: sum, average, max, min, sort
5. **Reactivity**: How groups respond to member changes
6. **Event System**: Listening for group changes and conditions

## Running the Example

```bash
deno run -A examples/reactive-groups/demo.ts
```

## Expected Output

You'll see:
- Manual group creation and manipulation
- Ordered member insertion (addAfter)
- CSS-based group composition
- Include/exclude patterns
- Aggregate calculations
- Change event notifications
- Conditional event triggers

## Key Concepts

### Creating Groups

```typescript
// Manual group
const team = $$("teams.core").group();
team.add($$("users.alice"));
team.add($$("users.bob"));

// CSS-based group
const products = $$("groups.products").group();
products.include('.product[category=electronics]');

// Hybrid group
const featured = $$("groups.featured").group();
featured.add($$("products.laptop"));  // Manual
featured.include('.product[featured=true]');  // CSS
```

### Manual Membership

Groups support ordered membership with these methods:

```typescript
const group = $$("mygroup").group();

// Add to end
group.add($$("item1"));

// Add to beginning
group.prepend($$("item0"));

// Insert at position
group.insert(2, $$("item2"));

// Add after existing member
group.addAfter($$("item1"), $$("item1b"));

// Add before existing member
group.addBefore($$("item2"), $$("item1c"));

// Remove member
group.remove($$("item0"));

// Clear all
group.clear();
```

### CSS Composition

Groups can include/exclude members using selectors:

```typescript
const group = $$("mygroup").group();

// Include matching nodes
group.include('.product');
group.include('[category=electronics]');

// Exclude matching nodes
group.exclude('[discontinued=true]');

// Remove a selector
group.removeSelector('.product');

// Clear selectors
group.clearSelectors("include");  // Clear includes
group.clearSelectors("exclude");  // Clear excludes
group.clearSelectors("all");      // Clear all
```

### Group Operations

Once you have a group, perform calculations:

```typescript
const scores = $$("scores").group();
// ... add members ...

scores.sum();       // Total of all values
scores.average();   // Mean value
scores.max();       // Maximum value
scores.min();       // Minimum value
scores.sort("asc"); // Sorted array (asc/desc)
scores.concat();    // Concatenate as string
scores.hasValue(x); // Check if value exists
scores.same();      // Check if all values are equal
```

### Event System

Groups emit events and support conditional triggers:

```typescript
const group = $$("mygroup").group();

// Basic change event
group.on("change", () => {
    console.log("Group changed!");
});

// Conditional average trigger
group.on("average", {
    greaterThan: 50,
    callback: (g, avg) => {
        console.log(`Average ${avg} exceeded threshold!`);
    }
});

// Has value trigger
group.on("has", {
    value: 100,
    callback: (g) => {
        console.log("Group contains 100!");
    }
});
```

### Reactivity

Groups are reactive by default:
- Changes to member values trigger "change" events
- Adding/removing members triggers "change" events
- Conditional triggers are evaluated on every change

```typescript
const group = $$("temps").group();
$$("temp1").val(20);
group.add($$("temp1"));

group.on("change", () => {
    console.log("Changed!");
});

$$("temp1").val(25);  // Triggers "change" event
```

## Use Cases

### Dashboard Metrics
```typescript
const activeUsers = $$("metrics.active").group();
activeUsers.include('.user[status=active]');

activeUsers.on("change", () => {
    updateDashboard("Active Users", activeUsers.list().length);
});
```

### Score Tracking
```typescript
const testScores = $$("scores.final").group();
testScores.include('[type=final-exam]');

testScores.on("average", {
    lessThan: 60,
    callback: (g, avg) => {
        sendAlert(`Class average (${avg}) below passing!`);
    }
});
```

### Inventory Management
```typescript
const lowStock = $$("inventory.low").group();
lowStock.include('.product');
lowStock.exclude('[stock>10]');

lowStock.on("change", () => {
    console.log("Low stock items:", lowStock.list().length);
});
```

### Feature Flags
```typescript
const enabledFeatures = $$("features.enabled").group();
enabledFeatures.include('[enabled=true]');

if (enabledFeatures.hasValue("new-ui")) {
    loadNewUI();
}
```

## Configuration Options

Groups can be configured:

```typescript
const group = $$("mygroup").group();

// Set mode
group.options({ mode: "set" });   // Unique members only
group.options({ mode: "list" });  // Allow duplicates

// Control reactivity
group.reactive(true);   // Enable (default)
group.reactive(false);  // Disable

// Set debounce
group.debounce(50);  // Wait 50ms before reconciling
```

## Next Steps

After mastering reactive-groups, try:
- **import-export-workflow**: Export group contents
- Combine with selector-demo for complex queries
- Build real-time dashboards with group metrics

## Files

- `demo.ts` - The runnable example
- `README.md` - This documentation

## Related Modules

- `fxn.ts` - Core Group class and wrapGroup helper
- `modules/fx-group-extras.ts` - Additional group utilities
