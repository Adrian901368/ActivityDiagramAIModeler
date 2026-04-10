import { LitElement, html, css, svg, type TemplateResult } from 'lit';
 import { customElement, state, property } from 'lit/decorators.js';

type NodeType = 'action' | 'decision' | 'merge';
type VirtualNodeKind = 'start' | 'merge' | 'final';

interface CanvasNodeBase {
  id: string;
  type: NodeType;
  actor: string;
  x: number;
  y: number;
}

interface ActionCanvasNode extends CanvasNodeBase {
  type: 'action';
  text: string;
  actionIndex: number | null;
}

interface DecisionCanvasNode extends CanvasNodeBase {
  type: 'decision';
  condition: string;
  yesText: string;
  noText: string;
  yesActionIndex: number | null;
  noActionIndex: number | null;
  sourceActionIndex: number | null;
}

interface MergeCanvasNode extends CanvasNodeBase {
  type: 'merge';
}

type CanvasNode = ActionCanvasNode | DecisionCanvasNode | MergeCanvasNode;

export interface ProcessActionDto {
  actor: string;
  action: string;
}

export interface ProcessDecisionDto {
  condition: string;
  branchyes: string;
  branchno: string;
  yes_action_index?: number | null;
  no_action_index?: number | null;
}

export interface ProcessParallelBlockDto {
  actions: ProcessActionDto[];
}

export interface ProcessStructureInputDto {
  actors: string[];
  actions: ProcessActionDto[];
  decisions?: ProcessDecisionDto[] | null;
  parallelblocks?: ProcessParallelBlockDto[] | null;
}

export interface CanvasNodeSnapshot {
  id: string;
  type: 'action' | 'decision';
  actor: string;
  x: number;
  y: number;
  text?: string;
  actionIndex?: number | null;
  condition?: string;
  yesText?: string;
  noText?: string;
  yesActionIndex?: number | null;
  noActionIndex?: number | null;
  sourceActionIndex?: number | null;
}

export interface CanvasFullStateDto {
  actors: string[];
  nodes: CanvasNodeSnapshot[];
  laneWidths: number[];
  startOffset: { x: number; y: number };
  finalOffset: { x: number; y: number };
  mergeOffsets: Record<string, { x: number; y: number }>;
}

interface RealDragState {
  kind: 'real';
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

interface VirtualDragState {
  kind: 'virtual';
  virtualKind: VirtualNodeKind;
  virtualId: string;
  baseX: number;
  baseY: number;
  offsetX: number;
  offsetY: number;
}

interface DividerTrackedNode {
  nodeId: string;
  laneIndex: number;
  ratio: number;
}

interface ExplicitEdge {
  id: string;
  fromId: string;
  toId: string;
  portType: string;
}

interface DividerDragState {
  kind: 'divider';
  dividerIndex: number;
  startX: number;
  initialWidths: number[];
  trackedNodes: DividerTrackedNode[];
}

interface ConnectingDragState {
  kind: 'connecting';
  sourceNodeId: string;
  portType: 'action-out' | 'decision-yes' | 'decision-no' | 'virtual-out' | string;
  currentX: number;
  currentY: number;
}

// EdgePanelDragState removed because panels are static now
type DragState = RealDragState | VirtualDragState | DividerDragState | ConnectingDragState;

type BranchSide = 'yes' | 'no';

interface BranchMark {
  decisionId: string;
  side: BranchSide;
}

interface Point {
  x: number;
  y: number;
}

interface StartVisualNode {
  x: number;
  y: number;
}

interface MergeVisualNode {
  decisionId: string;
  x: number;
  y: number;
  yesTerminal: (ActionCanvasNode & { actionIndex: number }) | null;
  noTerminal: (ActionCanvasNode & { actionIndex: number }) | null;
  nextAction: (ActionCanvasNode & { actionIndex: number }) | null;
}

interface FinalVisualNode {
  x: number;
  y: number;
}

interface DerivedLayout {
  actionNodes: ActionCanvasNode[];
  indexedActions: (ActionCanvasNode & { actionIndex: number })[];
  decisionNodes: DecisionCanvasNode[];
  branchMembership: Map<number, BranchMark>;
  decisionsBySource: Map<number, DecisionCanvasNode[]>;
  startNode: StartVisualNode | null;
  mergeNodes: MergeVisualNode[];
  finalNode: FinalVisualNode | null;
}

@customElement('ad-canvas-editor')
export class AdCanvasEditor extends LitElement {
  static override styles = css`
    :host {
      display: block;
      min-height: 300px;
    }

    .wrapper {
      position: relative;
      border-radius: 12px;
      border: 1px solid #d1d5db;
      background: #f9fafb;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid #e5e7eb;
      background: #f3f4f6;
    }

    .header-title {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #4b5563;
    }

    .subtitle {
      font-size: 10px;
      color: #6b7280;
    }

    .toolbar {
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }

    .btn {
      border-radius: 999px;
      border: 1px solid #d1d5db;
      background: #ffffff;
      color: #374151;
      font-size: 11px;
      padding: 4px 10px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 500;
      transition: all 0.15s;
    }

    .btn:hover {
      background: #f9fafb;
      border-color: #9ca3af;
    }

    .editor-body {
      display: flex;
      flex-direction: row;
      height: 560px;
    }

    .canvas-container {
      flex: 1;
      position: relative;
      background: #ffffff;
      overflow: auto;
    }

    .sidebar {
      width: 260px;
      background: #f9fafb;
      border-left: 1px solid #e5e7eb;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
    }

    svg {
      width: 100%;
      height: auto;
      user-select: none;
      -webkit-user-select: none;
      cursor: default;
      display: block;
    }

    .empty-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .empty-text {
      font-size: 12px;
      color: #6b7280;
      text-align: center;
      max-width: 360px;
      line-height: 1.4;
    }
    
    .static-panel {
      background: #ffffff;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition: all 0.2s ease-in-out;
    }

    .static-panel.disabled {
      opacity: 0.5;
      pointer-events: none;
      background: #f3f4f6;
    }

    .static-panel.active {
      border-color: #3b82f6;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.12);
    }

    .panel-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6b7280;
      margin-bottom: 2px;
    }

    .static-panel.active .panel-title {
      color: #3b82f6;
    }

    .panel-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .panel-field label {
      font-size: 10px;
      color: #6b7280;
      font-weight: 500;
    }

    .panel-field input, .panel-field select {
      font-size: 11px;
      padding: 6px 8px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      outline: none;
      color: #111827;
      background: #f9fafb;
      font-family: system-ui, -apple-system, sans-serif;
      transition: border-color 0.15s;
    }

    .panel-field input:focus, .panel-field select:focus {
      border-color: #3b82f6;
      background: #ffffff;
    }

    .panel-divider {
      height: 1px;
      background: #f3f4f6;
      margin: 4px 0;
    }

    .panel-delete-btn {
      padding: 6px 8px;
      font-size: 11px;
      font-weight: 600;
      color: #dc2626;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      cursor: pointer;
      text-align: center;
      transition: background 0.15s;
    }

    .panel-delete-btn:hover {
      background: #fee2e2;
    }  
    
    .lane-panel {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
      flex-wrap: wrap;
    }

    .lane-panel-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #9ca3af;
      white-space: nowrap;
      margin-right: 2px;
    }

    .lane-item {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: #ffffff;
      border: 1px solid #d1d5db;
      border-radius: 999px;
      padding: 2px 4px 2px 8px;
    }

    .lane-name-input {
      border: none;
      outline: none;
      background: transparent;
      font-size: 11px;
      color: #374151;
      width: 90px;
      font-family: inherit;
      padding: 0;
    }

    .lane-name-input:focus {
      color: #111827;
    }

    .lane-delete-btn {
      border: none;
      background: transparent;
      cursor: pointer;
      color: #9ca3af;
      font-size: 14px;
      padding: 0 4px;
      line-height: 1;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      transition: background 0.1s ease, color 0.1s ease;
    }

    .lane-delete-btn:hover:not(:disabled) {
      background: #fee2e2;
      color: #ef4444;
    }

    .lane-delete-btn:disabled {
      opacity: 0.3;
      cursor: default;
    }
  `;

  @state() private actors: string[] = [];
  @state() private nodes: CanvasNode[] = [];
  @state() private dragState: DragState | null = null;
  @state() private laneWidths: number[] = [];

  @state() private startOffset: Point = { x: 0, y: 0 };
  @state() private finalOffset: Point = { x: 0, y: 0 };
  @state() private mergeOffsets: Record<string, Point> = {};

  @state() private selectedNodeId: string | null = null;
  @state() private hoveredNodeId: string | null = null;
  @state() private explicitEdges: Array<{ id: string; fromId: string; toId: string; portType: string }> = [];

  @state() private selectedEdge: { id: string; fromId: string; toId: string; midX: number; midY: number } | null = null;
  @state() private deletedEdgeIds: string[] = [];
  @state() private deletedMergeIds: string[] = [];

  @property({ type: Boolean, reflect: true }) readOnly = false;


  private minLaneWidth = 260;
  private lanePaddingX = 120;
  private laneHeaderHeight = 44;

  private nodeHeight = 24;
  private decisionSize = 22;
  private mergeSize = 18;

  private nodeVerticalGap = 90;
  private branchOffset = 160;
  private startGap = 52;
  private mergeGap = 48;
  private finalGap = 40;

  private isInternalChange = false;

