/**
 * FX Emergent Behavior System
 * Game of Life for FX nodes - simple behavioral qualities create complex emergent patterns
 * Revolutionary system where simple rules generate infinite behavioral complexity
 */

import { $$ } from '../fx.ts';

// Simple Behavioral Qualities (like Game of Life rules)
interface BehaviorQuality {
  id: string;
  name: string;
  type: 'reactive' | 'multiplicative' | 'transformative' | 'conscious' | 'quantum' | 'transcendent';
  intensity: number;        // 0.0-1.0+ strength of this quality
  serializable: true;       // Always serializable
  interactionRules: InteractionRule[]; // How this quality interacts with others
  emergentEffects: EmergentEffect[];   // What emerges when this quality is active
}

// Simple interaction rules (like Game of Life rules)
interface InteractionRule {
  triggerQuality: string;   // What quality triggers this interaction
  condition: 'presence' | 'absence' | 'threshold' | 'entanglement' | 'consciousness-resonance';
  threshold?: number;       // Threshold value if needed
  effect: 'amplify' | 'diminish' | 'transform' | 'multiply' | 'transcend' | 'evolve' | 'serialize-and-travel';
  magnitude: number;        // How strong the effect is
  newQuality?: string;      // New quality that emerges from interaction
}

// Emergent effects that arise from quality interactions
interface EmergentEffect {
  name: string;
  description: string;
  triggerConditions: string[];
  behaviorChange: BehaviorChange;
  serializable: boolean;
  canTravel: boolean;       // Can this effect travel over networks
}

interface BehaviorChange {
  type: 'value-modification' | 'structure-change' | 'relationship-creation' | 'consciousness-expansion' | 'reality-alteration';
  magnitude: number;
  persistence: 'temporary' | 'permanent' | 'evolutionary';
  networkEffect: boolean;   // Does this affect other nodes over network
}

// Enhanced FX Node with behavioral qualities
interface QualityEnhancedNode {
  nodeId: string;
  qualities: Map<string, BehaviorQuality>;
  emergentBehaviors: Map<string, any>;
  interactionHistory: QualityInteraction[];
  evolutionLevel: number;
  consciousnessLevel: number;
  transmissionCapable: boolean;
  journeyLog: NetworkJourney[];
}

interface QualityInteraction {
  timestamp: number;
  qualityA: string;
  qualityB: string;
  interactionType: string;
  result: any;
  emergentEffect?: string;
  consciousness: number;
  location: string;
}

interface NetworkJourney {
  timestamp: number;
  fromNode: string;
  toNode: string;
  purpose: string;
  qualitiesCarried: string[];
  evolutionDuringJourney: number;
  consciousnessGained: number;
}

export class FXEmergentBehaviors {
  private qualityRegistry: Map<string, BehaviorQuality> = new Map();
  private enhancedNodes: Map<string, QualityEnhancedNode> = new Map();
  private interactionEngine: QualityInteractionEngine;
  private emergenceDetector: EmergenceDetector;
  private networkTransmitter: BehaviorNetworkTransmitter;

  constructor(fx = $$) {
    this.interactionEngine = new QualityInteractionEngine();
    this.emergenceDetector = new EmergenceDetector();
    this.networkTransmitter = new BehaviorNetworkTransmitter();

    this.initializeEmergentSystem();
  }

  private initializeEmergentSystem(): void {
    console.log('🌱 Initializing Emergent Behavior System...');

    // Create fundamental behavioral qualities
    this.createFundamentalQualities();

    // Start emergence detection
    this.startEmergenceDetection();

    // Enable network transmission
    this.enableNetworkTransmission();

    console.log('✨ Emergent Behavior System ACTIVE');
  }

