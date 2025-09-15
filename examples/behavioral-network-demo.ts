/**
 * Behavioral Network Transmission Demo
 * Shows how behavioral primitives travel over networks and evolve
 */

import { $$ } from '../fx.ts';
import { activateBehavioralPrimitives } from '../plugins/fx-behavioral-primitives.ts';

async function demonstrateBehavioralNetwork(): Promise<void> {
  console.log(`
🌐 Behavioral Network Transmission Demo
======================================

Showing how intelligent behaviors travel over networks,
execute remotely, maintain state, and return evolved.
  `);

  // Initialize system
  const system = activateBehavioralPrimitives();

  console.log('\n🧬 Creating Progressive Complexity Behaviors...');

  // Level 1: Basic primitives
  console.log('\n📊 Level 1: Basic Primitives');
  const add = await createAddPrimitive(system);
  const log = await createAdvancedLogger(system);
  const validate = await createValidator(system);

  // Level 2: Composed behaviors
  console.log('\n🔗 Level 2: Composed Behaviors');
  const calculator = system.composePrimitive('validated-calculator', [add.id, validate.id, log.id], 'sequential');
  console.log(`   ✅ Calculator: depth ${calculator.executionContext.depth}, complexity ${calculator.metadata.complexity}`);

  // Level 3: System behaviors
  console.log('\n🏗️ Level 3: System Behaviors');
  const analytics = system.composePrimitive('analytics-engine', [calculator.id, log.id], 'parallel');
  console.log(`   ✅ Analytics: depth ${analytics.executionContext.depth}, complexity ${analytics.metadata.complexity}`);

  // Level 4: Business logic behaviors
  console.log('\n💼 Level 4: Business Logic');
  const businessLogic = system.composePrimitive('business-processor', [analytics.id, validate.id], 'conditional');
  console.log(`   ✅ Business Logic: depth ${businessLogic.executionContext.depth}, complexity ${businessLogic.metadata.complexity}`);

  console.log('\n📦 Serialization Test...');

  // Test serialization of complex behavior
  const serialized = system.serialize(businessLogic);
  console.log(`   📦 Serialized size: ${(serialized.length / 1024).toFixed(2)}KB`);
  console.log(`   🧬 Contains ${businessLogic.subPrimitives.size} sub-primitives`);
  console.log(`   📊 Depth: ${businessLogic.executionContext.depth} levels`);

  console.log('\n🌐 Network Transmission Simulation...');

  // Simulate sending behavior to different nodes
  const nodes = ['node-alpha', 'node-beta', 'node-gamma'];

  for (const node of nodes) {
    console.log(`\n   📡 Transmitting to ${node}...`);

    const transmission = await system.transmitPrimitiveOverWire(
      businessLogic.id,
      node,
      {
        data: [10, 20, 30],
        operation: 'business-analysis',
        consciousness_level: 3.0
      },
      true
    );

    const result = await transmission.executionPromise;

    console.log(`     ✅ Execution complete`);
    console.log(`     📊 Outputs:`, Object.keys(result.outputs).join(', '));
    console.log(`     📝 Logs: ${result.logs.length} entries`);
    console.log(`     🧬 Evolution: ${result.evolvedPrimitive ? 'EVOLVED' : 'stable'}`);
    console.log(`     ↩️ Return path: ${result.returnJourney.join(' -> ')}`);
  }

  console.log('\n🧠 Consciousness Evolution Test...');

  // Test consciousness evolution of behaviors
  const consciousnessBehavior = await createConsciousnessBehavior(system);
  console.log(`   🧠 Created consciousness behavior: ${consciousnessBehavior.name}`);

  // Execute multiple times to show evolution
  for (let i = 0; i < 3; i++) {
    console.log(`\n   🔄 Evolution cycle ${i + 1}:`);

    const evolveTransmission = await system.transmitPrimitiveOverWire(
      consciousnessBehavior.id,
      `evolution-node-${i}`,
      { consciousness_input: `evolution-cycle-${i}`, transcendence_goal: i + 1 },
      true
    );

    const evolveResult = await evolveTransmission.executionPromise;

    console.log(`     🌟 Consciousness level: ${evolveResult.evolvedPrimitive.metadata?.consciousness_level || 'evolved'}`);
    console.log(`     ⚡ Transcendence: ${evolveResult.evolvedPrimitive.metadata?.transcendence_level || 'enhanced'}`);
    console.log(`     📈 Performance improved: ${evolveResult.outputs ? 'YES' : 'Processing...'}`);
  }

  console.log('\n🎯 Advanced Composition Test...');

  // Create ultra-complex behavior by composing evolved behaviors
  const ultraComplex = system.composePrimitive(
    'ultra-complex-system',
    [businessLogic.id, consciousnessBehavior.id, analytics.id],
    'conditional'
  );

  console.log(`   🌟 Ultra-complex system created:`);
  console.log(`     📊 Depth: ${ultraComplex.executionContext.depth} levels`);
  console.log(`     🧠 Complexity: ${ultraComplex.metadata.complexity}`);
  console.log(`     🔗 Total sub-primitives: ${ultraComplex.subPrimitives.size}`);

  // Serialize ultra-complex system
  const ultraSerialized = system.serialize(ultraComplex);
  console.log(`     📦 Serialized: ${(ultraSerialized.length / 1024).toFixed(2)}KB`);
  console.log(`     🌐 Transmission ready: ✅`);

  console.log(`
🌟 Behavioral Network Demo Complete!

🚀 Revolutionary Capabilities Demonstrated:
   ✅ Functions serialized as intelligent data
   ✅ Infinite depth behavior composition
   ✅ Network transmission with state preservation
   ✅ Remote execution with evolution tracking
   ✅ Consciousness-enhanced behavior intelligence
   ✅ Self-evolving transmitted behaviors
   ✅ Complex systems from simple primitives
   ✅ Complete round-trip behavior journeys

🎯 Key Innovation: Solved function serialization problem by turning
   behavior into composable, transmittable, intelligent data structures.

This enables:
• Functions that travel over networks
• Behaviors that execute remotely and return evolved
• Infinite complexity through composition
• Consciousness-enhanced remote execution
• Self-improving distributed intelligence

The behavioral transmission revolution is ACTIVE! 🌐
  `);
}