  public setStructure(structure: ProcessStructureInputDto | null): void {
    if (this.isInternalChange) return;

    if (!structure) {
      this.actors = [];
      this.nodes = [];
      this.laneWidths = [];
      this.startOffset = { x: 0, y: 0 };
      this.finalOffset = { x: 0, y: 0 };
      this.mergeOffsets = {};
      this.emitStructureChange();
      return;
    }

    const actors = [...new Set(structure.actors ?? [])];
    this.actors = actors.length ? actors : ['Actor'];
    this.syncLaneWidths(this.actors.length);

    const nodes: CanvasNode[] = [];
    const baseY = this.laneHeaderHeight + 80;
    const laneCenters = this.computeLaneCenters(this.actors.length);
    const actionNodesByIndex = new Map<number, ActionCanvasNode>();

    let currentY = baseY;

    // PASS 1: Lay out all action nodes sequentially using running currentY
    structure.actions?.forEach((a, index) => {
      const laneIndex = this.actors.findIndex((actor) => actor === a.actor);
      const lane = laneIndex === -1 ? 0 : laneIndex;
      const x = laneCenters[lane];

      const node: ActionCanvasNode = {
        id: this.generateNodeId(),
        type: 'action',
        actor: a.actor,
        text: a.action,
        x,
        y: currentY,
        actionIndex: index,
      };

      const dynamicHeight = this.getNodeDynamicHeight(node);
      nodes.push(node);
      actionNodesByIndex.set(index, node);
      currentY += dynamicHeight + this.nodeVerticalGap;
    });

    // PASS 2: Place decision nodes relative to their source/target actions
    structure.decisions?.forEach((d) => {
      const yesIndex = d.yes_action_index !== undefined && d.yes_action_index !== null ? d.yes_action_index : null;
      const noIndex = d.no_action_index !== undefined && d.no_action_index !== null ? d.no_action_index : null;

      const yesNode = yesIndex !== null ? actionNodesByIndex.get(yesIndex) ?? null : null;
      const noNode = noIndex !== null ? actionNodesByIndex.get(noIndex) ?? null : null;

      const targetNodes: ActionCanvasNode[] = [];
      if (yesNode) targetNodes.push(yesNode);
      if (noNode) targetNodes.push(noNode);

      let sourceActionIndex: number | null = null;
      const targetIndexes = [yesIndex, noIndex].filter((v): v is number => v !== null);
      if (targetIndexes.length > 0) {
        const minTargetIdx = Math.min(...targetIndexes);
        const candidate = minTargetIdx - 1;
        if (candidate >= 0) sourceActionIndex = candidate;
      }

      const sourceNode = sourceActionIndex !== null ? actionNodesByIndex.get(sourceActionIndex) ?? null : null;

      let laneActor = this.actors[0] ?? 'Actor';
      let laneX = laneCenters[0];
      if (sourceNode) { laneActor = sourceNode.actor; laneX = sourceNode.x; }
      else if (yesNode) { laneActor = yesNode.actor; laneX = yesNode.x; }
      else if (noNode) { laneActor = noNode.actor; laneX = noNode.x; }

      let decisionY = currentY;
      if (targetNodes.length > 0) {
        const minTargetY = Math.min(...targetNodes.map((n) => n.y));
        decisionY = Math.max(this.laneHeaderHeight + 100, minTargetY - this.nodeVerticalGap);
        if (sourceNode) {
          const srcH = this.getNodeDynamicHeight(sourceNode);
          const minAllowed = sourceNode.y + srcH + this.nodeVerticalGap;
          if (decisionY < minAllowed) decisionY = minAllowed;
        }
      } else if (sourceNode) {
        const srcH = this.getNodeDynamicHeight(sourceNode);
        decisionY = sourceNode.y + srcH + this.nodeVerticalGap;
      }

      const decisionNode: DecisionCanvasNode = {
        id: this.generateNodeId(),
        type: 'decision',
        actor: laneActor,
        condition: d.condition,
        yesText: d.branchyes || 'yes',
        noText: d.branchno || 'no',
        yesActionIndex: yesIndex,
        noActionIndex: noIndex,
        sourceActionIndex,
        x: laneX,
        y: decisionY,
      };

      nodes.push(decisionNode);

      const decisionDynamicHeight = this.getNodeDynamicHeight(decisionNode);
      if (decisionY + decisionDynamicHeight >= currentY) {
        currentY = decisionY + decisionDynamicHeight + this.nodeVerticalGap;
      }
    });

    // PASS 3: Push branch target action nodes safely below their decision hexagon
    const decisionNodes = nodes.filter((n) => n.type === 'decision') as DecisionCanvasNode[];
    decisionNodes.forEach((d) => {
      const yesAction = d.yesActionIndex !== null && d.yesActionIndex !== undefined
        ? actionNodesByIndex.get(d.yesActionIndex) ?? null : null;
      const noAction = d.noActionIndex !== null && d.noActionIndex !== undefined
        ? actionNodesByIndex.get(d.noActionIndex) ?? null : null;

      if (!yesAction && !noAction) return;

      const decisionDynamicHeight = this.getNodeDynamicHeight(d);

      if (yesAction) {
        yesAction.x = d.x - this.branchOffset;
        const yesDynamicHeight = this.getNodeDynamicHeight(yesAction);
        const safeYesY = d.y + (decisionDynamicHeight / 2) + this.nodeVerticalGap + (yesDynamicHeight / 2);
        if (yesAction.y < safeYesY) yesAction.y = safeYesY;
      }

      if (noAction) {
        noAction.x = d.x + this.branchOffset;
        const noDynamicHeight = this.getNodeDynamicHeight(noAction);
        const safeNoY = d.y + (decisionDynamicHeight / 2) + this.nodeVerticalGap + (noDynamicHeight / 2);
        if (noAction.y < safeNoY) noAction.y = safeNoY;
      }
    });

    // PASS 4: Normalization - ensure NO action node sits above a previous one in sequence
    const sortedByIndex = [...actionNodesByIndex.values()].sort(
      (a, b) => (a.actionIndex ?? 0) - (b.actionIndex ?? 0)
    );

    let minNextY = baseY;
    sortedByIndex.forEach((action) => {
      const h = this.getNodeDynamicHeight(action);
      if (action.y < minNextY) {
        action.y = minNextY;
      }
      minNextY = action.y + h + this.nodeVerticalGap;
    });

    this.startOffset = { x: 0, y: 0 };
    this.finalOffset = { x: 0, y: 0 };
    this.mergeOffsets = {};
    this.explicitEdges = []; // Generated diagrams use sequential logic only
    this.nodes = [...nodes].sort((a, b) => a.y - b.y);
    this.emitStructureChange();
  }

  public getStructure(): ProcessStructureInputDto {
    const actors = [...new Set(this.actors.length ? this.actors : ['Actor'])];
    const orderedNodes = [...this.nodes].sort((a, b) => a.y - b.y);

    const actionNodes = orderedNodes.filter((n) => n.type === 'action');

    const getNewIndex = (oldIndex: number | null): number | null => {
      if (oldIndex === null || oldIndex === undefined) return null;
      const originalNode = this.nodes.find(n => n.type === 'action' && (n as ActionCanvasNode).actionIndex === oldIndex);
      if (!originalNode) return null;
      const newIdx = actionNodes.findIndex(n => n.id === originalNode.id);
      return newIdx !== -1 ? newIdx : null;
    };

    const actions: ProcessActionDto[] = actionNodes.map((n) => ({
      actor: n.actor,
      action: (n as ActionCanvasNode).text,
    }));

    const decisions: ProcessDecisionDto[] = orderedNodes
      .filter((n) => n.type === 'decision')
      .map((n) => {
        const d = n as DecisionCanvasNode;
        return {
          condition: d.condition || '',
          branchyes: d.yesText || '',
          branchno: d.noText || '',
          yesactionindex: getNewIndex(d.yesActionIndex),
          noactionindex: getNewIndex(d.noActionIndex),
        };
      });

    return {
      actors,
      actions,
      decisions: decisions.length ? decisions : null,
      parallelblocks: null
    };
  }

  public getFullState(): Record<string, unknown> {
      return {
        actors: [...this.actors],
        nodes: this.nodes.map((n) => ({ ...n })),
        laneWidths: [...this.laneWidths],
        startOffset: { ...this.startOffset },
        finalOffset: { ...this.finalOffset },
        mergeOffsets: Object.fromEntries(
          Object.entries(this.mergeOffsets).map(([k, v]) => [k, { ...v }])
        ),
        explicitEdges: this.explicitEdges.map((e) => ({ ...e })),
        deletedEdgeIds: [...this.deletedEdgeIds],
        deletedMergeIds: [...this.deletedMergeIds],
      };
    }

  public setFullState(state: Record<string, unknown> | null): void {
      if (!state) return;

      if (Array.isArray(state.actors)) {
        this.actors = state.actors as string[];
      }
      if (Array.isArray(state.nodes)) {
        this.nodes = state.nodes as CanvasNode[];
      }
      if (Array.isArray(state.laneWidths) && state.laneWidths.length > 0) {
        this.laneWidths = state.laneWidths as number[];
      } else {
        this.syncLaneWidths(this.actors.length);
      }
      if (state.startOffset && typeof state.startOffset === 'object') {
        this.startOffset = state.startOffset as Point;
      } else {
        this.startOffset = { x: 0, y: 0 };
      }
      if (state.finalOffset && typeof state.finalOffset === 'object') {
        this.finalOffset = state.finalOffset as Point;
      } else {
        this.finalOffset = { x: 0, y: 0 };
      }
      if (state.mergeOffsets && typeof state.mergeOffsets === 'object' && !Array.isArray(state.mergeOffsets)) {
        this.mergeOffsets = state.mergeOffsets as Record<string, Point>;
      } else {
        this.mergeOffsets = {};
      }
      if (Array.isArray(state.explicitEdges)) {
        this.explicitEdges = state.explicitEdges as ExplicitEdge[];
      } else {
        this.explicitEdges = [];
      }
      if (Array.isArray(state.deletedEdgeIds)) {
        this.deletedEdgeIds = state.deletedEdgeIds as string[];
      } else {
        this.deletedEdgeIds = [];
      }
      if (Array.isArray(state.deletedMergeIds)) {
        this.deletedMergeIds = state.deletedMergeIds as string[];
      } else {
        this.deletedMergeIds = [];
      }

      // Reset transient UI state
      this.selectedNodeId = null;
      this.selectedEdge = null;
      this.hoveredNodeId = null;
      this.dragState = null;
    }

  private emitStructureChange(): void {
    this.isInternalChange = true;
    this.dispatchEvent(
      new CustomEvent('structure-change', {
        detail: this.getStructure(),
        bubbles: true,
        composed: true,
      })
    );
    setTimeout(() => {
      this.isInternalChange = false;
    }, 50);
  }

  private wrapText(text: string, maxCharsPerLine: number = 24): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach((word) => {
      if ((currentLine + word).length > maxCharsPerLine) {
        if (currentLine.trim() !== '') {
          lines.push(currentLine.trim());
        }
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    });

    if (currentLine.trim() !== '') {
      lines.push(currentLine.trim());
    }

    return lines.length > 0 ? lines : [''];
  }

  private getActionDimensions(lines: string[]): { width: number; height: number } {
    const minWidth = 40;
    const longestLine = [...lines].sort((a, b) => b.length - a.length)[0] || '';
    const estimatedWidth = Math.max(minWidth, longestLine.length * 5.5 + 16);
    const height = (lines.length * 14) + 16;
    return { width: estimatedWidth, height };
  }