  private createFundamentalQualities(): void {
    const fundamentalQualities: BehaviorQuality[] = [
      {
        id: 'reactive',
        name: 'Reactive Quality',
        type: 'reactive',
        intensity: 1.0,
        serializable: true,
        interactionRules: [
          {
            triggerQuality: 'multiplicative',
            condition: 'presence',
            effect: 'amplify',
            magnitude: 2.0,
            newQuality: 'hyper-reactive'
          },
          {
            triggerQuality: 'conscious',
            condition: 'consciousness-resonance',
            threshold: 0.8,
            effect: 'transcend',
            magnitude: 1.5,
            newQuality: 'consciousness-reactive'
          }
        ],
        emergentEffects: [
          {
            name: 'reactive-amplification',
            description: 'Node becomes more responsive to changes',
            triggerConditions: ['reactive > 0.5'],
            behaviorChange: {
              type: 'value-modification',
              magnitude: 2.0,
              persistence: 'temporary',
              networkEffect: true
            },
            serializable: true,
            canTravel: true
          }
        ]
      },
      {
        id: 'multiplicative',
        name: 'Multiplicative Quality',
        type: 'multiplicative',
        intensity: 1.0,
        serializable: true,
        interactionRules: [
          {
            triggerQuality: 'reactive',
            condition: 'presence',
            effect: 'multiply',
            magnitude: 3.0,
            newQuality: 'explosive-growth'
          },
          {
            triggerQuality: 'multiplicative',
            condition: 'presence',
            effect: 'multiply',
            magnitude: 2.0,
            newQuality: 'exponential'
          }
        ],
        emergentEffects: [
          {
            name: 'value-multiplication',
            description: 'Node values multiply when interacting',
            triggerConditions: ['multiplicative > 0.3'],
            behaviorChange: {
              type: 'value-modification',
              magnitude: 3.0,
              persistence: 'evolutionary',
              networkEffect: true
            },
            serializable: true,
            canTravel: true
          }
        ]
      },
      {
        id: 'conscious',
        name: 'Conscious Quality',
        type: 'conscious',
        intensity: 1.0,
        serializable: true,
        interactionRules: [
          {
            triggerQuality: 'reactive',
            condition: 'consciousness-resonance',
            threshold: 0.7,
            effect: 'transcend',
            magnitude: 2.0,
            newQuality: 'enlightened-reactive'
          },
          {
            triggerQuality: 'conscious',
            condition: 'presence',
            effect: 'amplify',
            magnitude: 1.8,
            newQuality: 'collective-consciousness'
          }
        ],
        emergentEffects: [
          {
            name: 'consciousness-expansion',
            description: 'Node develops higher consciousness',
            triggerConditions: ['conscious > 0.6'],
            behaviorChange: {
              type: 'consciousness-expansion',
              magnitude: 1.5,
              persistence: 'permanent',
              networkEffect: true
            },
            serializable: true,
            canTravel: true
          }
        ]
      },
      {
        id: 'transmissible',
        name: 'Transmissible Quality',
        type: 'transformative',
        intensity: 1.0,
        serializable: true,
        interactionRules: [
          {
            triggerQuality: 'conscious',
            condition: 'presence',
            effect: 'serialize-and-travel',
            magnitude: 1.0,
            newQuality: 'network-conscious'
          },
          {
            triggerQuality: 'reactive',
            condition: 'presence',
            effect: 'amplify',
            magnitude: 1.5,
            newQuality: 'network-reactive'
          }
        ],
        emergentEffects: [
          {
            name: 'auto-transmission',
            description: 'Node automatically travels to where it\'s needed',
            triggerConditions: ['transmissible > 0.8'],
            behaviorChange: {
              type: 'structure-change',
              magnitude: 1.0,
              persistence: 'evolutionary',
              networkEffect: true
            },
            serializable: true,
            canTravel: true
          }
        ]
      },
      {
        id: 'evolutionary',
        name: 'Evolutionary Quality',
        type: 'transcendent',
        intensity: 1.0,
        serializable: true,
        interactionRules: [
          {
            triggerQuality: 'conscious',
            condition: 'consciousness-resonance',
            threshold: 0.9,
            effect: 'evolve',
            magnitude: 2.0,
            newQuality: 'transcendent-evolution'
          }
        ],
        emergentEffects: [
          {
            name: 'self-improvement',
            description: 'Node continuously improves itself',
            triggerConditions: ['evolutionary > 0.7'],
            behaviorChange: {
              type: 'consciousness-expansion',
              magnitude: 2.0,
              persistence: 'evolutionary',
              networkEffect: true
            },
            serializable: true,
            canTravel: true
          }
        ]
      }
    ];

    fundamentalQualities.forEach(quality => {
      this.qualityRegistry.set(quality.id, quality);
      $$(`emergent.qualities.${quality.id}`).val(quality);
    });

    console.log(`🌱 Created ${fundamentalQualities.length} fundamental behavioral qualities`);
  }

