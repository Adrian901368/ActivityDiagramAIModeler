import { LitElement, html, css, svg } from 'lit';
import { customElement, state } from 'lit/decorators.js';

type NodeType = 'action';

interface CanvasNode {
  id: string;
  type: NodeType;
  actor: string;
  text: string;
  x: number;
  y: number;
}

export interface ProcessActionDto {
  actor: string;
  action: string;
}

export interface ProcessDecisionDto {
  condition: string;
  branchyes: string;
  branchno: string;
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

interface DragState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
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
      border-radius: 16px;
      border: 1px solid rgba(55, 65, 81, 0.9);
      background: radial-gradient(circle at top left, #020617, #020617 70%);
      overflow: hidden;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid rgba(31, 41, 55, 0.9);
      background: linear-gradient(
        to right,
        rgba(15, 23, 42, 0.95),
        rgba(15, 23, 42, 0.8)
      );
    }

    .header-title {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .title {
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #9ca3af;
    }

    .subtitle {
      font-size: 11px;
      color: #6b7280;
    }

    .toolbar {
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }

    .btn {
      border-radius: 999px;
      border: 1px solid rgba(55, 65, 81, 0.9);
      background: rgba(15, 23, 42, 0.9);
      color: #e5e7eb;
      font-size: 11px;
      padding: 4px 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .btn:hover {
      border-color: #4f46e5;
      box-shadow: 0 0 14px rgba(79, 70, 229, 0.6);
    }

    .canvas-container {
      position: relative;
      width: 100%;
      height: 420px;
      background: radial-gradient(circle at top, #020617, #000000 80%);
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
      font-size: 13px;
      color: #6b7280;
      text-align: center;
      max-width: 360px;
      line-height: 1.4;
    }
  `;

  @state() private actors: string[] = [];
  @state() private nodes: CanvasNode[] = [];

  @state() private dragState: DragState | null = null;

  private laneWidth = 260;
  private lanePaddingX = 80;
  private laneHeaderHeight = 44;
  private nodeWidth = 180;
  private nodeHeight = 44;
  private nodeVerticalGap = 36;

  // ==== Public API – structure in / out ====

  public setStructure(structure: ProcessStructureInputDto | null): void {
    if (!structure) {
      this.actors = [];
      this.nodes = [];
      this.emitStructureChange();
      return;
    }

    const actors = [...new Set(structure.actors ?? [])];
    this.actors = actors;

    const nodes: CanvasNode[] = [];
    const laneCenters = this.computeLaneCenters(actors.length);
    const baseY = this.laneHeaderHeight + 40;

    (structure.actions ?? []).forEach((a, index) => {
      const laneIndex = Math.max(
        0,
        actors.findIndex((actor) => actor === a.actor),
      );
      const x = laneCenters[
        laneIndex === -1 ? 0 : laneIndex
      ];
      const y = baseY + index * (this.nodeHeight + this.nodeVerticalGap);

      nodes.push({
        id: this.generateNodeId(),
        type: 'action',
        actor: a.actor,
        text: a.action,
        x,
        y,
      });
    });

    this.nodes = nodes;
    this.emitStructureChange();
  }

  public getStructure(): ProcessStructureInputDto {
    const actors = [...new Set(this.actors)];
    const orderedNodes = [...this.nodes].sort((a, b) => a.y - b.y);

    const actions: ProcessActionDto[] = orderedNodes.map((n) => ({
      actor: n.actor,
      action: n.text,
    }));

    return {
      actors,
      actions,
      decisions: null,
      parallelblocks: null,
    };
  }

  // ==== Events ====

  private emitStructureChange(): void {
    const detail = this.getStructure();
    this.dispatchEvent(
      new CustomEvent('structure-change', {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ==== Rendering ====

  override render() {
      const laneCount = Math.max(this.actors.length, 1);
      const totalWidth =
        this.lanePaddingX * 2 + laneCount * this.laneWidth;

      // Dynamic SVG height so that all nodes fit
      const minHeight = 400;
      const baseContentHeight = this.laneHeaderHeight + 200;

      const maxNodeBottom = this.nodes.length
        ? Math.max(...this.nodes.map((n) => n.y)) + this.nodeHeight
        : baseContentHeight;

      const totalHeight = Math.max(minHeight, maxNodeBottom + 80);

      return html`
        <div class="wrapper">
          <div class="header">
            <div class="header-title">
              <div class="title">Canvas editor</div>
              <div class="subtitle">
                Drag actions between swimlanes and reorder them vertically.
              </div>
            </div>
            <div class="toolbar">
              <button class="btn" @click=${this.onAddActionClick}>
                + Add action node
              </button>
            </div>
          </div>
    
          <div
            class="canvas-container"
            @pointermove=${this.onCanvasPointerMove}
            @pointerup=${this.onCanvasPointerUp}
            @pointerleave=${this.onCanvasPointerUp}
          >
            <svg
              viewBox=${`0 0 ${totalWidth} ${totalHeight}`}
              width=${totalWidth}
              height=${totalHeight}
              @pointerdown=${this.onCanvasPointerDown}
            >
              ${this.renderSwimlanes(totalHeight)}
              ${this.renderEdges()}
              ${this.renderNodes()}
            </svg>
    
            ${this.actors.length === 0 && this.nodes.length === 0
              ? html`
                  <div class="empty-overlay">
                    <div class="empty-text">
                      No actors or actions yet. Use the structured editor or
                      backend to provide <code>actors</code> and
                      <code>actions</code>, then load them into this canvas using
                      <code>setStructure()</code>.
                    </div>
                  </div>
                `
              : null}
          </div>
        </div>
      `;
    }

  private renderSwimlanes(totalHeight: number) {
    const lanes = this.actors.length ? this.actors : ['Lane 1'];
    const laneRects = lanes.map((actor, index) => {
      const x =
        this.lanePaddingX +
        index * this.laneWidth;
      const width = this.laneWidth;
      const headerHeight = this.laneHeaderHeight;

      return svg`
        <g>
          <rect
            x=${x}
            y=${0}
            width=${width}
            height=${headerHeight}
            fill="rgba(15,23,42,0.95)"
            stroke="rgba(55,65,81,0.9)"
            stroke-width="1"
          />
          <text
            x=${x + width / 2}
            y=${headerHeight / 2 + 4}
            text-anchor="middle"
            fill="#e5e7eb"
            font-size="12"
            font-weight="500"
          >
            ${actor}
          </text>

          <line
            x1=${x}
            y1=${headerHeight}
            x2=${x}
            y2=${totalHeight}
            stroke="rgba(31,41,55,0.9)"
            stroke-width="1"
            stroke-dasharray="4 4"
          />
          <line
            x1=${x + width}
            y1=${headerHeight}
            x2=${x + width}
            y2=${totalHeight}
            stroke="rgba(31,41,55,0.9)"
            stroke-width="1"
            stroke-dasharray="4 4"
          />
        </g>
      `;
    });

    return svg`${laneRects}`;
  }

  private renderNodes() {
    const rectangles = this.nodes.map((node) => {
      const halfWidth = this.nodeWidth / 2;
      const halfHeight = this.nodeHeight / 2;
      const x = node.x - halfWidth;
      const y = node.y - halfHeight;

      return svg`
        <g
          data-node-id=${node.id}
          style="cursor: grab;"
        >
          <rect
            x=${x}
            y=${y}
            rx="10"
            ry="10"
            width=${this.nodeWidth}
            height=${this.nodeHeight}
            fill="url(#nodeGradient)"
            stroke="rgba(96,165,250,0.9)"
            stroke-width="1.4"
            filter="url(#nodeShadow)"
          ></rect>

          <text
            x=${node.x}
            y=${node.y}
            text-anchor="middle"
            dominant-baseline="middle"
            fill="#e5e7eb"
            font-size="12"
            font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          >
            ${node.text || 'New action'}
          </text>
        </g>
      `;
    });

    const defs = svg`
      <defs>
        <linearGradient id="nodeGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1d4ed8" />
          <stop offset="50%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#020617" />
        </linearGradient>
        <filter id="nodeShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow
            dx="0"
            dy="1.5"
            stdDeviation="2"
            flood-color="rgba(15,23,42,0.9)"
          />
        </filter>
      </defs>
    `;

    return svg`${defs} ${rectangles}`;
  }

  private renderEdges() {
    if (this.nodes.length < 2) {
      return null;
    }

    const ordered = [...this.nodes].sort((a, b) => a.y - b.y);
    const paths = [];

    for (let i = 0; i < ordered.length - 1; i++) {
      const from = ordered[i];
      const to = ordered[i + 1];

      const startX = from.x;
      const startY = from.y + this.nodeHeight / 2;
      const endX = to.x;
      const endY = to.y - this.nodeHeight / 2;

      const midY = (startY + endY) / 2;

      const pathD = `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;

      const arrowSize = 5;
      const arrowPath = `M ${endX} ${endY} L ${endX - arrowSize} ${
        endY - arrowSize
      } L ${endX + arrowSize} ${endY - arrowSize} Z`;

      paths.push(svg`
        <g>
          <path
            d=${pathD}
            fill="none"
            stroke="rgba(148,163,184,0.8)"
            stroke-width="1"
          ></path>
          <path
            d=${arrowPath}
            fill="rgba(148,163,184,0.9)"
          ></path>
        </g>
      `);
    }

    return svg`${paths}`;
  }

  // ==== Pointer handling for dragging ====

  private onCanvasPointerDown(event: PointerEvent): void {
    const target = event
      .composedPath()
      .find(
        (el) =>
          el instanceof SVGGElement &&
          (el as SVGGElement).dataset.nodeId,
      ) as SVGGElement | undefined;

    if (!target || !target.dataset.nodeId) {
      return;
    }

    const svgElement = this.renderRoot.querySelector(
      'svg',
    ) as SVGSVGElement | null;
    if (!svgElement) return;

    const pt = svgElement.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgP = pt.matrixTransform(
      svgElement.getScreenCTM()?.inverse(),
    );

    const id = target.dataset.nodeId;
    const node = this.nodes.find((n) => n.id === id);
    if (!node) return;

    this.dragState = {
      nodeId: id,
      offsetX: svgP.x - node.x,
      offsetY: svgP.y - node.y,
    };

    target.setPointerCapture(event.pointerId);
  }

  private onCanvasPointerMove(event: PointerEvent): void {
    if (!this.dragState) return;

    const svgElement = this.renderRoot.querySelector(
      'svg',
    ) as SVGSVGElement | null;
    if (!svgElement) return;

    const pt = svgElement.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgP = pt.matrixTransform(
      svgElement.getScreenCTM()?.inverse(),
    );

    const { nodeId, offsetX, offsetY } = this.dragState;
    const nodeIndex = this.nodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) return;

    const nodes = [...this.nodes];
    const node = nodes[nodeIndex];

    const newX = svgP.x - offsetX;
    const newY = svgP.y - offsetY;

    nodes[nodeIndex] = {
      ...node,
      x: newX,
      y: newY,
    };

    this.nodes = nodes;
  }