  private getDecisionDimensions(lines: string[]): { width: number; height: number; halfW: number; halfH: number; edgeOffset: number } {
    const edgeOffset = 12;
    const minWidth = 20 + (edgeOffset * 2);
    const longestLine = [...lines].sort((a, b) => b.length - a.length)[0] || '';
    const estimatedWidth = Math.max(minWidth, (longestLine.length * 5.5) + 8 + (edgeOffset * 2));
    const height = (lines.length * 14) + 20;

    return {
      width: estimatedWidth,
      height,
      halfW: estimatedWidth / 2,
      halfH: height / 2,
      edgeOffset
    };
  }

  private getNodeDynamicHeight(node: CanvasNode): number {
    if (node.type === 'action') {
      const actionNode = node as ActionCanvasNode;
      const lines = this.wrapText(actionNode.text || 'New action', 22);
      return this.getActionDimensions(lines).height;
    } else if (node.type === 'decision') {
      const decisionNode = node as DecisionCanvasNode;
      const lines = this.wrapText(decisionNode.condition || 'Decision', 18);
      return this.getDecisionDimensions(lines).height;
    } else if (node.type === 'merge') {
      return this.mergeSize;
    }
    return this.nodeHeight;
  }

    private getDefaultLaneWidth(): number {
      let maxNodeHalfWidth = 90; // fallback for empty canvas

      for (const node of this.nodes) {
        if (node.type === 'action') {
          const lines = this.wrapText((node as ActionCanvasNode).text || '', 22);
          const dims = this.getActionDimensions(lines);
          maxNodeHalfWidth = Math.max(maxNodeHalfWidth, dims.width / 2);
        } else if (node.type === 'decision') {
          const lines = this.wrapText((node as DecisionCanvasNode).condition || '', 18);
          const dims = this.getDecisionDimensions(lines);
          maxNodeHalfWidth = Math.max(maxNodeHalfWidth, dims.halfW);
        }
      }

      // Both yes/no branches must fit: (branchOffset + nodeHalfWidth) on each side + 20% padding
      const base = (this.branchOffset + maxNodeHalfWidth) * 2;
      return Math.round(base * 1.2);
    }

  override render() {
      const laneCount = Math.max(this.actors.length, 1);
      const totalWidth = this.computeTotalWidth(laneCount);
      const layout = this.buildDerivedLayout();

      const realNodeBottom = this.nodes.length
        ? Math.max(...this.nodes.map((n) => n.y)) + Math.max(this.nodeHeight, this.decisionSize)
        : this.laneHeaderHeight + 240;

      const mergeBottom = layout.mergeNodes.length
        ? Math.max(...layout.mergeNodes.map((m) => m.y + this.mergeSize / 2))
        : 0;

      const startBottom = layout.startNode ? layout.startNode.y + 12 : 0;
      const finalBottom = layout.finalNode ? layout.finalNode.y + 14 : 0;

      const totalHeight = Math.max(
        540,
        realNodeBottom + 140,
        mergeBottom + 140,
        startBottom + 80,
        finalBottom + 100,
      );

      return html`
          <div class="wrapper">
            <div class="header">
              <div class="header-title">
                <div class="title">Canvas editor</div>
                <div class="subtitle">
                  ${this.readOnly
                    ? 'Read-only view.'
                    : 'Drag actions, decisions, control nodes, and swimlane dividers.'}
                </div>
              </div>
              ${!this.readOnly ? html`
                <div class="toolbar">
                  <button class="btn" @click=${this.onAddMergeClick}>
                    + Add merge node
                  </button>
                  <button class="btn" @click=${this.onAddActionClick}>
                    + Add action node
                  </button>
                  <button class="btn" @click=${this.onAddDecisionClick}>
                    + Add decision node
                  </button>
                  <button class="btn" @click=${this.onAddSwimlaneClick}>
                    + Add swimlane
                  </button>
                </div>
              ` : null}
            </div>
        
            ${!this.readOnly ? this.renderLanePanel() : null}
        
            <div class="editor-body">
              <div
                class="canvas-container"
                @pointermove=${!this.readOnly ? this.onCanvasPointerMove : null}
                @pointerup=${!this.readOnly ? this.onCanvasPointerUp : null}
                @pointerleave=${!this.readOnly ? this.onCanvasPointerUp : null}
                @pointerdown=${!this.readOnly ? this.onCanvasPointerDown : null}
              >
                <svg
                  viewBox=${`0 0 ${totalWidth} ${totalHeight}`}
                  width=${totalWidth}
                  height=${totalHeight}
                >
                  ${this.renderSwimlanes(totalHeight)}
                  ${this.renderEdges(layout)}
                  ${this.renderVirtualNodes(layout)}
                  ${!this.readOnly ? this.renderConnectingLine() : null}
                  ${this.renderNodes()}
                </svg>
        
                ${this.actors.length === 0 && this.nodes.length === 0
                  ? html`
                      <div class="empty-overlay">
                        <div class="empty-text">
                          No actors or actions yet.
                        </div>
                      </div>
                    `
                  : null}
              </div>
        
              ${!this.readOnly ? html`
                <div class="sidebar">
                  ${this.renderActionPanel()}
                  ${this.renderDecisionPanel()}
                  ${this.renderEdgePanel()}
                  ${this.renderMergePanel()}
                </div>
              ` : null}
            </div>
          </div>
        `;
    }

  // --- NEW SIDEBAR PANELS ---

  private renderActionPanel() {
    const node = this.nodes.find((n) => n.id === this.selectedNodeId);
    const isActive = node?.type === 'action';
    const actionNode = isActive ? (node as ActionCanvasNode) : null;

    return html`
      <div class="static-panel ${isActive ? 'active' : 'disabled'}">
        <div class="panel-title">Action Node</div>

        <div class="panel-field">
          <label>Label</label>
          <input
            type="text"
            .value="${actionNode?.text || ''}"
            placeholder="${isActive ? '' : 'Select an action'}"
            ?disabled="${!isActive}"
            @input="${(e: Event) => isActive && node && this.onPanelTextChange(node.id, (e.target as HTMLInputElement).value)}"
          />
        </div>

        <div class="panel-field">
          <label>Actor (Swimlane)</label>
          <select
            .value="${actionNode?.actor || ''}"
            ?disabled="${!isActive}"
            @change="${(e: Event) => isActive && node && this.onPanelActorChange(node.id, (e.target as HTMLSelectElement).value)}"
          >
            ${this.actors.map(
              (actor) => html`
                <option value="${actor}" ?selected="${actor === actionNode?.actor}">
                  ${actor}
                </option>
              `
            )}
          </select>
        </div>

        ${isActive && node ? html`
          <div class="panel-divider"></div>
          <div class="panel-delete-btn" @click="${() => this.onPanelDeleteNode(node.id)}">
            🗑 Delete action
          </div>
        ` : null}
      </div>
    `;
  }

  private renderDecisionPanel() {
    const node = this.nodes.find((n) => n.id === this.selectedNodeId);
    const isActive = node?.type === 'decision';
    const decisionNode = isActive ? (node as DecisionCanvasNode) : null;

    return html`
      <div class="static-panel ${isActive ? 'active' : 'disabled'}">
        <div class="panel-title">Decision Node</div>

        <div class="panel-field">
          <label>Condition</label>
          <input
            type="text"
            .value="${decisionNode?.condition || ''}"
            placeholder="${isActive ? '' : 'Select a decision'}"
            ?disabled="${!isActive}"
            @input="${(e: Event) => isActive && node && this.onPanelConditionChange(node.id, (e.target as HTMLInputElement).value)}"
          />
        </div>

        <div class="panel-field">
          <label>Yes branch label</label>
          <input
            type="text"
            .value="${decisionNode?.yesText || ''}"
            ?disabled="${!isActive}"
            @input="${(e: Event) => isActive && node && this.onPanelYesTextChange(node.id, (e.target as HTMLInputElement).value)}"
          />
        </div>

        <div class="panel-field">
          <label>No branch label</label>
          <input
            type="text"
            .value="${decisionNode?.noText || ''}"
            ?disabled="${!isActive}"
            @input="${(e: Event) => isActive && node && this.onPanelNoTextChange(node.id, (e.target as HTMLInputElement).value)}"
          />
        </div>

        <div class="panel-field">
          <label>Actor (Swimlane)</label>
          <select
            .value="${decisionNode?.actor || ''}"
            ?disabled="${!isActive}"
            @change="${(e: Event) => isActive && node && this.onPanelActorChange(node.id, (e.target as HTMLSelectElement).value)}"
          >
            ${this.actors.map(
              (actor) => html`
                <option value="${actor}" ?selected="${actor === decisionNode?.actor}">
                  ${actor}
                </option>
              `
            )}
          </select>
        </div>

        ${isActive && node ? html`
          <div class="panel-divider"></div>
          <div class="panel-delete-btn" @click="${() => this.onPanelDeleteNode(node.id)}">
            🗑 Delete decision
          </div>
        ` : null}
      </div>
    `;
  }

  private renderEdgePanel(): TemplateResult {
    const isActive = this.selectedEdge !== null;

    return html`
      <div class="static-panel ${isActive ? 'active' : 'disabled'}">
        <div class="panel-title">Connection Edge</div>
        <div class="panel-field">
          <label style="margin-bottom: 4px;">
            ${isActive ? 'Selected flow connection' : 'Select an edge to edit'}
          </label>
        </div>
        
        ${isActive ? html`
          <div class="panel-divider"></div>
          <div class="panel-delete-btn" @click="${this.onDeleteSelectedEdge}">
            🗑 Delete connection
          </div>
        ` : null}
      </div>
    `;
  }

  // --- SVG RENDERING ---
    private renderMergePanel() {
    let isActive = false;
    let isVirtual = false;
    let actor = '';

    const realNode = this.nodes.find((n) => n.id === this.selectedNodeId);

    if (realNode && realNode.type === 'merge') {
      isActive = true;
      actor = realNode.actor;
    } else if (this.selectedNodeId?.startsWith('virtual-merge-')) {
      isActive = true;
      isVirtual = true;
    }

    return html`
      <div class="static-panel ${isActive ? 'active' : 'disabled'}">
        <div class="panel-title">${isVirtual ? 'Auto Merge Node' : 'Merge Node'}</div>

        <div class="panel-field">
          <label>${isVirtual ? 'Actor (Auto-positioned)' : 'Actor (Swimlane)'}</label>
          <select
            .value="${actor}"
            ?disabled="${!isActive || isVirtual}"
            @change="${(e: Event) => isActive && !isVirtual && realNode && this.onPanelActorChange(realNode.id, (e.target as HTMLSelectElement).value)}"
          >
            ${this.actors.map(
              (a) => html`
                <option value="${a}" ?selected="${a === actor}">
                  ${a}
                </option>
              `
            )}
            ${isVirtual ? html`<option value="" selected>Auto layout</option>` : ''}
          </select>
        </div>

        ${isActive ? html`
          <div class="panel-divider"></div>
          <div class="panel-delete-btn" @click="${() => this.onPanelDeleteNode(isVirtual ? this.selectedNodeId! : realNode!.id)}">
            🗑 Delete merge node
          </div>
        ` : null}
      </div>
    `;
  }