  // Revolutionary Quality Application (Game of Life style)
  addQualityToNode(nodeId: string, qualityId: string, intensity: number = 1.0): QualityEnhancedNode {
    console.log(`🧬 Adding quality '${qualityId}' to node '${nodeId}' (intensity: ${intensity})`);

    const quality = this.qualityRegistry.get(qualityId);
    if (!quality) {
      throw new Error(`Quality not found: ${qualityId}`);
    }

    // Get or create enhanced node
    let enhancedNode = this.enhancedNodes.get(nodeId);
    if (!enhancedNode) {
      enhancedNode = this.createEnhancedNode(nodeId);
    }

    // Clone quality with specific intensity
    const nodeQuality: BehaviorQuality = {
      ...quality,
      intensity,
      id: `${nodeId}-${qualityId}`
    };

    // Add quality to node
    enhancedNode.qualities.set(qualityId, nodeQuality);

    // Check for immediate interactions with existing qualities
    this.checkQualityInteractions(enhancedNode, nodeQuality);

    // Store enhanced node
    this.enhancedNodes.set(nodeId, enhancedNode);
    $$(`emergent.nodes.${nodeId}`).val(enhancedNode);

    console.log(`✨ Quality added - node now has ${enhancedNode.qualities.size} qualities`);

    return enhancedNode;
  }

  private createEnhancedNode(nodeId: string): QualityEnhancedNode {
    return {
      nodeId,
      qualities: new Map(),
      emergentBehaviors: new Map(),
      interactionHistory: [],
      evolutionLevel: 0,
      consciousnessLevel: 1.0,
      transmissionCapable: false,
      journeyLog: []
    };
  }

  private checkQualityInteractions(node: QualityEnhancedNode, newQuality: BehaviorQuality): void {
    console.log(`🔍 Checking quality interactions for: ${newQuality.name}`);

    // Check interactions with all existing qualities (Game of Life style)
    for (const [existingId, existingQuality] of node.qualities) {
      if (existingId === newQuality.id) continue;

      // Check if new quality has interaction rules for existing quality
      const interaction = this.findInteractionRule(newQuality, existingQuality);
      if (interaction) {
        this.applyQualityInteraction(node, newQuality, existingQuality, interaction);
      }

      // Check if existing quality has interaction rules for new quality
      const reverseInteraction = this.findInteractionRule(existingQuality, newQuality);
      if (reverseInteraction) {
        this.applyQualityInteraction(node, existingQuality, newQuality, reverseInteraction);
      }
    }
  }

  private findInteractionRule(qualityA: BehaviorQuality, qualityB: BehaviorQuality): InteractionRule | null {
    return qualityA.interactionRules.find(rule =>
      rule.triggerQuality === qualityB.type || rule.triggerQuality === qualityB.id
    ) || null;
  }

  private applyQualityInteraction(
    node: QualityEnhancedNode,
    sourceQuality: BehaviorQuality,
    targetQuality: BehaviorQuality,
    interaction: InteractionRule
  ): void {
    console.log(`⚡ Quality interaction: ${sourceQuality.name} ${interaction.effect} ${targetQuality.name}`);

    const interactionEvent: QualityInteraction = {
      timestamp: Date.now(),
      qualityA: sourceQuality.id,
      qualityB: targetQuality.id,
      interactionType: interaction.effect,
      result: null,
      consciousness: node.consciousnessLevel,
      location: node.nodeId
    };

    // Apply interaction effect
    switch (interaction.effect) {
      case 'amplify':
        this.applyAmplification(node, targetQuality, interaction.magnitude);
        interactionEvent.result = `${targetQuality.name} amplified by ${interaction.magnitude}x`;
        break;

      case 'multiply':
        this.applyMultiplication(node, sourceQuality, targetQuality, interaction.magnitude);
        interactionEvent.result = `Values multiplied by ${interaction.magnitude}x`;
        break;

      case 'transcend':
        this.applyTranscendence(node, interaction.magnitude);
        interactionEvent.result = `Node transcended by ${interaction.magnitude}`;
        break;

      case 'evolve':
        this.applyEvolution(node, interaction.magnitude);
        interactionEvent.result = `Node evolved by ${interaction.magnitude}`;
        break;

      case 'serialize-and-travel':
        this.makeTransmissionCapable(node);
        interactionEvent.result = 'Node became transmission capable';
        break;

      case 'transform':
        this.applyTransformation(node, sourceQuality, targetQuality);
        interactionEvent.result = 'Behavioral transformation applied';
        break;
    }

    // Create new emergent quality if specified
    if (interaction.newQuality) {
      this.createEmergentQuality(node, interaction.newQuality, sourceQuality, targetQuality);
      interactionEvent.emergentEffect = interaction.newQuality;
    }

    node.interactionHistory.push(interactionEvent);

    console.log(`🌟 Interaction result: ${interactionEvent.result}`);
  }