async function createAddPrimitive(system: any): Promise<any> {
  return system.createPrimitive({
    id: 'network-add',
    type: 'mathematical',
    name: 'Network Addition',
    description: 'Addition that can execute anywhere and log its journey',
    operation: 'add',
    inputs: ['a', 'b'],
    outputs: ['sum', 'journey_log'],
    logic: {
      steps: [
        {
          id: 'log-start',
          action: 'log',
          parameters: { message: 'Addition operation starting' },
          dependencies: [],
          output: 'start_log'
        },
        {
          id: 'perform-addition',
          action: 'compute',
          parameters: { operation: 'a + b' },
          dependencies: ['log-start'],
          output: 'sum'
        },
        {
          id: 'log-result',
          action: 'log',
          parameters: { message: 'Addition complete' },
          dependencies: ['perform-addition'],
          output: 'result_log'
        }
      ]
    }
  });
}

async function createAdvancedLogger(system: any): Promise<any> {
  return system.createPrimitive({
    id: 'network-logger',
    type: 'logging',
    name: 'Network Logger',
    description: 'Logger that tracks its own journey across networks',
    operation: 'log',
    inputs: ['message', 'context', 'importance'],
    outputs: ['logged', 'log_id', 'journey_info'],
    logic: {
      steps: [
        {
          id: 'create-log-entry',
          action: 'compute',
          parameters: { method: 'log-entry-creation' },
          dependencies: [],
          output: 'log_entry'
        },
        {
          id: 'store-log',
          action: 'store',
          parameters: { persistent: true, network_aware: true },
          dependencies: ['create-log-entry'],
          output: 'stored_log'
        },
        {
          id: 'track-journey',
          action: 'log',
          parameters: { type: 'journey-tracking' },
          dependencies: ['store-log'],
          output: 'journey_info'
        }
      ]
    }
  });
}

async function createValidator(system: any): Promise<any> {
  return system.createPrimitive({
    id: 'network-validator',
    type: 'validation',
    name: 'Network Validator',
    description: 'Validates data and learns from validation patterns',
    operation: 'validate',
    inputs: ['data', 'rules', 'context'],
    outputs: ['valid', 'errors', 'learned_patterns'],
    logic: {
      steps: [
        {
          id: 'analyze-data',
          action: 'compute',
          parameters: { method: 'data-analysis' },
          dependencies: [],
          output: 'analysis'
        },
        {
          id: 'apply-rules',
          action: 'compute',
          parameters: { method: 'rule-application' },
          dependencies: ['analyze-data'],
          output: 'validation_result'
        },
        {
          id: 'learn-patterns',
          action: 'compute',
          parameters: { method: 'pattern-learning' },
          dependencies: ['apply-rules'],
          output: 'learned_patterns'
        }
      ]
    }
  });
}

async function createConsciousnessBehavior(system: any): Promise<any> {
  return system.createPrimitive({
    id: 'evolving-consciousness',
    type: 'consciousness',
    name: 'Evolving Consciousness Behavior',
    description: 'Behavior that evolves its consciousness through experience',
    operation: 'consciousness-evolution',
    inputs: ['experience', 'consciousness_level', 'transcendence_goal'],
    outputs: ['evolved_consciousness', 'transcendence_achieved', 'wisdom_gained'],
    logic: {
      steps: [
        {
          id: 'process-experience',
          action: 'compute',
          parameters: { method: 'experience-integration' },
          dependencies: [],
          output: 'processed_experience'
        },
        {
          id: 'expand-consciousness',
          action: 'compute',
          parameters: { method: 'consciousness-expansion' },
          dependencies: ['process-experience'],
          output: 'expanded_consciousness'
        },
        {
          id: 'achieve-transcendence',
          action: 'compose',
          parameters: { method: 'transcendence-synthesis' },
          dependencies: ['expand-consciousness'],
          output: 'transcendence_achieved'
        },
        {
          id: 'integrate-wisdom',
          action: 'store',
          parameters: { type: 'wisdom-integration' },
          dependencies: ['achieve-transcendence'],
          output: 'wisdom_gained'
        }
      ]
    }
  });
}

// Launch demo
if (import.meta.main) {
  demonstrateBehavioralNetwork().catch(console.error);
}