  private onAddMergeClick(): void {
      const actors = this.actors.length > 0 ? this.actors : ['Actor'];
      if (!this.actors.length) {
        this.actors = actors;
        this.syncLaneWidths(actors.length);
      }
      const { x, y } = this.getNewNodePosition();

      this.nodes = [
        ...this.nodes,
        {
          id: this.generateNodeId(),
          type: 'merge',
          actor: actors[actors.length - 1],
          x,
          y,
        } as MergeCanvasNode,
      ];
      this.emitStructureChange();
  }

  private renderSwimlanes(totalHeight: number) {
    const lanes = this.actors.length ? this.actors : ['Lane 1'];
    const widths = this.getLaneWidths(lanes.length);
    const starts = this.computeLaneStartsFromWidths(widths);

    const laneParts = lanes.map((actor, index) => {
      const x = starts[index];
      const width = widths[index];
      const headerHeight = this.laneHeaderHeight;

      return svg`
        <g>
          <rect x=${x} y=${0} width=${width} height=${headerHeight} fill="#ffffff" stroke="#d1d5db" stroke-width="1" />
          <text x=${x + width / 2} y=${headerHeight / 2 + 3} text-anchor="middle" fill="#111827" font-size="11" font-weight="500">
            ${actor}
          </text>
          <line x1=${x} y1=${headerHeight} x2=${x} y2=${totalHeight} stroke="#111111" stroke-width="1" />
          <line x1=${x + width} y1=${headerHeight} x2=${x + width} y2=${totalHeight} stroke="#111111" stroke-width="1" />
        </g>
      `;
    });

    const dividerParts = widths.slice(0, -1).map((_, index) => {
      const dividerX = starts[index] + widths[index];

      return svg`
        <g data-divider-index=${String(index)} style="cursor: col-resize;">
          <rect x=${dividerX - 8} y=${0} width="16" height=${totalHeight} fill="transparent" />
          <rect x=${dividerX - 3} y="8" width="6" height="28" rx="3" ry="3" fill="#e5e7eb" stroke="#9ca3af" stroke-width="1" />
        </g>
      `;
    });

    return svg`${laneParts}${dividerParts}`;
  }

  private renderNodes() {
      return svg`${this.nodes.map((node) => {
        const isSelected = this.selectedNodeId === node.id;
        const isHovered = this.hoveredNodeId === node.id;
    
        const strokeColor = isHovered ? '#10b981' : isSelected ? '#3b82f6' : '#9ca3af';
        const strokeWidth = isHovered || isSelected ? '2.5' : '1.5';
        const fillColor = isHovered ? '#f0fdf4' : isSelected ? '#eff6ff' : '#ffffff';
    
        if (node.type === 'action') {
          const actionNode = node as ActionCanvasNode;
          const rawText = actionNode.text || 'New action';
          const lines = this.wrapText(rawText, 22);
          const dims = this.getActionDimensions(lines);
          const x = node.x - dims.width / 2;
          const y = node.y - dims.height / 2;
          const startYOffset = -((lines.length - 1) * 14) / 2;
          const portY = node.y + dims.height / 2;
    
          return svg`
            <g data-node-id="${node.id}" style="cursor: ${this.readOnly ? 'default' : 'grab'};">
              <rect x="${x}" y="${y}" rx="6" ry="6" width="${dims.width}" height="${dims.height}"
                fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
              <text x="${node.x}" y="${node.y}" text-anchor="middle" dominant-baseline="central"
                fill="#111827" font-size="11" font-family="system-ui, -apple-system, sans-serif">
                ${lines.map((line, index) => svg`
                  <tspan x="${node.x}" dy="${index === 0 ? startYOffset : 14}">${line}</tspan>
                `)}
              </text>
              ${isSelected && !this.readOnly ? svg`
                <circle data-port-type="action-out" data-port-node-id="${node.id}"
                  cx="${node.x}" cy="${portY}" r="6"
                  fill="#3b82f6" stroke="#ffffff" stroke-width="1.5"
                  style="cursor: crosshair;" />
              ` : null}
            </g>
          `;
        } else if (node.type === 'decision') {
          const d = node as DecisionCanvasNode;
          const rawCondition = d.condition || 'Decision';
          const lines = this.wrapText(rawCondition, 18);
          const dims = this.getDecisionDimensions(lines);
    
          const points = [
            `${node.x - dims.halfW},${node.y}`,
            `${node.x - dims.halfW + dims.edgeOffset},${node.y - dims.halfH}`,
            `${node.x + dims.halfW - dims.edgeOffset},${node.y - dims.halfH}`,
            `${node.x + dims.halfW},${node.y}`,
            `${node.x + dims.halfW - dims.edgeOffset},${node.y + dims.halfH}`,
            `${node.x - dims.halfW + dims.edgeOffset},${node.y + dims.halfH}`,
          ].join(' ');
    
          const startYOffset = -((lines.length - 1) * 14) / 2;
    
          return svg`
            <g data-node-id="${node.id}" style="cursor: ${this.readOnly ? 'default' : 'grab'};">
              <polygon points="${points}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
              <text x="${node.x}" y="${node.y}" text-anchor="middle" dominant-baseline="central"
                fill="#111827" font-size="10" font-weight="500"
                font-family="system-ui, -apple-system, sans-serif">
                ${lines.map((line, index) => svg`
                  <tspan x="${node.x}" dy="${index === 0 ? startYOffset : 14}">${line}</tspan>
                `)}
              </text>
              <text x="${node.x - dims.halfW - 6}" y="${node.y - 12}" text-anchor="end"
                dominant-baseline="middle" fill="#059669" font-size="10" font-weight="bold">
                ${d.yesText || 'yes'}
              </text>
              <text x="${node.x + dims.halfW + 6}" y="${node.y - 12}" text-anchor="start"
                dominant-baseline="middle" fill="#dc2626" font-size="10" font-weight="bold">
                ${d.noText || 'no'}
              </text>
              ${isSelected && !this.readOnly ? svg`
                <circle data-port-type="decision-yes" data-port-node-id="${node.id}"
                  cx="${node.x - dims.halfW}" cy="${node.y}" r="6"
                  fill="#059669" stroke="#ffffff" stroke-width="1.5"
                  style="cursor: crosshair;" />
                <circle data-port-type="decision-no" data-port-node-id="${node.id}"
                  cx="${node.x + dims.halfW}" cy="${node.y}" r="6"
                  fill="#dc2626" stroke="#ffffff" stroke-width="1.5"
                  style="cursor: crosshair;" />
              ` : null}
            </g>
          `;
        } else if (node.type === 'merge') {
          const half = this.mergeSize / 2;
          const points = [
            `${node.x} ${node.y - half}`,
            `${node.x + half} ${node.y}`,
            `${node.x} ${node.y + half}`,
            `${node.x - half} ${node.y}`,
          ].join(' ');
    
          return svg`
            <g data-node-id="${node.id}" style="cursor: ${this.readOnly ? 'default' : 'grab'};">
              <polygon points="${points}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
              ${isSelected && !this.readOnly ? svg`
                <circle data-port-type="action-out" data-port-node-id="${node.id}"
                  cx="${node.x}" cy="${node.y + half + 4}" r="6"
                  fill="#3b82f6" stroke="#ffffff" stroke-width="1.5"
                  style="cursor: crosshair;" />
              ` : null}
            </g>
          `;
        }
        return svg``;
      })}`;
  }

  private renderVirtualNodes(layout: DerivedLayout) {
    const parts: unknown[] = [];

    if (layout.startNode) {
      const isSelected = this.selectedNodeId === 'virtual-start';
      const isHovered = this.hoveredNodeId === 'virtual-start';
      const strokeColor = isHovered ? '#10b981' : isSelected ? '#3b82f6' : 'none';
      const strokeWidth = isHovered || isSelected ? '2.5' : '0';

      parts.push(svg`
        <g data-virtual-kind="start" data-virtual-id="start" style="cursor: grab;">
          <circle cx=${layout.startNode.x} cy=${layout.startNode.y} r="10" fill="#111111" stroke=${strokeColor} stroke-width=${strokeWidth} />
          ${isSelected ? svg`
            <circle data-port-type="virtual-out" data-port-node-id="virtual-start" cx="${layout.startNode.x}" cy="${layout.startNode.y + 14}" r="6" fill="#3b82f6" stroke="#ffffff" stroke-width="1.5" style="cursor: crosshair;" />
          ` : null}
        </g>
      `);
    }

    layout.mergeNodes.forEach((merge) => {
      const half = this.mergeSize / 2;
      const points = [
        `${merge.x} ${merge.y - half}`,
        `${merge.x + half} ${merge.y}`,
        `${merge.x} ${merge.y + half}`,
        `${merge.x - half} ${merge.y}`,
      ].join(' ');

      const isSelected = this.selectedNodeId === `virtual-merge-${merge.decisionId}`;
      const isHovered = this.hoveredNodeId === `virtual-merge-${merge.decisionId}`;
      const strokeColor = isHovered ? '#10b981' : isSelected ? '#3b82f6' : '#9ca3af';
      const strokeW = isHovered || isSelected ? '2.5' : '1';

      parts.push(svg`
        <g data-virtual-kind="merge" data-virtual-id=${merge.decisionId} style="cursor: grab;">
          <polygon points=${points} fill="#ffffff" stroke=${strokeColor} stroke-width=${strokeW} />
          ${isSelected ? svg`
            <circle data-port-type="virtual-out" data-port-node-id="virtual-merge-${merge.decisionId}" cx="${merge.x}" cy="${merge.y + half + 4}" r="6" fill="#3b82f6" stroke="#ffffff" stroke-width="1.5" style="cursor: crosshair;" />
          ` : null}
        </g>
      `);
    });

    if (layout.finalNode) {
      const isSelected = this.selectedNodeId === 'virtual-final';
      const isHovered = this.hoveredNodeId === 'virtual-final';
      const strokeColor = isHovered ? '#10b981' : isSelected ? '#3b82f6' : '#111111';
      const strokeW = isHovered || isSelected ? '2.5' : '1.5';

      parts.push(svg`
        <g data-virtual-kind="final" data-virtual-id="final" style="cursor: grab;">
          <circle cx=${layout.finalNode.x} cy=${layout.finalNode.y} r="11" fill="#ffffff" stroke=${strokeColor} stroke-width=${strokeW} />
          <circle cx=${layout.finalNode.x} cy=${layout.finalNode.y} r="6" fill="#111111" />
          ${isSelected ? svg`
            <circle data-port-type="virtual-out" data-port-node-id="virtual-final" cx="${layout.finalNode.x}" cy="${layout.finalNode.y - 16}" r="6" fill="#3b82f6" stroke="#ffffff" stroke-width="1.5" style="cursor: crosshair;" />
          ` : null}
        </g>
      `);
    }

    return svg`${parts}`;
  }