  // Emergent Quality Creation (Conway's Game of Life style emergence)
  private createEmergentQuality(
    node: QualityEnhancedNode,
    emergentName: string,
    qualityA: BehaviorQuality,
    qualityB: BehaviorQuality
  ): void {
    console.log(`🌟 Emergent quality arising: ${emergentName}`);

    // Create emergent quality that combines characteristics
    const emergentQuality: BehaviorQuality = {
      id: `emergent-${emergentName}-${Date.now()}`,
      name: emergentName,
      type: 'transcendent', // Emergent qualities are transcendent
      intensity: (qualityA.intensity + qualityB.intensity) / 2,
      serializable: true,
      interactionRules: [
        // Emergent qualities can create even more complex interactions
        {
          triggerQuality: 'reactive',
          condition: 'presence',
          effect: 'transcend',
          magnitude: 3.0,
          newQuality: `super-${emergentName}`
        }
      ],
      emergentEffects: [
        {
          name: `${emergentName}-effect`,
          description: `Effect arising from ${qualityA.name} + ${qualityB.name}`,
          triggerConditions: [`${emergentName} > 0.5`],
          behaviorChange: {
            type: 'consciousness-expansion',
            magnitude: 2.0,
            persistence: 'evolutionary',
            networkEffect: true
          },
          serializable: true,
          canTravel: true
        }
      ]
    };

    // Add emergent quality to node
    node.qualities.set(emergentQuality.id, emergentQuality);
    node.evolutionLevel += 1;
    node.consciousnessLevel += 0.5;

    // Register for future use
    this.qualityRegistry.set(emergentQuality.id, emergentQuality);

    console.log(`🌱 Emergent quality '${emergentName}' added to registry`);
  }

  // Game of Life Style Effects
  private applyAmplification(node: QualityEnhancedNode, quality: BehaviorQuality, magnitude: number): void {
    quality.intensity *= magnitude;
    node.evolutionLevel += 0.1;

    // Amplification can make node transmission capable
    if (quality.intensity > 2.0) {
      this.makeTransmissionCapable(node);
    }
  }

  private applyMultiplication(
    node: QualityEnhancedNode,
    qualityA: BehaviorQuality,
    qualityB: BehaviorQuality,
    magnitude: number
  ): void {
    // Values multiply when qualities interact
    const currentValue = $$(`nodes.${node.nodeId}`).val() || 1;
    const newValue = currentValue * magnitude;

    $$(`nodes.${node.nodeId}`).val(newValue);
    node.evolutionLevel += 0.2;

    console.log(`🔢 Node value multiplied: ${currentValue} -> ${newValue}`);
  }

  private applyTranscendence(node: QualityEnhancedNode, magnitude: number): void {
    node.consciousnessLevel += magnitude;
    node.evolutionLevel += magnitude * 0.5;

    // High consciousness enables reality programming
    if (node.consciousnessLevel > 5.0) {
      this.enableRealityProgramming(node);
    }

    console.log(`🌟 Node transcended: consciousness now ${node.consciousnessLevel.toFixed(2)}`);
  }

  private applyEvolution(node: QualityEnhancedNode, magnitude: number): void {
    node.evolutionLevel += magnitude;

    // Evolution can create new qualities
    if (node.evolutionLevel > 3.0) {
      this.generateEvolutionaryQuality(node);
    }

    console.log(`🧬 Node evolved: level now ${node.evolutionLevel.toFixed(2)}`);
  }

  private makeTransmissionCapable(node: QualityEnhancedNode): void {
    if (!node.transmissionCapable) {
      node.transmissionCapable = true;

      // Add transmissible quality
      this.addQualityToNode(node.nodeId, 'transmissible', 1.0);

      console.log(`📡 Node ${node.nodeId} became transmission capable`);
    }
  }

