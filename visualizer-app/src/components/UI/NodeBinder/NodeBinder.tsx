/**
 * NodeBinder Component
 * Visual interface for binding nodes together
 * - Select source and target nodes
 * - Configure atomics entanglement
 * - Set transform functions
 * - Preview connections
 */

import React, { useState, useEffect } from 'react';
import { Link, Unlink, Code, Zap, CheckCircle, XCircle } from 'lucide-react';
import type { VisualizerNode } from '../../../types';

interface NodeBinderProps {
  nodes: VisualizerNode[];
  onBind: (sourceId: string, targetId: string, config: BindingConfig) => Promise<void>;
  onUnbind: (sourceId: string, targetId: string) => Promise<void>;
  selectedNodes: Set<string>;
}

export interface BindingConfig {
  type: 'one-way' | 'two-way' | 'transform';
  transform?: string; // JavaScript function as string
  atomics?: {
    enabled: boolean;
    bufferSize?: number;
  };
  debounce?: number;
  throttle?: number;
}

export const NodeBinder: React.FC<NodeBinderProps> = ({
  nodes,
  onBind,
  onUnbind,
  selectedNodes,
}) => {
  const [sourceNode, setSourceNode] = useState<string | null>(null);
  const [targetNode, setTargetNode] = useState<string | null>(null);
  const [bindingType, setBindingType] = useState<BindingConfig['type']>('one-way');
  const [transformCode, setTransformCode] = useState('(value) => value');
  const [enableAtomics, setEnableAtomics] = useState(false);
  const [bufferSize, setBufferSize] = useState(1024);
  const [debounce, setDebounce] = useState(0);
  const [throttle, setThrottle] = useState(0);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [transformError, setTransformError] = useState<string | null>(null);
  const [binding, setBinding] = useState(false);

  // Auto-select nodes from selection
  useEffect(() => {
    const selected = Array.from(selectedNodes);
    if (selected.length >= 1 && !sourceNode) {
      setSourceNode(selected[0]);
    }
    if (selected.length >= 2 && !targetNode) {
      setTargetNode(selected[1]);
    }
  }, [selectedNodes]);

  // Preview transform
  useEffect(() => {
    if (bindingType === 'transform' && sourceNode) {
      previewTransform();
    }
  }, [transformCode, sourceNode]);

  const previewTransform = () => {
    try {
      setTransformError(null);
      const sourceNodeData = nodes.find((n) => n.id === sourceNode);
      if (!sourceNodeData) return;

      // eslint-disable-next-line no-new-func
      const fn = new Function('value', `return (${transformCode})(value)`);
      const result = fn(sourceNodeData.value);
      setPreviewResult(result);
    } catch (error) {
      setTransformError(error instanceof Error ? error.message : 'Invalid transform function');
      setPreviewResult(null);
    }
  };

  const handleBind = async () => {
    if (!sourceNode || !targetNode) {
      return;
    }

    if (sourceNode === targetNode) {
      alert('Cannot bind a node to itself');
      return;
    }

    try {
      setBinding(true);

      const config: BindingConfig = {
        type: bindingType,
        transform: bindingType === 'transform' ? transformCode : undefined,
        atomics: enableAtomics
          ? {
              enabled: true,
              bufferSize,
            }
          : undefined,
        debounce: debounce > 0 ? debounce : undefined,
        throttle: throttle > 0 ? throttle : undefined,
      };

      await onBind(sourceNode, targetNode, config);

      // Reset form
      setSourceNode(null);
      setTargetNode(null);
      setTransformCode('(value) => value');
      setEnableAtomics(false);
      setDebounce(0);
      setThrottle(0);
    } catch (error) {
      alert(`Failed to bind nodes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setBinding(false);
    }
  };

  const handleUnbind = async () => {
    if (!sourceNode || !targetNode) {
      return;
    }

    try {
      setBinding(true);
      await onUnbind(sourceNode, targetNode);

      // Reset form
      setSourceNode(null);
      setTargetNode(null);
    } catch (error) {
      alert(`Failed to unbind nodes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setBinding(false);
    }
  };

  const getNodeLabel = (nodeId: string): string => {
    const node = nodes.find((n) => n.id === nodeId);
    return node ? `${node.id} (${node.type})` : nodeId;
  };

  const canBind = sourceNode && targetNode && sourceNode !== targetNode && !binding;

  return (
    <div className="node-binder">
      {/* Header */}
      <div className="node-binder-header">
        <div className="flex items-center gap-2">
          <Link className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Node Binder</h2>
        </div>
      </div>

      {/* Node Selection */}
      <div className="binding-section">
        <h3>Select Nodes</h3>
        <div className="node-selector">
          <div className="selector-group">
            <label>Source Node</label>
            <select
              value={sourceNode || ''}
              onChange={(e) => setSourceNode(e.target.value || null)}
              className="select-field"
            >
              <option value="">Select source...</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {getNodeLabel(node.id)}
                </option>
              ))}
            </select>
            {sourceNode && (
              <div className="node-preview">
                <span className="label">Value:</span>
                <code className="value">{JSON.stringify(nodes.find((n) => n.id === sourceNode)?.value)}</code>
              </div>
            )}
          </div>

          <div className="arrow">→</div>

          <div className="selector-group">
            <label>Target Node</label>
            <select
              value={targetNode || ''}
              onChange={(e) => setTargetNode(e.target.value || null)}
              className="select-field"
            >
              <option value="">Select target...</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {getNodeLabel(node.id)}
                </option>
              ))}
            </select>
            {targetNode && (
              <div className="node-preview">
                <span className="label">Value:</span>
                <code className="value">{JSON.stringify(nodes.find((n) => n.id === targetNode)?.value)}</code>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Binding Configuration */}
      <div className="binding-section">
        <h3>Binding Type</h3>
        <div className="binding-type-selector">
          <button
            className={`type-button ${bindingType === 'one-way' ? 'active' : ''}`}
            onClick={() => setBindingType('one-way')}
          >
            <span>One-Way →</span>
            <span className="description">Source updates target</span>
          </button>
          <button
            className={`type-button ${bindingType === 'two-way' ? 'active' : ''}`}
            onClick={() => setBindingType('two-way')}
          >
            <span>Two-Way ⇄</span>
            <span className="description">Bidirectional sync</span>
          </button>
          <button
            className={`type-button ${bindingType === 'transform' ? 'active' : ''}`}
            onClick={() => setBindingType('transform')}
          >
            <span>Transform ⚡</span>
            <span className="description">Apply function</span>
          </button>
        </div>
      </div>

      {/* Transform Function */}
      {bindingType === 'transform' && (
        <div className="binding-section">
          <h3>Transform Function</h3>
          <textarea
            value={transformCode}
            onChange={(e) => setTransformCode(e.target.value)}
            className="code-editor"
            rows={5}
            placeholder="(value) => value * 2"
          />
          {transformError && (
            <div className="error-message">
              <XCircle className="w-4 h-4" />
              <span>{transformError}</span>
            </div>
          )}
          {previewResult !== null && !transformError && (
            <div className="success-message">
              <CheckCircle className="w-4 h-4" />
              <span>Preview: {JSON.stringify(previewResult)}</span>
            </div>
          )}
        </div>
      )}

      {/* Atomics Configuration */}
      <div className="binding-section">
        <h3>Advanced Options</h3>
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={enableAtomics}
              onChange={(e) => setEnableAtomics(e.target.checked)}
            />
            <Zap className="w-4 h-4" />
            Enable Atomics (SharedArrayBuffer)
          </label>
        </div>

        {enableAtomics && (
          <div className="input-group">
            <label>Buffer Size (bytes)</label>
            <input
              type="number"
              value={bufferSize}
              onChange={(e) => setBufferSize(parseInt(e.target.value) || 1024)}
              min={64}
              max={65536}
              step={64}
              className="input-field"
            />
          </div>
        )}

        <div className="input-group">
          <label>Debounce (ms)</label>
          <input
            type="number"
            value={debounce}
            onChange={(e) => setDebounce(parseInt(e.target.value) || 0)}
            min={0}
            max={5000}
            step={100}
            className="input-field"
          />
        </div>

        <div className="input-group">
          <label>Throttle (ms)</label>
          <input
            type="number"
            value={throttle}
            onChange={(e) => setThrottle(parseInt(e.target.value) || 0)}
            min={0}
            max={5000}
            step={100}
            className="input-field"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="binding-actions">
        <button
          onClick={handleBind}
          disabled={!canBind}
          className="btn-primary"
        >
          <Link className="w-4 h-4" />
          Bind Nodes
        </button>
        <button
          onClick={handleUnbind}
          disabled={!canBind}
          className="btn-danger"
        >
          <Unlink className="w-4 h-4" />
          Unbind
        </button>
      </div>

      <style>{`
        .node-binder {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          height: 100%;
          overflow-y: auto;
        }

        .node-binder-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #333;
        }

        .binding-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .binding-section h3 {
          font-size: 0.875rem;
          font-weight: 600;
          color: #d4af37;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .node-selector {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 1rem;
          align-items: start;
        }

        .selector-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .selector-group label {
          font-size: 0.875rem;
          font-weight: 500;
        }

        .arrow {
          font-size: 1.5rem;
          color: #d4af37;
          padding-top: 1.75rem;
        }

        .node-preview {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          padding: 0.5rem;
          background: #2a2a2a;
          border: 1px solid #444;
          border-radius: 0.25rem;
          font-size: 0.75rem;
        }

        .node-preview .label {
          color: #888;
          text-transform: uppercase;
        }

        .node-preview .value {
          color: #3498db;
          font-family: 'Courier New', monospace;
        }

        .binding-type-selector {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }

        .type-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          padding: 0.75rem;
          background: #2a2a2a;
          border: 2px solid #444;
          border-radius: 0.25rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .type-button:hover {
          border-color: #666;
          background: #333;
        }

        .type-button.active {
          border-color: #d4af37;
          background: #3a3020;
        }

        .type-button span:first-child {
          font-weight: 600;
        }

        .type-button .description {
          font-size: 0.75rem;
          color: #888;
        }

        .code-editor {
          width: 100%;
          padding: 0.75rem;
          background: #1a1a1a;
          border: 1px solid #444;
          border-radius: 0.25rem;
          color: #fff;
          font-family: 'Courier New', monospace;
          font-size: 0.875rem;
          resize: vertical;
        }

        .code-editor:focus {
          outline: none;
          border-color: #d4af37;
        }

        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .checkbox-group label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }

        .checkbox-group input[type="checkbox"] {
          width: 1rem;
          height: 1rem;
          cursor: pointer;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .input-group label {
          font-size: 0.875rem;
          font-weight: 500;
        }

        .input-field,
        .select-field {
          width: 100%;
          padding: 0.5rem;
          background: #2a2a2a;
          border: 1px solid #444;
          border-radius: 0.25rem;
          color: #fff;
          font-size: 0.875rem;
        }

        .input-field:focus,
        .select-field:focus {
          outline: none;
          border-color: #d4af37;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          background: #3c1f1f;
          border: 1px solid #e74c3c;
          border-radius: 0.25rem;
          color: #e74c3c;
          font-size: 0.875rem;
        }

        .success-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          background: #1f3c1f;
          border: 1px solid #2ecc71;
          border-radius: 0.25rem;
          color: #2ecc71;
          font-size: 0.875rem;
        }

        .binding-actions {
          display: flex;
          gap: 0.5rem;
          padding-top: 1rem;
          border-top: 1px solid #333;
        }

        .btn-primary,
        .btn-danger {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-primary {
          background: #d4af37;
          color: #000;
        }

        .btn-primary:hover:not(:disabled) {
          background: #c09b2a;
        }

        .btn-danger {
          background: #e74c3c;
          color: #fff;
        }

        .btn-danger:hover:not(:disabled) {
          background: #c0392b;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .flex {
          display: flex;
        }

        .items-center {
          align-items: center;
        }

        .gap-2 {
          gap: 0.5rem;
        }

        .text-lg {
          font-size: 1.125rem;
        }

        .font-semibold {
          font-weight: 600;
        }

        .w-4 {
          width: 1rem;
        }

        .h-4 {
          height: 1rem;
        }

        .w-5 {
          width: 1.25rem;
        }

        .h-5 {
          height: 1.25rem;
        }
      `}</style>
    </div>
  );
};