  // --- LAYOUT ENGINE ---

  private buildBranchMembership(decisionNodes: DecisionCanvasNode[]): Map<number, BranchMark> {
    const membership = new Map<number, BranchMark>();

    decisionNodes.forEach((d) => {
      const yesIdx = d.yesActionIndex;
      const noIdx = d.noActionIndex;

      if (yesIdx != null) {
        membership.set(yesIdx, { decisionId: d.id, side: 'yes' });
      }

      if (noIdx != null) {
        membership.set(noIdx, { decisionId: d.id, side: 'no' });
      }

      if (yesIdx != null && noIdx != null) {
        const lo = Math.min(yesIdx, noIdx);
        const hi = Math.max(yesIdx, noIdx);
        const side: BranchSide = yesIdx < noIdx ? 'yes' : 'no';

        for (let i = lo + 1; i < hi; i++) {
          if (!membership.has(i)) {
            membership.set(i, { decisionId: d.id, side });
          }
        }
      }
    });

    return membership;
  }

  private getMergeOffset(decisionId: string): Point {
    return this.mergeOffsets[decisionId] ?? { x: 0, y: 0 };
  }

  private buildDerivedLayout(): DerivedLayout {
    const actionNodes = this.nodes.filter((n) => n.type === 'action') as ActionCanvasNode[];

    const indexedActions = actionNodes
      .filter((a): a is ActionCanvasNode & { actionIndex: number } => a.actionIndex !== null)
      .sort((a, b) => a.actionIndex - b.actionIndex);

    const decisionNodes = this.nodes.filter((n) => n.type === 'decision') as DecisionCanvasNode[];

    const branchMembership = this.buildBranchMembership(decisionNodes);

    const decisionsBySource = new Map<number, DecisionCanvasNode[]>();
    decisionNodes.forEach((d) => {
      if (d.sourceActionIndex == null) return;
      const arr = decisionsBySource.get(d.sourceActionIndex) ?? [];
      arr.push(d);
      decisionsBySource.set(d.sourceActionIndex, arr);
    });

    const firstAction = indexedActions[0] ?? null;
    const startNode = firstAction != null
      ? { x: firstAction.x + this.startOffset.x, y: Math.max(this.laneHeaderHeight + 28, firstAction.y - this.startGap) + this.startOffset.y }
      : null;

    const mergeNodes: MergeVisualNode[] = [];

    const findAction = (idx: number | null): (ActionCanvasNode & { actionIndex: number }) | null => {
      if (idx == null) return null;
      return indexedActions.find((a) => a.actionIndex === idx) ?? null;
    };

    const getBranchTerminal = (decisionId: string, side: BranchSide, fallback: (ActionCanvasNode & { actionIndex: number }) | null) => {
      const candidates = indexedActions.filter((a) => {
        const mark = branchMembership.get(a.actionIndex);
        return mark?.decisionId === decisionId && mark.side === side;
      });
      if (candidates.length) return candidates[candidates.length - 1];
      return fallback;
    };

    decisionNodes.forEach((decision) => {
      const yesStart = findAction(decision.yesActionIndex);
      const noStart = findAction(decision.noActionIndex);

      const yesTerminal = getBranchTerminal(decision.id, 'yes', yesStart);
      const noTerminal = getBranchTerminal(decision.id, 'no', noStart);

      if (!yesTerminal || !noTerminal) return;

      const maxTerminalY = Math.max(yesTerminal.y, noTerminal.y);
      const maxTerminalIndex = Math.max(yesTerminal.actionIndex, noTerminal.actionIndex);

      const nextAction = indexedActions.find((a) => {
        if (a.actionIndex <= maxTerminalIndex) return false;
        const mark = branchMembership.get(a.actionIndex);
        return !mark;
      }) ?? null;

      const mergeBaseX = (yesTerminal.x + noTerminal.x) / 2;
      const mergeBaseY = maxTerminalY + this.mergeGap;
      const mergeOffset = this.getMergeOffset(decision.id);

      // PRIDANÁ PODMIENKA: Pridaj merge node len ak nebol používateľom zmazaný
      if (!this.deletedMergeIds.includes(decision.id)) {
        mergeNodes.push({
          decisionId: decision.id,
          x: mergeBaseX + mergeOffset.x,
          y: mergeBaseY + mergeOffset.y,
          yesTerminal,
          noTerminal,
          nextAction,
        });
      }
    });

    let finalNode: FinalVisualNode | null = null;

    const bottomOpenMerge = [...mergeNodes]
      .filter((m) => m.nextAction == null)
      .sort((a, b) => b.y - a.y)[0] ?? null;

    if (bottomOpenMerge) {
      finalNode = { x: bottomOpenMerge.x + this.finalOffset.x, y: bottomOpenMerge.y + this.finalGap + this.finalOffset.y };
    } else if (indexedActions.length) {
      const lastAction = indexedActions[indexedActions.length - 1];
      finalNode = { x: lastAction.x + this.finalOffset.x, y: lastAction.y + this.finalGap + 20 + this.finalOffset.y };
    }

    return { actionNodes, indexedActions, decisionNodes, branchMembership, decisionsBySource, startNode, mergeNodes, finalNode };
  }

  private buildArrowPath(endX: number, endY: number, direction: 'up' | 'down' | 'left' | 'right'): string {
    const a = 4;
    if (direction === 'down') return `M ${endX} ${endY} L ${endX - a} ${endY - a} L ${endX + a} ${endY - a} Z`;
    if (direction === 'up') return `M ${endX} ${endY} L ${endX - a} ${endY + a} L ${endX + a} ${endY + a} Z`;
    if (direction === 'left') return `M ${endX} ${endY} L ${endX + a} ${endY - a} L ${endX + a} ${endY + a} Z`;
    return `M ${endX} ${endY} L ${endX - a} ${endY - a} L ${endX - a} ${endY + a} Z`;
  }