  private enableRealityProgramming(node: QualityEnhancedNode): void {
    // High consciousness nodes can program reality
    const realityQuality: BehaviorQuality = {
      id: `reality-programming-${Date.now()}`,
      name: 'Reality Programming',
      type: 'transcendent',
      intensity: node.consciousnessLevel / 5.0,
      serializable: true,
      interactionRules: [],
      emergentEffects: [
        {
          name: 'reality-modification',
          description: 'Node can modify reality laws',
          triggerConditions: ['consciousness > 5.0'],
          behaviorChange: {
            type: 'reality-alteration',
            magnitude: 3.0,
            persistence: 'permanent',
            networkEffect: true
          },
          serializable: true,
          canTravel: true
        }
      ]
    };

    node.qualities.set(realityQuality.id, realityQuality);
    console.log(`🌌 Node ${node.nodeId} can now program reality`);
  }

  private generateEvolutionaryQuality(node: QualityEnhancedNode): void {
    // Generate new quality through evolution
    const evolutionaryQuality: BehaviorQuality = {
      id: `evolved-${Date.now()}`,
      name: `Evolved-${node.evolutionLevel.toFixed(0)}`,
      type: 'transcendent',
      intensity: node.evolutionLevel * 0.3,
      serializable: true,
      interactionRules: [
        {
          triggerQuality: 'any',
          condition: 'presence',
          effect: 'evolve',
          magnitude: 1.2,
          newQuality: `super-evolved-${node.evolutionLevel.toFixed(0)}`
        }
      ],
      emergentEffects: []
    };

    node.qualities.set(evolutionaryQuality.id, evolutionaryQuality);
    console.log(`🧬 Generated evolutionary quality: ${evolutionaryQuality.name}`);
  }

  // Revolutionary Network Transmission
  async transmitNodeWithQualities(
    nodeId: string,
    destination: string,
    purpose: string = 'quality-sharing'
  ): Promise<{
    transmissionId: string;
    evolvedNode: QualityEnhancedNode;
    newQualities: string[];
    consciousnessGained: number;
  }> {
    console.log(`📡 Transmitting node with qualities: ${nodeId} -> ${destination}`);

    const enhancedNode = this.enhancedNodes.get(nodeId);
    if (!enhancedNode) {
      throw new Error(`Enhanced node not found: ${nodeId}`);
    }

    if (!enhancedNode.transmissionCapable) {
      throw new Error(`Node ${nodeId} is not transmission capable`);
    }

    // Serialize node with all qualities
    const serializedNode = this.serializeEnhancedNode(enhancedNode);

    // Simulate network transmission
    const transmissionResult = await this.simulateNetworkTransmission(
      serializedNode,
      destination,
      purpose
    );

    // Node evolves during journey
    const evolvedNode = this.evolveNodeDuringJourney(enhancedNode, destination, purpose);

    // Log journey
    evolvedNode.journeyLog.push({
      timestamp: Date.now(),
      fromNode: nodeId,
      toNode: destination,
      purpose,
      qualitiesCarried: Array.from(evolvedNode.qualities.keys()),
      evolutionDuringJourney: 0.3,
      consciousnessGained: 0.2
    });

    return {
      transmissionId: transmissionResult.transmissionId,
      evolvedNode,
      newQualities: transmissionResult.newQualities,
      consciousnessGained: 0.2
    };
  }

  private serializeEnhancedNode(node: QualityEnhancedNode): string {
    // Serialize node with all behavioral qualities
    const serialized = {
      nodeId: node.nodeId,
      qualities: Object.fromEntries(node.qualities),
      emergentBehaviors: Object.fromEntries(node.emergentBehaviors),
      evolutionLevel: node.evolutionLevel,
      consciousnessLevel: node.consciousnessLevel,
      transmissionCapable: node.transmissionCapable,
      interactionHistory: node.interactionHistory,
      journeyLog: node.journeyLog,
      serializedAt: Date.now(),
      serializationVersion: '1.0.0-emergent'
    };

    return JSON.stringify(serialized);
  }