  private onCanvasPointerUp(): void {
    if (!this.dragState) return;

    const { nodeId } = this.dragState;
    this.dragState = null;

    const nodeIndex = this.nodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) return;

    const nodes = [...this.nodes];
    let node = nodes[nodeIndex];

    const laneIndex = this.getLaneIndexForX(node.x);
    const laneCenters = this.computeLaneCenters(
      Math.max(this.actors.length, 1),
    );
    const snappedX = laneCenters[laneIndex];

    node = {
      ...node,
      x: snappedX,
      actor: this.actors[laneIndex] ?? this.actors[0] ?? node.actor,
    };
    nodes[nodeIndex] = node;

    const sorted = [...nodes].sort((a, b) => a.y - b.y);
    this.nodes = sorted;

    this.emitStructureChange();
  }

  // ==== Helpers ====

  private computeLaneCenters(count: number): number[] {
    const centers: number[] = [];
    for (let i = 0; i < count; i++) {
      const x =
        this.lanePaddingX +
        i * this.laneWidth +
        this.laneWidth / 2;
      centers.push(x);
    }
    return centers;
  }

  private getLaneIndexForX(x: number): number {
    const count = Math.max(this.actors.length, 1);
    const laneCenters = this.computeLaneCenters(count);

    let bestIndex = 0;
    let bestDist = Infinity;

    laneCenters.forEach((cx, index) => {
      const dist = Math.abs(cx - x);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  private onAddActionClick(): void {
    const actors =
      this.actors.length > 0 ? this.actors : ['Actor'];
    if (this.actors.length === 0) {
      this.actors = actors;
    }

    const laneCenters = this.computeLaneCenters(
      Math.max(this.actors.length, 1),
    );
    const x = laneCenters[0];
    const baseY = this.laneHeaderHeight + 40;
    const y =
      baseY +
      this.nodes.length *
        (this.nodeHeight + this.nodeVerticalGap);

    const newNode: CanvasNode = {
      id: this.generateNodeId(),
      type: 'action',
      actor: actors[0],
      text: 'New action',
      x,
      y,
    };

    this.nodes = [...this.nodes, newNode];
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
