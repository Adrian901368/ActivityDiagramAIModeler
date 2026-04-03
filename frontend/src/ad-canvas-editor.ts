import { LitElement, html, css, svg, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';

type NodeType = 'action' | 'decision';
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

type CanvasNode = ActionCanvasNode | DecisionCanvasNode;

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
  portType: 'action-out' | 'decision-yes' | 'decision-no';
  currentX: number;
  currentY: number;
}

interface EdgePanelDragState {
  kind: 'edge-panel';
  startX: number;
  startY: number;
  initialOffsetX: number;
  initialOffsetY: number;
}

type DragState = RealDragState | VirtualDragState | DividerDragState | ConnectingDragState | EdgePanelDragState;

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
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
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
      gap: 4px;
      align-items: center;
    }

    .btn {
      border-radius: 999px;
      border: 1px solid #d1d5db;
      background: #ffffff;
      color: #374151;
      font-size: 10px;
      padding: 3px 7px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .btn:hover {
      background: #f9fafb;
      border-color: #9ca3af;
    }

    .canvas-container {
      position: relative;
      width: 100%;
      height: 560px;
      background: #ffffff;
      overflow: auto;
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
    
        .properties-panel {
      position: absolute;
      top: 52px;
      right: 12px;
      width: 220px;
      background: #ffffff;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.10);
      padding: 12px;
      z-index: 10;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .panel-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6b7280;
      margin-bottom: 2px;
    }
    .panel-field {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .panel-field label {
      font-size: 10px;
      color: #6b7280;
      font-weight: 500;
    }
    .panel-field input, .panel-field select {
      font-size: 11px;
      padding: 5px 8px;
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
      margin: 2px 0;
    }
    .panel-delete-btn {
      margin-top: 2px;
      padding: 5px 8px;
      font-size: 10px;
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
  `;

  @state() private actors: string[] = [];
  @state() private nodes: CanvasNode[] = [];
  @state() private dragState: DragState | null = null;
  @state() private laneWidths: number[] = [];

  @state() private startOffset: Point = { x: 0, y: 0 };
  @state() private finalOffset: Point = { x: 0, y: 0 };
  @state() private mergeOffsets: Record<string, Point> = {};

  @state() private selectedNodeId: string | null = null;

  @state() private panelOffset: Point = { x: 0, y: 0 };
  @state() private hoveredNodeId: string | null = null;
  @state() private explicitEdges: Array<{ id: string; fromId: string; toId: string; portType: string }> = [];

  @state() private selectedEdge: { id: string; fromId: string; toId: string; midX: number; midY: number } | null = null;
  @state() private edgePanelOffset: Point = { x: 0, y: 0 };

  @state() private deletedEdgeIds: string[] = [];

  private panelDrag: { startMouseX: number; startMouseY: number; startOffsetX: number; startOffsetY: number } | null = null;


  private defaultLaneWidth = 420;
  private minLaneWidth = 260;
  private lanePaddingX = 120;
  private laneHeaderHeight = 44;

  //private nodeWidth = 150;
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
    // This fixes the case where branch targets were pushed DOWN in Pass 3,
    // but subsequent sequential action nodes (e.g. "Display confirmation")
    // still have their old lower Y from Pass 1 and visually appear ABOVE the pushed branch nodes.
    const sortedByIndex = [...actionNodesByIndex.values()].sort(
      (a, b) => (a.actionIndex ?? 0) - (b.actionIndex ?? 0)
    );

    let minNextY = baseY;
    sortedByIndex.forEach((action) => {
      const h = this.getNodeDynamicHeight(action);
      // If this action ended up above the minimum safe Y, push it down
      if (action.y < minNextY) {
        action.y = minNextY;
      }
      // Next action in sequence must start below this one's bottom edge + gap
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

    // KĽÚČOVÝ FIX: Dynamický prekladač indexov.
    // Zistí, na ktorom indexe sa uzol reálne nachádza teraz, bez ohľadu na to, čo bolo predtým.
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

  private emitStructureChange(): void {
    this.isInternalChange = true; // Zaznačíme, že zmena prišla zvnútra editora
    this.dispatchEvent(
      new CustomEvent('structure-change', {
        detail: this.getStructure(),
        bubbles: true,
        composed: true,
      })
    );
    // Dáme aplikácii čas na spracovanie eventu, kým poistku uvoľníme
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
    const edgeOffset = 12; // Zrezany roh
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
    } else {
      const decisionNode = node as DecisionCanvasNode;
      const lines = this.wrapText(decisionNode.condition || 'Decision', 18);
      return this.getDecisionDimensions(lines).height;
    }
  }

  override render() {
    const laneCount = Math.max(this.actors.length, 1);
    const totalWidth = this.computeTotalWidth(laneCount);
    const layout = this.buildDerivedLayout();

    const realNodeBottom = this.nodes.length
      ? Math.max(...this.nodes.map((n) => n.y)) +
        Math.max(this.nodeHeight, this.decisionSize)
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
              Drag actions, decisions, control nodes, and swimlane dividers.
            </div>
          </div>
          <div class="toolbar">
            <button class="btn" @click=${this.onAddActionClick}>
              + Add action node
            </button>
            <button class="btn" @click=${this.onAddDecisionClick}>
              + Add decision node
            </button>
          </div>
        </div>

        <div
          class="canvas-container"
          @pointermove=${this.onCanvasPointerMove}
          @pointerup=${this.onCanvasPointerUp}
          @pointerleave=${this.onCanvasPointerUp}
          @pointerdown=${this.onCanvasPointerDown}
        >
          <svg
            viewBox=${`0 0 ${totalWidth} ${totalHeight}`}
            width=${totalWidth}
            height=${totalHeight}
            @pointerdown=${this.onCanvasPointerDown}
          >
            ${this.renderSwimlanes(totalHeight)}
            ${this.renderEdges(layout)}
            ${this.renderVirtualNodes(layout)} 
            ${this.renderConnectingLine()}
            ${this.renderNodes()}
          </svg>

          ${this.actors.length === 0 && this.nodes.length === 0
            ? html`
                <div class="empty-overlay">
                  <div class="empty-text">
                    No actors or actions yet. Load structure using
                    <code>setStructure()</code>.
                  </div>
                </div>
              `
            : null}
          ${this.renderPropertiesPanel()}
          ${this.renderEdgePanel()}  
        </div>
      </div>
    `;
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
          <rect
            x=${x}
            y=${0}
            width=${width}
            height=${headerHeight}
            fill="#ffffff"
            stroke="#d1d5db"
            stroke-width="1"
          />
          <text
            x=${x + width / 2}
            y=${headerHeight / 2 + 3}
            text-anchor="middle"
            fill="#111827"
            font-size="11"
            font-weight="500"
          >
            ${actor}
          </text>
          <line
            x1=${x}
            y1=${headerHeight}
            x2=${x}
            y2=${totalHeight}
            stroke="#111111"
            stroke-width="1"
          />
          <line
            x1=${x + width}
            y1=${headerHeight}
            x2=${x + width}
            y2=${totalHeight}
            stroke="#111111"
            stroke-width="1"
          />
        </g>
      `;
    });

    const dividerParts = widths.slice(0, -1).map((_, index) => {
      const dividerX = starts[index] + widths[index];

      return svg`
        <g
          data-divider-index=${String(index)}
          style="cursor: col-resize;"
        >
          <rect
            x=${dividerX - 8}
            y=${0}
            width="16"
            height=${totalHeight}
            fill="transparent"
          />
          <rect
            x=${dividerX - 3}
            y="8"
            width="6"
            height="28"
            rx="3"
            ry="3"
            fill="#e5e7eb"
            stroke="#9ca3af"
            stroke-width="1"
          />
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

        // Port position: bottom center of action node
        const portY = node.y + dims.height / 2;

        return svg`
          <g data-node-id="${node.id}" style="cursor: grab;">
            <rect
              x="${x}" y="${y}" rx="6" ry="6"
              width="${dims.width}" height="${dims.height}"
              fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"
            />
            <text
              x="${node.x}" y="${node.y}"
              text-anchor="middle" dominant-baseline="central"
              fill="#111827" font-size="11"
              font-family="system-ui, -apple-system, sans-serif"
            >
              ${lines.map((line, index) => svg`
                <tspan x="${node.x}" dy="${index === 0 ? startYOffset : 14}">${line}</tspan>
              `)}
            </text>

            ${isSelected ? svg`
              <circle
                data-port-type="action-out"
                data-port-node-id="${node.id}"
                cx="${node.x}" cy="${portY}"
                r="6"
                fill="#3b82f6" stroke="#ffffff" stroke-width="1.5"
                style="cursor: crosshair;"
              />
            ` : null}
          </g>
        `;
      }

      // Decision node (Hexagon)
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
        <g data-node-id="${node.id}" style="cursor: grab;">
          <polygon
            points="${points}"
            fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"
          />
          <text
            x="${node.x}" y="${node.y}"
            text-anchor="middle" dominant-baseline="central"
            fill="#111827" font-size="10" font-weight="500"
            font-family="system-ui, -apple-system, sans-serif"
          >
            ${lines.map((line, index) => svg`
              <tspan x="${node.x}" dy="${index === 0 ? startYOffset : 14}">${line}</tspan>
            `)}
          </text>

          <text
            x="${node.x - dims.halfW - 6}" y="${node.y - 12}"
            text-anchor="end" dominant-baseline="middle"
            fill="#059669" font-size="10" font-weight="bold"
          >${d.yesText || 'yes'}</text>

          <text
            x="${node.x + dims.halfW + 6}" y="${node.y - 12}"
            text-anchor="start" dominant-baseline="middle"
            fill="#dc2626" font-size="10" font-weight="bold"
          >${d.noText || 'no'}</text>

          ${isSelected ? svg`
            <!-- Yes port: left middle -->
            <circle
              data-port-type="decision-yes"
              data-port-node-id="${node.id}"
              cx="${node.x - dims.halfW}" cy="${node.y}"
              r="6"
              fill="#059669" stroke="#ffffff" stroke-width="1.5"
              style="cursor: crosshair;"
            />
            <!-- No port: right middle -->
            <circle
              data-port-type="decision-no"
              data-port-node-id="${node.id}"
              cx="${node.x + dims.halfW}" cy="${node.y}"
              r="6"
              fill="#dc2626" stroke="#ffffff" stroke-width="1.5"
              style="cursor: crosshair;"
            />
          ` : null}
        </g>
      `;
    })}`;
  }

  private renderVirtualNodes(layout: DerivedLayout) {
    const parts: unknown[] = [];

    if (layout.startNode) {
      parts.push(
        svg`
          <g
            data-virtual-kind="start"
            data-virtual-id="start"
            style="cursor: grab;"
          >
            <circle
              cx=${layout.startNode.x}
              cy=${layout.startNode.y}
              r="10"
              fill="#111111"
            />
          </g>
        `,
      );
    }

    layout.mergeNodes.forEach((merge) => {
      const half = this.mergeSize / 2;
      const points = [
        `${merge.x} ${merge.y - half}`,
        `${merge.x + half} ${merge.y}`,
        `${merge.x} ${merge.y + half}`,
        `${merge.x - half} ${merge.y}`,
      ].join(' ');

      parts.push(
        svg`
          <g
            data-virtual-kind="merge"
            data-virtual-id=${merge.decisionId}
            style="cursor: grab;"
          >
            <polygon
              points=${points}
              fill="#ffffff"
              stroke="#9ca3af"
              stroke-width="1"
            />
          </g>
        `,
      );
    });

    if (layout.finalNode) {
      parts.push(
        svg`
          <g
            data-virtual-kind="final"
            data-virtual-id="final"
            style="cursor: grab;"
          >
            <circle
              cx=${layout.finalNode.x}
              cy=${layout.finalNode.y}
              r="11"
              fill="#ffffff"
              stroke="#111111"
              stroke-width="1.5"
            />
            <circle
              cx=${layout.finalNode.x}
              cy=${layout.finalNode.y}
              r="6"
              fill="#111111"
            />
          </g>
        `,
      );
    }

    return svg`${parts}`;
  }

  private renderPropertiesPanel() {
    if (!this.selectedNodeId) return null;

    const node = this.nodes.find((n) => n.id === this.selectedNodeId);
    if (!node) return null;

    const panelWidth = 220;
    const marginY = 14; // Gap between node bottom and panel top

    // Convert SVG bottom-center of node to CSS container-relative coordinates
    const nodeH = this.getNodeDynamicHeight(node);
    const baseCss = this.svgPointToCssPoint(node.x, node.y + nodeH / 2);

    const left = baseCss.x - panelWidth / 2 + this.panelOffset.x;
    const top = baseCss.y + marginY + this.panelOffset.y;

    const panelStyle = `left: ${left}px; top: ${top}px; width: ${panelWidth}px; cursor: grab;`;

    if (node.type === 'action') {
      const actionNode = node as ActionCanvasNode;
      return html`
        <div
          class="properties-panel"
          style="${panelStyle}"
          @pointerdown="${this.onPanelPointerDown}"
          @pointermove="${this.onPanelPointerMove}"
          @pointerup="${this.onPanelPointerUp}"
        >
          <div class="panel-title">Action node</div>

          <div class="panel-field">
            <label>Label</label>
            <input
              type="text"
              .value="${actionNode.text || ''}"
              @pointerdown="${(e: Event) => e.stopPropagation()}"
              @input="${(e: Event) =>
                this.onPanelTextChange(node.id, (e.target as HTMLInputElement).value)}"
            />
          </div>

          <div class="panel-field">
            <label>Actor (Swimlane)</label>
            <select
              .value="${actionNode.actor}"
              @pointerdown="${(e: Event) => e.stopPropagation()}"
              @change="${(e: Event) =>
                this.onPanelActorChange(node.id, (e.target as HTMLSelectElement).value)}"
            >
              ${this.actors.map(
                (actor) => html`
                  <option value="${actor}" ?selected="${actor === actionNode.actor}">
                    ${actor}
                  </option>
                `
              )}
            </select>
          </div>

          <div class="panel-divider"></div>

          <div
            class="panel-delete-btn"
            @pointerdown="${(e: Event) => e.stopPropagation()}"
            @click="${() => this.onPanelDeleteNode(node.id)}"
          >
            🗑 Delete node
          </div>
        </div>
      `;
    }

    if (node.type === 'decision') {
      const decisionNode = node as DecisionCanvasNode;
      return html`
        <div
          class="properties-panel"
          style="${panelStyle}"
          @pointerdown="${this.onPanelPointerDown}"
          @pointermove="${this.onPanelPointerMove}"
          @pointerup="${this.onPanelPointerUp}"
        >
          <div class="panel-title">Decision node</div>

          <div class="panel-field">
            <label>Condition</label>
            <input
              type="text"
              .value="${decisionNode.condition || ''}"
              @pointerdown="${(e: Event) => e.stopPropagation()}"
              @input="${(e: Event) =>
                this.onPanelConditionChange(node.id, (e.target as HTMLInputElement).value)}"
            />
          </div>

          <div class="panel-field">
            <label>Yes branch label</label>
            <input
              type="text"
              .value="${decisionNode.yesText || ''}"
              @pointerdown="${(e: Event) => e.stopPropagation()}"
              @input="${(e: Event) =>
                this.onPanelYesTextChange(node.id, (e.target as HTMLInputElement).value)}"
            />
          </div>

          <div class="panel-field">
            <label>No branch label</label>
            <input
              type="text"
              .value="${decisionNode.noText || ''}"
              @pointerdown="${(e: Event) => e.stopPropagation()}"
              @input="${(e: Event) =>
                this.onPanelNoTextChange(node.id, (e.target as HTMLInputElement).value)}"
            />
          </div>

          <div class="panel-field">
            <label>Actor (Swimlane)</label>
            <select
              .value="${decisionNode.actor}"
              @pointerdown="${(e: Event) => e.stopPropagation()}"
              @change="${(e: Event) =>
                this.onPanelActorChange(node.id, (e.target as HTMLSelectElement).value)}"
            >
              ${this.actors.map(
                (actor) => html`
                  <option value="${actor}" ?selected="${actor === decisionNode.actor}">
                    ${actor}
                  </option>
                `
              )}
            </select>
          </div>

          <div class="panel-divider"></div>

          <div
            class="panel-delete-btn"
            @pointerdown="${(e: Event) => e.stopPropagation()}"
            @click="${() => this.onPanelDeleteNode(node.id)}"
          >
            🗑 Delete node
          </div>
        </div>
      `;
    }

    return null;
  }

  private buildBranchMembership(
    decisionNodes: DecisionCanvasNode[],
  ): Map<number, BranchMark> {
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

    // Converts SVG user coordinates to CSS pixel coordinates relative to .canvas-container
  private svgPointToCssPoint(svgX: number, svgY: number): Point {
    const svgEl = this.renderRoot.querySelector('svg') as SVGSVGElement | null;
    const container = this.renderRoot.querySelector('.canvas-container') as HTMLElement | null;
    if (!svgEl || !container) return { x: svgX, y: svgY };

    const pt = svgEl.createSVGPoint();
    pt.x = svgX;
    pt.y = svgY;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return { x: svgX, y: svgY };

    const screenPt = pt.matrixTransform(ctm);
    const containerRect = container.getBoundingClientRect();

    return {
      x: screenPt.x - containerRect.left + container.scrollLeft,
      y: screenPt.y - containerRect.top + container.scrollTop,
    };
  }

  private buildDerivedLayout(): DerivedLayout {
    const actionNodes = this.nodes.filter(
      (n) => n.type === 'action',
    ) as ActionCanvasNode[];

    const indexedActions = actionNodes
      .filter(
        (a): a is ActionCanvasNode & { actionIndex: number } =>
          a.actionIndex !== null,
      )
      .sort((a, b) => a.actionIndex - b.actionIndex);

    const decisionNodes = this.nodes.filter(
      (n) => n.type === 'decision',
    ) as DecisionCanvasNode[];

    const branchMembership = this.buildBranchMembership(decisionNodes);

    const decisionsBySource = new Map<number, DecisionCanvasNode[]>();
    decisionNodes.forEach((d) => {
      if (d.sourceActionIndex == null) {
        return;
      }
      const arr = decisionsBySource.get(d.sourceActionIndex) ?? [];
      arr.push(d);
      decisionsBySource.set(d.sourceActionIndex, arr);
    });

    const firstAction = indexedActions[0] ?? null;
    const startNode =
      firstAction != null
        ? {
            x: firstAction.x + this.startOffset.x,
            y:
              Math.max(
                this.laneHeaderHeight + 28,
                firstAction.y - this.startGap,
              ) + this.startOffset.y,
          }
        : null;

    const mergeNodes: MergeVisualNode[] = [];

    const findAction = (
      idx: number | null,
    ): (ActionCanvasNode & { actionIndex: number }) | null => {
      if (idx == null) {
        return null;
      }
      return indexedActions.find((a) => a.actionIndex === idx) ?? null;
    };

    const getBranchTerminal = (
      decisionId: string,
      side: BranchSide,
      fallback: (ActionCanvasNode & { actionIndex: number }) | null,
    ) => {
      const candidates = indexedActions.filter((a) => {
        const mark = branchMembership.get(a.actionIndex);
        return mark?.decisionId === decisionId && mark.side === side;
      });

      if (candidates.length) {
        return candidates[candidates.length - 1];
      }

      return fallback;
    };

    decisionNodes.forEach((decision) => {
      const yesStart = findAction(decision.yesActionIndex);
      const noStart = findAction(decision.noActionIndex);

      const yesTerminal = getBranchTerminal(decision.id, 'yes', yesStart);
      const noTerminal = getBranchTerminal(decision.id, 'no', noStart);

      if (!yesTerminal || !noTerminal) {
        return;
      }

      const maxTerminalY = Math.max(yesTerminal.y, noTerminal.y);
      const maxTerminalIndex = Math.max(
        yesTerminal.actionIndex,
        noTerminal.actionIndex,
      );

      const nextAction =
        indexedActions.find((a) => {
          if (a.actionIndex <= maxTerminalIndex) {
            return false;
          }
          const mark = branchMembership.get(a.actionIndex);
          return !mark;
        }) ?? null;

      const mergeBaseX = (yesTerminal.x + noTerminal.x) / 2;
      const mergeBaseY = maxTerminalY + this.mergeGap;
      const mergeOffset = this.getMergeOffset(decision.id);

      mergeNodes.push({
        decisionId: decision.id,
        x: mergeBaseX + mergeOffset.x,
        y: mergeBaseY + mergeOffset.y,
        yesTerminal,
        noTerminal,
        nextAction,
      });
    });

    let finalNode: FinalVisualNode | null = null;

    const bottomOpenMerge =
      [...mergeNodes]
        .filter((m) => m.nextAction == null)
        .sort((a, b) => b.y - a.y)[0] ?? null;

    if (bottomOpenMerge) {
      finalNode = {
        x: bottomOpenMerge.x + this.finalOffset.x,
        y: bottomOpenMerge.y + this.finalGap + this.finalOffset.y,
      };
    } else if (indexedActions.length) {
      const lastAction = indexedActions[indexedActions.length - 1];
      finalNode = {
        x: lastAction.x + this.finalOffset.x,
        y: lastAction.y + this.finalGap + 20 + this.finalOffset.y,
      };
    }

    return {
      actionNodes,
      indexedActions,
      decisionNodes,
      branchMembership,
      decisionsBySource,
      startNode,
      mergeNodes,
      finalNode,
    };
  }

  private buildArrowPath(endX: number, endY: number, direction: 'up' | 'down' | 'left' | 'right'): string {
    const a = 4;
    if (direction === 'down') return `M ${endX} ${endY} L ${endX - a} ${endY - a} L ${endX + a} ${endY - a} Z`;
    if (direction === 'up') return `M ${endX} ${endY} L ${endX - a} ${endY + a} L ${endX + a} ${endY + a} Z`;
    if (direction === 'left') return `M ${endX} ${endY} L ${endX + a} ${endY - a} L ${endX + a} ${endY + a} Z`;
    return `M ${endX} ${endY} L ${endX - a} ${endY - a} L ${endX - a} ${endY + a} Z`; // right
  }

  private renderPolylineEdge(
    points: Point[],
    direction: 'up' | 'down' | 'left' | 'right',
    edgeMeta?: { id: string; fromId: string; toId: string }
  ) {
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
                  this.edgePanelOffset = { x: 0, y: 0 };
                }}" />
        ` : ''}
      </g>
    `;
  }

  private edgeStraight(x1: number, y1: number, x2: number, y2: number, edgeMeta?: { id: string; fromId: string; toId: string }) {
    const midY = (y1 + y2) / 2;
    return this.renderPolylineEdge(
      [{ x: x1, y: y1 }, { x: x1, y: midY }, { x: x2, y: midY }, { x: x2, y: y2 }],
      y2 >= midY ? 'down' : 'up',
      edgeMeta
    );
  }

  private edgeBranch(startX: number, startY: number, endX: number, endY: number, edgeMeta?: { id: string; fromId: string; toId: string }) {
    return this.renderPolylineEdge(
      [{ x: startX, y: startY }, { x: endX, y: startY }, { x: endX, y: endY }],
      endY >= startY ? 'down' : 'up',
      edgeMeta
    );
  }

  private edgeToMerge(startX: number, startY: number, mergeX: number, mergeY: number, edgeMeta?: { id: string; fromId: string; toId: string }) {
    const half = this.mergeSize / 2;
    if (startX < mergeX) {
      return this.renderPolylineEdge([{ x: startX, y: startY }, { x: startX, y: mergeY }, { x: mergeX - half, y: mergeY }], 'right', edgeMeta);
    }
    if (startX > mergeX) {
      return this.renderPolylineEdge([{ x: startX, y: startY }, { x: startX, y: mergeY }, { x: mergeX + half, y: mergeY }], 'left', edgeMeta);
    }
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
      if (node.type === 'action') {
        return typeof (this as any).getNodeDynamicHeight === 'function'
          ? (this as any).getNodeDynamicHeight(node)
          : this.nodeHeight;
      }
      if (node.type === 'decision') return this.decisionSize;
      return this.nodeHeight;
    };

    // Pomocná funkcia: Ak hrana bola zmazaná používateľom, ignoruj ju.
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

    // Explicitné voľné hrany (draw.io štýl)
    if (this.explicitEdges) {
      this.explicitEdges.forEach((edge) => {
        const fromNode = this.nodes.find((n) => n.id === edge.fromId);
        const toNode = this.nodes.find((n) => n.id === edge.toId);
        if (!fromNode || !toNode) return;

        const fromH = getH(fromNode);
        const toH = getH(toNode);

        if (fromNode.type === 'decision' && edge.portType === 'decision-yes') {
          paths.push(this.edgeBranch(fromNode.x - this.decisionSize / 2, fromNode.y, toNode.x, toNode.y - toH / 2, { id: edge.id, fromId: edge.fromId, toId: edge.toId }));
        } else if (fromNode.type === 'decision' && edge.portType === 'decision-no') {
          paths.push(this.edgeBranch(fromNode.x + this.decisionSize / 2, fromNode.y, toNode.x, toNode.y - toH / 2, { id: edge.id, fromId: edge.fromId, toId: edge.toId }));
        } else {
          paths.push(this.edgeStraight(fromNode.x, fromNode.y + fromH / 2, toNode.x, toNode.y - toH / 2, { id: edge.id, fromId: edge.fromId, toId: edge.toId }));
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

  private onCanvasPointerDown(event: PointerEvent): void {
      // Zachytenie potiahnutia edge panelu
    const edgePanelTarget = event.composedPath().find((el) => el instanceof HTMLElement && el.dataset.edgePanel !== undefined) as HTMLElement | undefined;
    if (edgePanelTarget) {
      // Ak sme klikli na button, nechceme zacat drag panela, chceme povolit click
      const isButton = event.composedPath().some(el => el instanceof HTMLButtonElement || (el instanceof HTMLElement && el.tagName.toLowerCase() === 'button'));
      if (isButton) {
        return; // Prepusti event az na @click handler tlacidla
      }

      this.dragState = {
        kind: 'edge-panel',
        startX: event.clientX,
        startY: event.clientY,
        initialOffsetX: this.edgePanelOffset.x,
        initialOffsetY: this.edgePanelOffset.y,
      } as EdgePanelDragState;
      edgePanelTarget.setPointerCapture(event.pointerId);
      return;
    }

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

      // Capture on SVG (not the port circle) so re-renders don't lose the capture
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

      if (this.selectedNodeId !== id) {
        this.panelOffset = { x: 0, y: 0 };
      }
      this.selectedNodeId = id;

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
        const laneWidth = widths[laneIndex] ?? widths[0] ?? this.defaultLaneWidth;
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
        const laneWidth = nextWidths[tracked.laneIndex] ?? nextWidths[0] ?? this.defaultLaneWidth;
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

      // action-out can target BOTH action and decision nodes
      // decision-yes / decision-no can only target action nodes
      const validTargetTypes: string[] =
        portType === 'action-out' ? ['action', 'decision'] : ['action'];

      const hovered = this.nodes.find((n) => {
        if (n.id === sourceNodeId) return false;
        if (!validTargetTypes.includes(n.type)) return false;
        const h = this.getNodeDynamicHeight(n);
        let halfW = 60;
        if (n.type === 'action') {
          const lines = this.wrapText((n as ActionCanvasNode).text || '', 22);
          halfW = this.getActionDimensions(lines).width / 2;
        } else {
          const lines = this.wrapText((n as DecisionCanvasNode).condition || '', 18);
          halfW = this.getDecisionDimensions(lines).halfW;
        }
        return (
          svgPoint.x >= n.x - halfW - 12 &&
          svgPoint.x <= n.x + halfW + 12 &&
          svgPoint.y >= n.y - h / 2 - 12 &&
          svgPoint.y <= n.y + h / 2 + 12
        );
      });

      this.hoveredNodeId = hovered?.id ?? null;
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

    if (this.dragState.kind === 'edge-panel') {
      const deltaX = event.clientX - this.dragState.startX;
      const deltaY = event.clientY - this.dragState.startY;
      this.edgePanelOffset = {
        x: (this.dragState as any).initialOffsetX + deltaX,
        y: (this.dragState as any).initialOffsetY + deltaY
      };
      return;
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

  private createConnection(
    sourceId: string,
    portType: ConnectingDragState['portType'],
    targetId: string
  ): void {
    const sourceNode = this.nodes.find((n) => n.id === sourceId);
    const targetNode = this.nodes.find((n) => n.id === targetId);
    if (!sourceNode || !targetNode) return;

    const edgeId = `explicit_${sourceId}_${targetId}_${Date.now()}`;
    this.explicitEdges = [...this.explicitEdges, { id: edgeId, fromId: sourceId, toId: targetId, portType }];

    this.emitStructureChange();
  }

  private renderConnectingLine() {
    if (!this.dragState || this.dragState.kind !== 'connecting') return null;
    const ds = this.dragState as ConnectingDragState;
    const sourceNode = this.nodes.find((n) => n.id === ds.sourceNodeId);
    if (!sourceNode) return null;

    let startX = sourceNode.x;
    let startY = sourceNode.y;

    if (ds.portType === 'action-out') {
      startY = sourceNode.y + this.getNodeDynamicHeight(sourceNode) / 2;
    } else if (ds.portType === 'decision-yes') {
      const lines = this.wrapText((sourceNode as DecisionCanvasNode).condition || '', 18);
      startX = sourceNode.x - this.getDecisionDimensions(lines).halfW;
    } else if (ds.portType === 'decision-no') {
      const lines = this.wrapText((sourceNode as DecisionCanvasNode).condition || '', 18);
      startX = sourceNode.x + this.getDecisionDimensions(lines).halfW;
    }

    const color = ds.portType === 'action-out' ? '#3b82f6'
      : ds.portType === 'decision-yes' ? '#059669'
      : '#dc2626';

    return svg`
      <line
        x1="${startX}" y1="${startY}"
        x2="${ds.currentX}" y2="${ds.currentY}"
        stroke="${color}"
        stroke-width="1.8"
        stroke-dasharray="6 3"
        pointer-events="none"
      />
      <circle cx="${ds.currentX}" cy="${ds.currentY}" r="4" fill="${color}" pointer-events="none" />
    `;
  }

    private renderEdgePanel(): TemplateResult | null {
    if (!this.selectedEdge) return null;
    const x = this.selectedEdge.midX + this.edgePanelOffset.x + 20;
    const y = this.selectedEdge.midY + this.edgePanelOffset.y - 20;

    return html`
      <div data-edge-panel
           style="position: absolute; left: ${x}px; top: ${y}px; background: white; border: 1px solid #d1d5db; border-radius: 8px; padding: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 10; display: flex; cursor: grab; user-select: none;">
        <button @click="${this.onDeleteSelectedEdge}"
                style="display: flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid #fca5a5; background: #fee2e2; color: #dc2626; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
          Delete
        </button>
      </div>
    `;
  }

  private onDeleteSelectedEdge(): void {
    if (!this.selectedEdge) return;
    const { id } = this.selectedEdge;

    if (id.startsWith('explicit_')) {
      // Zmazanie manuálne nakreslenej (voľnej) hrany
      this.explicitEdges = this.explicitEdges.filter(e => e.id !== id);
    } else {
      // Zmazanie akejkoľvek inej (automatickej) hrany
      if (!this.deletedEdgeIds.includes(id)) {
        this.deletedEdgeIds = [...this.deletedEdgeIds, id];
      }
    }

    this.selectedEdge = null;
    this.emitStructureChange();
  }

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
    const nodeToDelete = this.nodes.find((n) => n.id === nodeId);
    if (!nodeToDelete) return;

    if (nodeToDelete.type === 'action') {
      const deletedIndex = (nodeToDelete as ActionCanvasNode).actionIndex;

      // Remove the node
      let remaining = this.nodes.filter((n) => n.id !== nodeId);

      // Reindex all remaining action nodes that had a higher actionIndex
      remaining = remaining.map((n) => {
        if (n.type !== 'action') return n;
        const a = n as ActionCanvasNode;
        if (a.actionIndex === null) return n;
        if (a.actionIndex > (deletedIndex ?? -1)) {
          return { ...a, actionIndex: a.actionIndex - 1 };
        }
        return n;
      });

      // Update all decision node references to reflect the reindexing
      remaining = remaining.map((n) => {
        if (n.type !== 'decision') return n;
        const d = n as DecisionCanvasNode;

        const updateIndex = (idx: number | null): number | null => {
          if (idx === null) return null;
          if (idx === deletedIndex) return null; // Reference to deleted node → nullify
          if (deletedIndex !== null && idx > deletedIndex) return idx - 1; // Shift down
          return idx;
        };

        const newSourceActionIndex = updateIndex(d.sourceActionIndex);
        const newYesActionIndex = updateIndex(d.yesActionIndex);
        const newNoActionIndex = updateIndex(d.noActionIndex);

        return {
          ...d,
          sourceActionIndex: newSourceActionIndex,
          yesActionIndex: newYesActionIndex,
          noActionIndex: newNoActionIndex,
        } as DecisionCanvasNode;
      });

      this.nodes = remaining;

    } else if (nodeToDelete.type === 'decision') {
      // Remove decision node - branch action nodes stay but lose their branch positioning
      this.nodes = this.nodes.filter((n) => n.id !== nodeId);
          // Clean up explicit edges involving the deleted node
        this.explicitEdges = this.explicitEdges.filter(
        (e) => e.fromId !== nodeId && e.toId !== nodeId
    );
    }

    this.selectedNodeId = null;
    this.panelOffset = { x: 0, y: 0 };
    this.emitStructureChange();
  }

    private onPanelPointerDown(e: PointerEvent): void {
    e.stopPropagation(); // Prevent canvas deselection
    this.panelDrag = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startOffsetX: this.panelOffset.x,
      startOffsetY: this.panelOffset.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  private onPanelPointerMove(e: PointerEvent): void {
    if (!this.panelDrag) return;
    e.stopPropagation();
    this.panelOffset = {
      x: this.panelDrag.startOffsetX + (e.clientX - this.panelDrag.startMouseX),
      y: this.panelDrag.startOffsetY + (e.clientY - this.panelDrag.startMouseY),
    };
  }

  private onPanelPointerUp(e: PointerEvent): void {
    e.stopPropagation();
    this.panelDrag = null;
  }

  private syncLaneWidths(count: number): void {
    if (this.laneWidths.length === count) {
      return;
    }

    this.laneWidths = Array.from(
      { length: Math.max(count, 1) },
      () => this.defaultLaneWidth,
    );
  }

  private getLaneWidths(count: number): number[] {
    if (this.laneWidths.length === count && count > 0) {
      return this.laneWidths;
    }

    return Array.from(
      { length: Math.max(count, 1) },
      () => this.defaultLaneWidth,
    );
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
    const effectiveWidths =
      widths ?? this.getLaneWidths(Math.max(this.actors.length, 1));
    const starts = this.computeLaneStartsFromWidths(effectiveWidths);

    for (let i = 0; i < effectiveWidths.length; i++) {
      const start = starts[i];
      const end = start + effectiveWidths[i];
      if (x >= start && x <= end) {
        return i;
      }
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
    const laneCenters = this.computeLaneCenters(Math.max(actors.length, 1));
    const y = this.laneHeaderHeight + 80 + this.nodes.length * (this.nodeHeight + this.nodeVerticalGap);

    // actionIndex is null — node is unconnected until user explicitly connects it via port drag
    this.nodes = [
      ...this.nodes,
      {
        id: this.generateNodeId(),
        type: 'action',
        actor: actors[0],
        text: 'New action',
        x: laneCenters[0],
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

    const laneCenters = this.computeLaneCenters(Math.max(actors.length, 1));
    const y =
      this.laneHeaderHeight +
      80 +
      this.nodes.length * (this.nodeHeight + this.nodeVerticalGap);

    this.nodes = [
      ...this.nodes,
      {
        id: this.generateNodeId(),
        type: 'decision',
        actor: actors[0],
        condition: 'Decision',
        yesText: 'Yes branch',
        noText: 'No branch',
        yesActionIndex: null,
        noActionIndex: null,
        sourceActionIndex: null,
        x: laneCenters[0],
        y,
      } as DecisionCanvasNode,
    ];

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