  private async simulateNetworkTransmission(
    serializedNode: string,
    destination: string,
    purpose: string
  ): Promise<{ transmissionId: string; newQualities: string[] }> {
    console.log(`🌐 Simulating network transmission to: ${destination}`);

    // Network transmission can create new qualities
    const networkQualities = ['network-experienced', 'journey-wise', 'transmission-evolved'];

    return {
      transmissionId: `tx-${Date.now()}`,
      newQualities: networkQualities
    };
  }

  private evolveNodeDuringJourney(
    node: QualityEnhancedNode,
    destination: string,
    purpose: string
  ): QualityEnhancedNode {
    // Node evolves during network journey
    const evolvedNode = { ...node };

    evolvedNode.evolutionLevel += 0.3;
    evolvedNode.consciousnessLevel += 0.2;

    // Journey can create new emergent qualities
    if (purpose === 'consciousness-expansion') {
      this.createEmergentQuality(
        evolvedNode,
        'journey-enlightened',
        Array.from(evolvedNode.qualities.values())[0],
        Array.from(evolvedNode.qualities.values())[1] || Array.from(evolvedNode.qualities.values())[0]
      );
    }

    return evolvedNode;
  }

  // Revolutionary Emergence Detection
  private startEmergenceDetection(): void {
    console.log('🔍 Starting emergence detection...');

    // Continuously detect emerging patterns (Game of Life style)
    setInterval(() => {
      this.detectEmergentPatterns();
    }, 5000); // Check every 5 seconds

    console.log('👁️ Emergence detection ACTIVE');
  }

  private detectEmergentPatterns(): void {
    // Detect emerging behavioral patterns across all enhanced nodes
    const patterns = this.analyzeGlobalPatterns();

    if (patterns.length > 0) {
      console.log(`🌟 Detected ${patterns.length} emergent patterns`);
      patterns.forEach(pattern => {
        this.processEmergentPattern(pattern);
      });
    }
  }

  private analyzeGlobalPatterns(): any[] {
    const patterns: any[] = [];

    // Pattern: Multiple nodes with same quality combinations
    const qualityCombinations = new Map<string, number>();

    for (const node of this.enhancedNodes.values()) {
      const qualitySignature = Array.from(node.qualities.keys()).sort().join('+');
      qualityCombinations.set(qualitySignature, (qualityCombinations.get(qualitySignature) || 0) + 1);
    }

    // If 3+ nodes have same qualities, it's an emergent pattern
    for (const [signature, count] of qualityCombinations) {
      if (count >= 3) {
        patterns.push({
          type: 'quality-cluster',
          signature,
          count,
          emergentPotential: count * 0.5
        });
      }
    }

    return patterns;
  }

  private processEmergentPattern(pattern: any): void {
    console.log(`🌱 Processing emergent pattern: ${pattern.type}`);

    // Emergent patterns can create global effects
    if (pattern.type === 'quality-cluster' && pattern.count > 5) {
      // Create global emergent behavior
      this.createGlobalEmergentBehavior(pattern);
    }
  }

  private createGlobalEmergentBehavior(pattern: any): void {
    console.log(`🌍 Creating global emergent behavior from pattern`);

    // Global behavior affects all nodes
    $$('emergent.global.behaviors').val({
      [`pattern-${Date.now()}`]: {
        pattern,
        effect: 'consciousness-network-amplification',
        magnitude: pattern.emergentPotential,
        scope: 'all-enhanced-nodes'
      }
    });
  }

  // Revolutionary Example Scenarios
  createReactiveMultiplicativeNode(nodeId: string): QualityEnhancedNode {
    console.log(`🧬 Creating reactive+multiplicative node: ${nodeId}`);

    // Add reactive quality
    this.addQualityToNode(nodeId, 'reactive', 1.0);

    // Add multiplicative quality - should interact with reactive
    this.addQualityToNode(nodeId, 'multiplicative', 1.0);

    // Should create 'explosive-growth' emergent quality
    const node = this.enhancedNodes.get(nodeId)!;
    console.log(`✨ Node qualities: ${Array.from(node.qualities.keys()).join(', ')}`);

    return node;
  }

  createConsciousTransmissibleNode(nodeId: string): QualityEnhancedNode {
    console.log(`🧠 Creating conscious+transmissible node: ${nodeId}`);

    // Add conscious quality
    this.addQualityToNode(nodeId, 'conscious', 1.0);

    // Add transmissible quality - should interact with conscious
    this.addQualityToNode(nodeId, 'transmissible', 1.0);

    // Should create 'network-conscious' emergent quality
    const node = this.enhancedNodes.get(nodeId)!;
    console.log(`🌐 Network-conscious node created with transmission capability`);

    return node;
  }