  private renderPolylineEdge(points: Point[], direction: 'up' | 'down' | 'left' | 'right', edgeMeta?: { id: string; fromId: string; toId: string }) {
    if (points.length < 2) return null;
    const d = points.map((point, index) => (index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`)).join(' ');
    const end = points[points.length - 1];

    const isSelected = edgeMeta && this.selectedEdge?.id === edgeMeta.id;
    const strokeColor = isSelected ? '#3b82f6' : '#111111';
    const strokeWidth = isSelected ? '2' : '1.1';

    return svg`
      <g>
        <path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
        <path d="${this.buildArrowPath(end.x, end.y, direction)}" fill="${strokeColor}" />
        ${edgeMeta ? svg`
          <path d="${d}" fill="none" stroke="transparent" stroke-width="16" style="cursor: pointer; pointer-events: stroke;"
                @pointerdown="${(e: PointerEvent) => {
                  e.stopPropagation();
                  const p1 = points[0];
                  const p2 = points[points.length - 1];
                  this.selectedEdge = {
                    id: edgeMeta.id,
                    fromId: edgeMeta.fromId,
                    toId: edgeMeta.toId,
                    midX: (p1.x + p2.x) / 2,
                    midY: (p1.y + p2.y) / 2
                  };
                  this.selectedNodeId = null;
                }}" />
        ` : ''}
      </g>
    `;
  }

  private edgeStraight(x1: number, y1: number, x2: number, y2: number, edgeMeta?: { id: string; fromId: string; toId: string }) {
    const midY = (y1 + y2) / 2;
    return this.renderPolylineEdge([{ x: x1, y: y1 }, { x: x1, y: midY }, { x: x2, y: midY }, { x: x2, y: y2 }], y2 >= midY ? 'down' : 'up', edgeMeta);
  }

  private edgeBranch(startX: number, startY: number, endX: number, endY: number, edgeMeta?: { id: string; fromId: string; toId: string }) {
    return this.renderPolylineEdge([{ x: startX, y: startY }, { x: endX, y: startY }, { x: endX, y: endY }], endY >= startY ? 'down' : 'up', edgeMeta);
  }

  private edgeToMerge(startX: number, startY: number, mergeX: number, mergeY: number, edgeMeta?: { id: string; fromId: string; toId: string }) {
    const half = this.mergeSize / 2;
    if (startX < mergeX) return this.renderPolylineEdge([{ x: startX, y: startY }, { x: startX, y: mergeY }, { x: mergeX - half, y: mergeY }], 'right', edgeMeta);
    if (startX > mergeX) return this.renderPolylineEdge([{ x: startX, y: startY }, { x: startX, y: mergeY }, { x: mergeX + half, y: mergeY }], 'left', edgeMeta);
    return this.renderPolylineEdge([{ x: startX, y: startY }, { x: startX, y: mergeY - half }], 'down', edgeMeta);
  }

  private renderEdges(layout: DerivedLayout) {
    const paths: unknown[] = [];
    const findAction = (idx: number | null) => (idx !== null && idx !== undefined ? layout.indexedActions.find((a) => a.actionIndex === idx) ?? null : null);
    const terminalBranchActions = new Map<number, string>();

    layout.mergeNodes.forEach((merge) => {
      if (merge.yesTerminal && merge.yesTerminal.actionIndex !== null) terminalBranchActions.set(merge.yesTerminal.actionIndex, merge.decisionId);
      if (merge.noTerminal && merge.noTerminal.actionIndex !== null) terminalBranchActions.set(merge.noTerminal.actionIndex, merge.decisionId);
    });

    const getH = (node: CanvasNodeBase) => {
      if (node.type === 'action') return typeof (this as any).getNodeDynamicHeight === 'function' ? (this as any).getNodeDynamicHeight(node) : this.nodeHeight;
      if (node.type === 'decision') return this.decisionSize;
      return this.nodeHeight;
    };

    const addPath = (svgPath: unknown, id: string) => {
      if (!svgPath || this.deletedEdgeIds.includes(id)) return;
      paths.push(svgPath);
    };

    if (layout.startNode && layout.indexedActions.length) {
      const firstAction = layout.indexedActions[0];
      const id = `auto_start_${firstAction.id}`;
      addPath(this.edgeStraight(layout.startNode.x, layout.startNode.y + 10, firstAction.x, firstAction.y - getH(firstAction) / 2, { id, fromId: 'start', toId: firstAction.id }), id);
    }

    layout.indexedActions.forEach((action) => {
      const relatedDecisions = layout.decisionsBySource.get(action.actionIndex!) ?? [];
      relatedDecisions.forEach((decision) => {
        const id = `auto_${action.id}_${decision.id}`;
        addPath(this.edgeStraight(action.x, action.y + getH(action) / 2, decision.x, decision.y - this.decisionSize / 2, { id, fromId: action.id, toId: decision.id }), id);
      });
    });

    for (let i = 0; i < layout.indexedActions.length - 1; i++) {
      const from = layout.indexedActions[i];
      const to = layout.indexedActions[i + 1];
      if (layout.decisionsBySource.has(from.actionIndex!)) continue;
      if (terminalBranchActions.has(from.actionIndex!)) continue;

      const fromMark = layout.branchMembership.get(from.actionIndex!);
      const toMark = layout.branchMembership.get(to.actionIndex!);
      if (fromMark && toMark && fromMark.decisionId === toMark.decisionId && fromMark.side !== toMark.side) continue;

      const id = `auto_${from.id}_${to.id}`;
      addPath(this.edgeStraight(from.x, from.y + getH(from) / 2, to.x, to.y - getH(to) / 2, { id, fromId: from.id, toId: to.id }), id);
    }

    if (this.explicitEdges) {
      const getPos = (id: string) => {
        if (id === 'virtual-start' && layout.startNode) return { x: layout.startNode.x, y: layout.startNode.y, h: 20, type: 'virtual' };
        if (id === 'virtual-final' && layout.finalNode) return { x: layout.finalNode.x, y: layout.finalNode.y, h: 22, type: 'virtual' };
        if (id.startsWith('virtual-merge-')) {
          const mId = id.replace('virtual-merge-', '');
          const m = layout.mergeNodes.find(x => x.decisionId === mId);
          if (m) return { x: m.x, y: m.y, h: this.mergeSize, type: 'virtual' };
        }
        const n = this.nodes.find(x => x.id === id);
        if (n) {
          return { x: n.x, y: n.y, h: getH(n), type: n.type };
        }
        return null;
      };

      this.explicitEdges.forEach((edge) => {
        const fromPos = getPos(edge.fromId);
        const toPos = getPos(edge.toId);
        if (!fromPos || !toPos) return;

        if (fromPos.type === 'decision' && edge.portType === 'decision-yes') {
          paths.push(this.edgeBranch(fromPos.x - this.decisionSize / 2, fromPos.y, toPos.x, toPos.y - toPos.h / 2, edge as any));
        } else if (fromPos.type === 'decision' && edge.portType === 'decision-no') {
          paths.push(this.edgeBranch(fromPos.x + this.decisionSize / 2, fromPos.y, toPos.x, toPos.y - toPos.h / 2, edge as any));
        } else {
          // Priama čiara pre všetko ostatné (action, start, final, merge)
          paths.push(this.edgeStraight(fromPos.x, fromPos.y + fromPos.h / 2, toPos.x, toPos.y - toPos.h / 2, edge as any));
        }
      });
    }

    layout.decisionNodes.forEach((decision) => {
      const half = this.decisionSize / 2;
      const yesTarget = findAction(decision.yesActionIndex);
      if (yesTarget) {
        const id = `auto_${decision.id}_yes_${yesTarget.id}`;
        addPath(this.edgeBranch(decision.x - half, decision.y, yesTarget.x, yesTarget.y - getH(yesTarget) / 2, { id, fromId: decision.id, toId: yesTarget.id }), id);
      }

      const noTarget = findAction(decision.noActionIndex);
      if (noTarget) {
        const id = `auto_${decision.id}_no_${noTarget.id}`;
        addPath(this.edgeBranch(decision.x + half, decision.y, noTarget.x, noTarget.y - getH(noTarget) / 2, { id, fromId: decision.id, toId: noTarget.id }), id);
      }
    });

    layout.mergeNodes.forEach((merge) => {
      const halfM = this.mergeSize / 2;
      if (merge.yesTerminal) {
        const id = `auto_merge_yes_${merge.yesTerminal.id}_${merge.decisionId}`;
        addPath(this.edgeToMerge(merge.yesTerminal.x, merge.yesTerminal.y + getH(merge.yesTerminal) / 2, merge.x, merge.y, { id, fromId: merge.yesTerminal.id, toId: merge.decisionId }), id);
      }
      if (merge.noTerminal) {
        const id = `auto_merge_no_${merge.noTerminal.id}_${merge.decisionId}`;
        addPath(this.edgeToMerge(merge.noTerminal.x, merge.noTerminal.y + getH(merge.noTerminal) / 2, merge.x, merge.y, { id, fromId: merge.noTerminal.id, toId: merge.decisionId }), id);
      }
      if (merge.nextAction) {
        const id = `auto_merge_${merge.decisionId}_${merge.nextAction.id}`;
        addPath(this.edgeStraight(merge.x, merge.y + halfM, merge.nextAction.x, merge.nextAction.y - getH(merge.nextAction) / 2, { id, fromId: merge.decisionId, toId: merge.nextAction.id }), id);
      } else if (layout.finalNode) {
        const id = `auto_merge_${merge.decisionId}_final`;
        addPath(this.edgeStraight(merge.x, merge.y + halfM, layout.finalNode.x, layout.finalNode.y - 11, { id, fromId: merge.decisionId, toId: 'final' }), id);
      }
    });

    if (!layout.mergeNodes.length && layout.finalNode && layout.indexedActions.length) {
      const lastAction = layout.indexedActions[layout.indexedActions.length - 1];
      const id = `auto_${lastAction.id}_final`;
      addPath(this.edgeStraight(lastAction.x, lastAction.y + getH(lastAction) / 2, layout.finalNode.x, layout.finalNode.y - 11, { id, fromId: lastAction.id, toId: 'final' }), id);
    }

    return svg`${paths}`;
  }

  // --- POINTER EVENTS & INTERACTION ---

  private onCanvasPointerDown(event: PointerEvent): void {
    const portTarget = event.composedPath().find(
      (el) => el instanceof Element && (el as Element).hasAttribute('data-port-type')
    ) as Element | undefined;

    if (portTarget) {
      const portType = portTarget.getAttribute('data-port-type') as ConnectingDragState['portType'];
      const sourceNodeId = portTarget.getAttribute('data-port-node-id') ?? '';
      const svgEl = this.renderRoot.querySelector('svg') as SVGSVGElement | null;
      if (!svgEl || !sourceNodeId) return;

      const pt = svgEl.createSVGPoint();
      pt.x = event.clientX;
      pt.y = event.clientY;
      const svgPt = pt.matrixTransform(svgEl.getScreenCTM()?.inverse());

      this.dragState = {
        kind: 'connecting',
        sourceNodeId,
        portType,
        currentX: svgPt.x,
        currentY: svgPt.y,
      };

      svgEl.setPointerCapture(event.pointerId);
      return;
    }

    const realTarget = event
      .composedPath()
      .find((el) => el instanceof SVGGElement && (el as SVGGElement).dataset.nodeId) as SVGGElement | undefined;

    if (realTarget?.dataset.nodeId) {
      const svgElement = this.renderRoot.querySelector('svg') as SVGSVGElement | null;
      if (!svgElement) return;
      const point = svgElement.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const svgPoint = point.matrixTransform(svgElement.getScreenCTM()?.inverse());

      const id = realTarget.dataset.nodeId;
      const node = this.nodes.find((n) => n.id === id);
      if (!node) return;

      this.selectedNodeId = id;
      this.selectedEdge = null;

      this.dragState = {
        kind: 'real',
        nodeId: id,
        offsetX: svgPoint.x - node.x,
        offsetY: svgPoint.y - node.y,
      };
      realTarget.setPointerCapture(event.pointerId);
      return;
    }

    const dividerTarget = event
      .composedPath()
      .find((el) => el instanceof SVGGElement && (el as SVGGElement).dataset.dividerIndex !== undefined) as SVGGElement | undefined;

    if (dividerTarget?.dataset.dividerIndex !== undefined) {
      const svgElement = this.renderRoot.querySelector('svg') as SVGSVGElement | null;
      if (!svgElement) return;
      const point = svgElement.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const svgPoint = point.matrixTransform(svgElement.getScreenCTM()?.inverse());

      const dividerIndex = Number(dividerTarget.dataset.dividerIndex);
      const widths = [...this.getLaneWidths(Math.max(this.actors.length, 1))];
      const starts = this.computeLaneStartsFromWidths(widths);

      const trackedNodes: DividerTrackedNode[] = this.nodes.map((node) => {
        let laneIndex = this.actors.findIndex((actor) => actor === node.actor);
        if (laneIndex < 0) laneIndex = this.getLaneIndexForX(node.x, widths);
        const laneStart = starts[laneIndex] ?? starts[0] ?? this.lanePaddingX;
        const laneWidth = widths[laneIndex] ?? widths[0] ?? this.getDefaultLaneWidth();
        const ratio = laneWidth > 0 ? (node.x - laneStart) / laneWidth : 0.5;
        return { nodeId: node.id, laneIndex, ratio: Math.max(0, Math.min(1, ratio)) };
      });

      this.dragState = {
        kind: 'divider',
        dividerIndex,
        startX: svgPoint.x,
        initialWidths: widths,
        trackedNodes,
      };
      dividerTarget.setPointerCapture(event.pointerId);
      return;
    }

    const virtualTarget = event
      .composedPath()
      .find((el) => el instanceof SVGGElement && (el as SVGGElement).dataset.virtualKind) as SVGGElement | undefined;

    if (!virtualTarget?.dataset.virtualKind) {
      this.selectedNodeId = null;
      this.selectedEdge = null;
      return;
    }

    const svgElement = this.renderRoot.querySelector('svg') as SVGSVGElement | null;
    if (!svgElement) return;

    const point = svgElement.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const svgPoint = point.matrixTransform(svgElement.getScreenCTM()?.inverse());

    const virtualKind = virtualTarget.dataset.virtualKind as VirtualNodeKind;
    const virtualId = virtualTarget.dataset.virtualId ?? '';

    // Zabezpečenie označenia "selektnutého" elementu aj pre virtuálne nodes
    this.selectedNodeId = virtualKind === 'merge' ? `virtual-merge-${virtualId}` : `virtual-${virtualKind}`;
    this.selectedEdge = null;

    let initialOffsetX = 0;
    let initialOffsetY = 0;

    if (virtualKind === 'start') {
      initialOffsetX = this.startOffset.x;
      initialOffsetY = this.startOffset.y;
    } else if (virtualKind === 'final') {
      initialOffsetX = this.finalOffset.x;
      initialOffsetY = this.finalOffset.y;
    } else if (virtualKind === 'merge') {
      const off = this.getMergeOffset(virtualId);
      initialOffsetX = off.x;
      initialOffsetY = off.y;
    }

    this.dragState = {
      kind: 'virtual',
      virtualKind,
      virtualId,
      baseX: svgPoint.x,
      baseY: svgPoint.y,
      offsetX: initialOffsetX,
      offsetY: initialOffsetY,
    };
    virtualTarget.setPointerCapture(event.pointerId);
  }

  private onCanvasPointerMove(event: PointerEvent): void {
    if (!this.dragState) return;

    const svgElement = this.renderRoot.querySelector('svg') as SVGSVGElement | null;
    if (!svgElement) return;

    const point = svgElement.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const svgPoint = point.matrixTransform(svgElement.getScreenCTM()?.inverse());

    if (this.dragState.kind === 'real') {
      const { nodeId, offsetX, offsetY } = this.dragState;
      const nodeIndex = this.nodes.findIndex((n) => n.id === nodeId);
      if (nodeIndex === -1) return;
      const nodes = [...this.nodes];
      nodes[nodeIndex] = { ...nodes[nodeIndex], x: svgPoint.x - offsetX, y: svgPoint.y - offsetY };
      this.nodes = nodes;
      return;
    }

    if (this.dragState.kind === 'divider') {
      const { dividerIndex, startX, initialWidths, trackedNodes } = this.dragState;
      const deltaX = svgPoint.x - startX;
      const leftInitial = initialWidths[dividerIndex];
      const rightInitial = initialWidths[dividerIndex + 1];
      const pairTotal = leftInitial + rightInitial;
      const newLeft = Math.max(this.minLaneWidth, Math.min(pairTotal - this.minLaneWidth, leftInitial + deltaX));
      const nextWidths = [...initialWidths];
      nextWidths[dividerIndex] = newLeft;
      nextWidths[dividerIndex + 1] = pairTotal - newLeft;
      const nextStarts = this.computeLaneStartsFromWidths(nextWidths);
      const trackedById = new Map(trackedNodes.map((item) => [item.nodeId, item]));
      this.laneWidths = nextWidths;
      this.nodes = this.nodes.map((node) => {
        const tracked = trackedById.get(node.id);
        if (!tracked) return node;
        const laneStart = nextStarts[tracked.laneIndex] ?? nextStarts[0] ?? this.lanePaddingX;
        const laneWidth = nextWidths[tracked.laneIndex] ?? nextWidths[0] ?? this.getDefaultLaneWidth();
        return { ...node, x: laneStart + tracked.ratio * laneWidth };
      });
      return;
    }

    if (this.dragState.kind === 'connecting') {
      const { sourceNodeId, portType } = this.dragState;

      this.dragState = {
        kind: 'connecting',
        sourceNodeId,
        portType,
        currentX: svgPoint.x,
        currentY: svgPoint.y,
      };

      const layout = this.buildDerivedLayout();
      let hoveredId: string | null = null;

      // 1. Kontrola real nodes (action / decision / merge)
      const hoveredReal = this.nodes.find((n) => {
        if (n.id === sourceNodeId) return false;
        const h = this.getNodeDynamicHeight(n);
        let halfW = 60;
        if (n.type === 'action') {
          const lines = this.wrapText((n as ActionCanvasNode).text || '', 22);
          halfW = this.getActionDimensions(lines).width / 2;
        } else if (n.type === 'decision') {
          const lines = this.wrapText((n as DecisionCanvasNode).condition || '', 18);
          halfW = this.getDecisionDimensions(lines).halfW;
        } else if (n.type === 'merge') {
          halfW = this.mergeSize / 2;
        }
        return (
          svgPoint.x >= n.x - halfW - 12 &&
          svgPoint.x <= n.x + halfW + 12 &&
          svgPoint.y >= n.y - h / 2 - 12 &&
          svgPoint.y <= n.y + h / 2 + 12
        );
      });

      if (hoveredReal) {
        hoveredId = hoveredReal.id;
      } else {
        // 2. Kontrola virtual nodes (start / merge / final)
        if (layout.startNode && sourceNodeId !== 'virtual-start' && Math.abs(svgPoint.x - layout.startNode.x) < 20 && Math.abs(svgPoint.y - layout.startNode.y) < 20) {
          hoveredId = 'virtual-start';
        } else if (layout.finalNode && sourceNodeId !== 'virtual-final' && Math.abs(svgPoint.x - layout.finalNode.x) < 20 && Math.abs(svgPoint.y - layout.finalNode.y) < 20) {
          hoveredId = 'virtual-final';
        } else {
          const hoveredMerge = layout.mergeNodes.find(m => Math.abs(svgPoint.x - m.x) < 20 && Math.abs(svgPoint.y - m.y) < 20);
          if (hoveredMerge && sourceNodeId !== `virtual-merge-${hoveredMerge.decisionId}`) {
            hoveredId = `virtual-merge-${hoveredMerge.decisionId}`;
          }
        }
      }

      this.hoveredNodeId = hoveredId;
      return;
    }

    if (this.dragState.kind === 'virtual') {
      const deltaX = svgPoint.x - this.dragState.baseX;
      const deltaY = svgPoint.y - this.dragState.baseY;
      const newOffsetX = this.dragState.offsetX + deltaX;
      const newOffsetY = this.dragState.offsetY + deltaY;
      if (this.dragState.virtualKind === 'start') {
        this.startOffset = { x: newOffsetX, y: newOffsetY };
        return;
      }
      if (this.dragState.virtualKind === 'final') {
        this.finalOffset = { x: newOffsetX, y: newOffsetY };
        return;
      }
      this.mergeOffsets = {
        ...this.mergeOffsets,
        [this.dragState.virtualId]: { x: newOffsetX, y: newOffsetY },
      };
    }
  }

  private onCanvasPointerUp(): void {
    if (!this.dragState) return;

    if (this.dragState.kind === 'connecting') {
      if (this.hoveredNodeId) {
        this.createConnection(this.dragState.sourceNodeId, this.dragState.portType, this.hoveredNodeId);
      }
      this.hoveredNodeId = null;
      this.dragState = null;
      return;
    }

    if (this.dragState.kind === 'virtual' || this.dragState.kind === 'divider') {
      this.dragState = null;
      return;
    }

    const { nodeId } = this.dragState as RealDragState;
    this.dragState = null;

    const nodeIndex = this.nodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) return;

    const nodes = [...this.nodes];
    let node = nodes[nodeIndex];
    const laneIndex = this.getLaneIndexForX(node.x);
    const actor = this.actors[laneIndex] ?? this.actors[0] ?? node.actor;
    node = { ...node, actor };
    nodes[nodeIndex] = node;
    this.nodes = [...nodes].sort((a, b) => a.y - b.y);
    this.emitStructureChange();
  }

  private createConnection(sourceId: string, portType: string, targetId: string): void {
    const edgeId = `explicit_${sourceId}_${targetId}_${Date.now()}`;
    this.explicitEdges = [...this.explicitEdges, { id: edgeId, fromId: sourceId, toId: targetId, portType }];

    this.emitStructureChange();
  }

  private renderConnectingLine() {
    if (!this.dragState || this.dragState.kind !== 'connecting') return null;
    const ds = this.dragState as ConnectingDragState;

    let startX = 0;
    let startY = 0;
    let color = '#3b82f6';

    if (ds.sourceNodeId.startsWith('virtual-')) {
      const layout = this.buildDerivedLayout();
      if (ds.sourceNodeId === 'virtual-start' && layout.startNode) {
        startX = layout.startNode.x;
        startY = layout.startNode.y + 14;
      } else if (ds.sourceNodeId === 'virtual-final' && layout.finalNode) {
        startX = layout.finalNode.x;
        startY = layout.finalNode.y - 16;
      } else if (ds.sourceNodeId.startsWith('virtual-merge-')) {
        const mId = ds.sourceNodeId.replace('virtual-merge-', '');
        const m = layout.mergeNodes.find(x => x.decisionId === mId);
        if (m) {
          startX = m.x;
          startY = m.y + this.mergeSize / 2 + 4;
        }
      }
    } else {
      const sourceNode = this.nodes.find((n) => n.id === ds.sourceNodeId);
      if (!sourceNode) return null;

      startX = sourceNode.x;
      startY = sourceNode.y;

      if (ds.portType === 'action-out') {
        startY = sourceNode.y + this.getNodeDynamicHeight(sourceNode) / 2;
      } else if (ds.portType === 'decision-yes') {
        const lines = this.wrapText((sourceNode as DecisionCanvasNode).condition || '', 18);
        startX = sourceNode.x - this.getDecisionDimensions(lines).halfW;
        color = '#059669';
      } else if (ds.portType === 'decision-no') {
        const lines = this.wrapText((sourceNode as DecisionCanvasNode).condition || '', 18);
        startX = sourceNode.x + this.getDecisionDimensions(lines).halfW;
        color = '#dc2626';
      }
    }

    return svg`
      <line x1="${startX}" y1="${startY}" x2="${ds.currentX}" y2="${ds.currentY}" stroke="${color}" stroke-width="1.8" stroke-dasharray="6 3" pointer-events="none" />
      <circle cx="${ds.currentX}" cy="${ds.currentY}" r="4" fill="${color}" pointer-events="none" />
    `;
  }

  private onDeleteSelectedEdge(): void {
    if (!this.selectedEdge) return;
    const { id } = this.selectedEdge;

    if (id.startsWith('explicit_')) {
      this.explicitEdges = this.explicitEdges.filter(e => e.id !== id);
    } else {
      if (!this.deletedEdgeIds.includes(id)) {
        this.deletedEdgeIds = [...this.deletedEdgeIds, id];
      }
    }

    this.selectedEdge = null;
    this.emitStructureChange();
  }

  // --- PANEL EDIT HANDLERS ---

  private onPanelTextChange(nodeId: string, value: string): void {
    this.nodes = this.nodes.map((n) =>
      n.id === nodeId ? { ...n, text: value } as ActionCanvasNode : n
    );
    this.emitStructureChange();
  }

  private onPanelActorChange(nodeId: string, value: string): void {
    this.nodes = this.nodes.map((n) =>
      n.id === nodeId ? { ...n, actor: value } : n
    );
    this.emitStructureChange();
  }

  private onPanelConditionChange(nodeId: string, value: string): void {
    this.nodes = this.nodes.map((n) =>
      n.id === nodeId ? { ...n, condition: value } as DecisionCanvasNode : n
    );
    this.emitStructureChange();
  }

  private onPanelYesTextChange(nodeId: string, value: string): void {
    this.nodes = this.nodes.map((n) =>
      n.id === nodeId ? { ...n, yesText: value } as DecisionCanvasNode : n
    );
    this.emitStructureChange();
  }

  private onPanelNoTextChange(nodeId: string, value: string): void {
    this.nodes = this.nodes.map((n) =>
      n.id === nodeId ? { ...n, noText: value } as DecisionCanvasNode : n
    );
    this.emitStructureChange();
  }

  private onPanelDeleteNode(nodeId: string): void {
      if (nodeId.startsWith('virtual-merge-')) {
        const decisionId = nodeId.replace('virtual-merge-', '');
        if (!this.deletedMergeIds.includes(decisionId)) {
          this.deletedMergeIds = [...this.deletedMergeIds, decisionId];
        }
        this.explicitEdges = this.explicitEdges.filter(
          (e) => e.fromId !== nodeId && e.toId !== nodeId
        );
        this.selectedNodeId = null;
        this.emitStructureChange();
        return;
      }

      const nodeToDelete = this.nodes.find((n) => n.id === nodeId);
      if (!nodeToDelete) return;

      if (nodeToDelete.type === 'action') {
        const deletedIndex = (nodeToDelete as ActionCanvasNode).actionIndex;

        let remaining = this.nodes.filter((n) => n.id !== nodeId);

        // Only re-index when the deleted node had a real actionIndex
        if (deletedIndex !== null) {
          remaining = remaining.map((n) => {
            if (n.type !== 'action') return n;
            const a = n as ActionCanvasNode;
            if (a.actionIndex === null) return n;
            if (a.actionIndex > deletedIndex) {
              return { ...a, actionIndex: a.actionIndex - 1 };
            }
            return n;
          });

          remaining = remaining.map((n) => {
            if (n.type !== 'decision') return n;
            const d = n as DecisionCanvasNode;
            const updateIndex = (idx: number | null): number | null => {
              if (idx === null) return null;
              if (idx === deletedIndex) return null;
              if (idx > deletedIndex) return idx - 1;
              return idx;
            };
            return {
              ...d,
              sourceActionIndex: updateIndex(d.sourceActionIndex),
              yesActionIndex: updateIndex(d.yesActionIndex),
              noActionIndex: updateIndex(d.noActionIndex),
            } as DecisionCanvasNode;
          });
        }

        // Clean up edges referencing the deleted action node
        this.explicitEdges = this.explicitEdges.filter(
          (e) => e.fromId !== nodeId && e.toId !== nodeId
        );

        this.nodes = remaining;

      } else if (nodeToDelete.type === 'decision' || nodeToDelete.type === 'merge') {
        this.nodes = this.nodes.filter((n) => n.id !== nodeId);
        this.explicitEdges = this.explicitEdges.filter(
          (e) => e.fromId !== nodeId && e.toId !== nodeId
        );
      }

      this.selectedNodeId = null;
      this.emitStructureChange();
    }

  // --- UTILS ---

  private syncLaneWidths(count: number): void {
      if (this.laneWidths.length === count) return;
      const w = this.getDefaultLaneWidth();
      this.laneWidths = Array.from({ length: Math.max(count, 1) }, () => w);
  }

  private getLaneWidths(count: number): number[] {
      if (this.laneWidths.length === count && count > 0) return this.laneWidths;
      const w = this.getDefaultLaneWidth();
      return Array.from({ length: Math.max(count, 1) }, () => w);
  }

  private computeLaneStartsFromWidths(widths: number[]): number[] {
    let currentX = this.lanePaddingX;
    return widths.map((width) => {
      const startX = currentX;
      currentX += width;
      return startX;
    });
  }

  private computeLaneCenters(count: number): number[] {
    const widths = this.getLaneWidths(count);
    const starts = this.computeLaneStartsFromWidths(widths);
    return widths.map((width, index) => starts[index] + width / 2);
  }

  private computeTotalWidth(count: number): number {
    const widths = this.getLaneWidths(count);
    const totalLaneWidth = widths.reduce((sum, width) => sum + width, 0);
    return this.lanePaddingX * 2 + totalLaneWidth;
  }

  private getLaneIndexForX(x: number, widths?: number[]): number {
    const effectiveWidths = widths ?? this.getLaneWidths(Math.max(this.actors.length, 1));
    const starts = this.computeLaneStartsFromWidths(effectiveWidths);

    for (let i = 0; i < effectiveWidths.length; i++) {
      const start = starts[i];
      const end = start + effectiveWidths[i];
      if (x >= start && x <= end) return i;
    }

    let bestIndex = 0;
    let bestDistance = Infinity;

    effectiveWidths.forEach((width, index) => {
      const centerX = starts[index] + width / 2;
      const distance = Math.abs(centerX - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  private onAddActionClick(): void {
      const actors = this.actors.length > 0 ? this.actors : ['Actor'];
      if (!this.actors.length) {
        this.actors = actors;
        this.syncLaneWidths(actors.length);
      }
      const { x, y } = this.getNewNodePosition();

      this.nodes = [
        ...this.nodes,
        {
          id: this.generateNodeId(),
          type: 'action',
          actor: actors[actors.length - 1],
          text: 'New action',
          x,
          y,
          actionIndex: null,
        } as ActionCanvasNode,
      ];
      this.emitStructureChange();
  }

  private onAddDecisionClick(): void {
      const actors = this.actors.length > 0 ? this.actors : ['Actor'];
      if (!this.actors.length) {
        this.actors = actors;
      }
      this.syncLaneWidths(actors.length);
      const { x, y } = this.getNewNodePosition();

      this.nodes = [
        ...this.nodes,
        {
          id: this.generateNodeId(),
          type: 'decision',
          actor: actors[actors.length - 1],
          condition: 'Decision',
          yesText: 'Yes branch',
          noText: 'No branch',
          yesActionIndex: null,
          noActionIndex: null,
          sourceActionIndex: null,
          x,
          y,
        } as DecisionCanvasNode,
      ];
      this.emitStructureChange();
  }

  private getNewNodePosition(): { x: number; y: number } {
      // Y: vertical center of the current scroll view
      const container = this.renderRoot.querySelector('.canvas-container') as HTMLElement | null;
      let y = this.laneHeaderHeight + 200;
      if (container) {
        const visibleCenterY = container.scrollTop + container.clientHeight / 2;
        y = Math.max(this.laneHeaderHeight + 60, visibleCenterY);
      }

      // X: center of the rightmost (last) swimlane
      const count = Math.max(this.actors.length, 1);
      const widths = this.getLaneWidths(count);
      const starts = this.computeLaneStartsFromWidths(widths);
      const lastIndex = widths.length - 1;
      const x = starts[lastIndex] + widths[lastIndex] + 50;

      return { x, y };
  }

    private renderLanePanel() {
    if (!this.actors.length) return null;

    return html`
      <div class="lane-panel">
        <span class="lane-panel-label">Lanes</span>
        ${this.actors.map(
          (actor, index) => html`
            <div class="lane-item">
              <input
                class="lane-name-input"
                type="text"
                .value=${actor}
                @change=${(e: Event) =>
                  this.onRenameSwimlane(index, (e.target as HTMLInputElement).value)}
                title="Rename swimlane"
              />
              <button
                class="lane-delete-btn"
                ?disabled=${this.actors.length <= 1}
                @click=${() => this.onDeleteSwimlaneClick(index)}
                title="Delete swimlane"
              >
                ×
              </button>
            </div>
          `
        )}
      </div>
    `;
  }

  private onAddSwimlaneClick(): void {
    const newName = `Lane ${this.actors.length + 1}`;
    const currentWidths = this.getLaneWidths(this.actors.length);
    this.actors = [...this.actors, newName];
    this.laneWidths = [...currentWidths, this.getDefaultLaneWidth()];
    this.emitStructureChange();
  }

  private onDeleteSwimlaneClick(index: number): void {
      if (this.actors.length <= 1) return;

      const removedActor = this.actors[index];
      const currentWidths = this.getLaneWidths(this.actors.length);
      const removedWidth = currentWidths[index];

      const newActors = this.actors.filter((_, i) => i !== index);
      const newWidths = currentWidths.filter((_, i) => i !== index);
      const newStarts = this.computeLaneStartsFromWidths(newWidths);

      const fallbackActor = newActors[0];
      const fallbackX = newStarts[0] + newWidths[0] / 2;

      this.nodes = this.nodes.map((node) => {
        // Nodes from the removed lane → move to lane 0
        if (node.actor === removedActor) {
          return { ...node, actor: fallbackActor, x: fallbackX };
        }
        // Nodes in lanes AFTER the removed one → shift left by the removed lane's width
        const actorIdx = this.actors.indexOf(node.actor);
        if (actorIdx > index) {
          return { ...node, x: node.x - removedWidth };
        }
        // Nodes in lanes BEFORE the removed one → untouched
        return node;
      });

      this.actors = newActors;
      this.laneWidths = newWidths;
      this.emitStructureChange();
    }

  private onRenameSwimlane(index: number, newName: string): void {
    const trimmed = newName.trim() || `Lane ${index + 1}`;
    const oldName = this.actors[index];

    this.nodes = this.nodes.map((node) =>
      node.actor === oldName ? { ...node, actor: trimmed } : node
    );

    const newActors = [...this.actors];
    newActors[index] = trimmed;
    this.actors = newActors;
    this.emitStructureChange();
  }

  private generateNodeId(): string {
    return `node-${Math.random().toString(36).slice(2, 9)}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ad-canvas-editor': AdCanvasEditor;
  }
}