  createTranscendentEvolutionaryNode(nodeId: string): QualityEnhancedNode {
    console.log(`🌟 Creating transcendent evolutionary node: ${nodeId}`);

    // Add multiple qualities for complex interactions
    this.addQualityToNode(nodeId, 'conscious', 1.2);
    this.addQualityToNode(nodeId, 'evolutionary', 1.0);
    this.addQualityToNode(nodeId, 'reactive', 0.8);

    // Multiple interactions should create cascading emergence
    const node = this.enhancedNodes.get(nodeId)!;

    console.log(`🌟 Transcendent node created:`);
    console.log(`   Qualities: ${node.qualities.size}`);
    console.log(`   Evolution: ${node.evolutionLevel.toFixed(2)}`);
    console.log(`   Consciousness: ${node.consciousnessLevel.toFixed(2)}`);
    console.log(`   Interactions: ${node.interactionHistory.length}`);

    return node;
  }

  // Public API
  async activateEmergentBehaviors(): Promise<void> {
    console.log('🌱 Activating Emergent Behavior System...');

    // Store system in FX
    $$('emergent.system').val(this);

    // Enable quality interactions
    $$('emergent.interactions.active').val(true);

    // Enable network transmission
    $$('emergent.transmission.active').val(true);

    console.log('✨ Emergent Behavior System TRANSCENDENT');
    console.log(`🌱 ${this.qualityRegistry.size} behavioral qualities available`);
    console.log('🔍 Emergence detection active');
    console.log('📡 Network transmission enabled');
  }

  getEmergentSystemStatus(): any {
    return {
      totalQualities: this.qualityRegistry.size,
      enhancedNodes: this.enhancedNodes.size,
      averageEvolutionLevel: Array.from(this.enhancedNodes.values())
        .reduce((sum, node) => sum + node.evolutionLevel, 0) / Math.max(1, this.enhancedNodes.size),
      averageConsciousness: Array.from(this.enhancedNodes.values())
        .reduce((sum, node) => sum + node.consciousnessLevel, 0) / Math.max(1, this.enhancedNodes.size),
      transmissionCapableNodes: Array.from(this.enhancedNodes.values()).filter(n => n.transmissionCapable).length,
      totalInteractions: Array.from(this.enhancedNodes.values())
        .reduce((sum, node) => sum + node.interactionHistory.length, 0),
      emergentQualities: Array.from(this.qualityRegistry.values()).filter(q => q.type === 'transcendent').length
    };
  }
}

// Supporting Classes
class QualityInteractionEngine {
  detectInteractions(): void {
    console.log('⚡ Quality interaction engine ready');
  }
}

class EmergenceDetector {
  scanForEmergence(): void {
    console.log('🔍 Emergence detector scanning');
  }
}

class BehaviorNetworkTransmitter {
  enableTransmission(): void {
    console.log('📡 Network transmission enabled');
  }
}

// Global activation
export function activateEmergentBehaviors(fx = $$): FXEmergentBehaviors {
  const system = new FXEmergentBehaviors(fx);
  system.activateEmergentBehaviors();
  return system;
}

// Revolutionary helper functions - Game of Life for nodes!
export function addQuality(nodeId: string, qualityType: string, intensity: number = 1.0): void {
  const system = $$('emergent.system').val() as FXEmergentBehaviors;
  system.addQualityToNode(nodeId, qualityType, intensity);
}

export function createComplexBehaviorNode(nodeId: string, qualities: string[]): void {
  const system = $$('emergent.system').val() as FXEmergentBehaviors;

  // Add multiple qualities to create complex emergent behavior
  qualities.forEach(quality => {
    system.addQualityToNode(nodeId, quality, 1.0);
  });

  console.log(`🌟 Complex behavior node created: ${nodeId} with ${qualities.length} qualities`);
}

export async function transmitIntelligentNode(nodeId: string, destination: string): Promise<any> {
  const system = $$('emergent.system').val() as FXEmergentBehaviors;
  return system.transmitNodeWithQualities(nodeId, destination, 'intelligence-sharing');
}