// app/frontend/src/ad-public-catalog-view.ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './ad-canvas-editor';

interface PublicCatalogVersion {
  id: number;
  version_number: number;
  version_name: string;
  version_description: string | null;
  status: string;
  created_at: string;
  llm_model: string;
  plantuml_code: string;
  image_path: string | null;
  canvas_state: Record<string, unknown> | null;
  prompt: Record<string, unknown> | null;
}

interface PublicCatalogProcess {
  id: number;
  name: string;
  domain: string | null;
  description: string | null;
  owner_email: string;
  versions: PublicCatalogVersion[];
}

interface PublicCatalogListItem {
  id: number;
  name: string;
  domain: string | null;
  description: string | null;
  owner_email: string;
  versions_count: number;
}

type CloneMode = 'all_versions' | 'active_only';

@customElement('ad-public-catalog-view')
export class AdPublicCatalogView extends LitElement {
  static override styles = css`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.6fr);
      gap: 24px;
      align-items: flex-start;
    }

    @media (max-width: 900px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .card {
      background: radial-gradient(circle at top left, #1e293b, #020617 70%);
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      padding: 18px 18px 16px;
      box-shadow:
        0 18px 45px rgba(15, 23, 42, 0.6),
        0 0 0 1px rgba(15, 23, 42, 0.8);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .card.public-accent {
      border-color: rgba(56, 189, 248, 0.15);
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 4px;
    }

    .card-title {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #9ca3af;
    }

    .card-subtitle {
      font-size: 12px;
      color: #6b7280;
    }
      
    .filters {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 6px;
    }

    @media (max-width: 900px) {
      .filters {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    label {
      font-size: 12px;
      font-weight: 500;
      color: #d1d5db;
      display: inline-block;
      margin-bottom: 3px;
    }

    input[type='text'] {
      width: 100%;
      background: rgba(15, 23, 42, 0.8);
      border-radius: 10px;
      border: 1px solid rgba(55, 65, 81, 0.9);
      color: #e5e7eb;
      font-family: inherit;
      font-size: 13px;
      padding: 7px 9px;
      box-sizing: border-box;
      outline: none;
      transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease,
        background 0.15s ease;
    }

    input[type='text']:focus {
      border-color: #0284c7;
      box-shadow:
        0 0 0 1px rgba(2, 132, 199, 0.8),
        0 0 18px rgba(56, 189, 248, 0.3);
      background: rgba(15, 23, 42, 0.95);
    }

    .process-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 480px;
      overflow: auto;
    }

    .process-item {
      padding: 9px 10px;
      border-radius: 10px;
      cursor: pointer;
      transition:
        background 0.12s ease,
        transform 0.08s ease,
        border-color 0.12s ease;
      border: 1px solid transparent;
    }

    .process-item:hover {
      background: rgba(15, 23, 42, 0.9);
      border-color: rgba(55, 65, 81, 0.9);
      transform: translateY(-1px);
    }

    .process-item.selected {
      background: rgba(15, 23, 42, 0.9);
      border-color: #0284c7;
    }

    .process-name {
      font-size: 13px;
      font-weight: 500;
      color: #e5e7eb;
    }

    .process-meta {
      font-size: 11px;
      color: #6b7280;
      margin-top: 2px;
    }

    .owner-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.08);
      border: 1px solid rgba(56, 189, 248, 0.2);
      border-radius: 999px;
      padding: 1px 7px;
      margin-top: 4px;
    }

    .placeholder {
      font-size: 13px;
      color: #6b7280;
      padding: 18px 14px;
      text-align: left;
    }

    .placeholder.small {
      padding: 10px 8px;
      font-size: 12px;
    }

    .error {
      font-size: 13px;
      color: #fecaca;
      background: rgba(153, 27, 27, 0.4);
      border-radius: 10px;
      padding: 8px 10px;
      border: 1px solid rgba(248, 113, 113, 0.7);
      margin-top: 6px;
    }

    .success-banner {
      font-size: 13px;
      color: #bbf7d0;
      background: rgba(21, 128, 61, 0.25);
      border-radius: 10px;
      padding: 8px 10px;
      border: 1px solid rgba(34, 197, 94, 0.4);
      margin-top: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    button {
      border-radius: 999px;
      border: none;
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      padding: 7px 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition:
        transform 0.12s ease,
        box-shadow 0.12s ease,
        background 0.12s ease,
        opacity 0.12s ease;
    }

    button.secondary {
      background: rgba(15, 23, 42, 0.75);
      color: #9ca3af;
      border: 1px solid rgba(55, 65, 81, 0.9);
    }

    button.secondary:hover {
      background: rgba(15, 23, 42, 0.95);
    }

    button.blue {
      background: rgba(2, 106, 168, 0.25);
      color: #7dd3fc;
      border: 1px solid rgba(56, 189, 248, 0.4);
    }

    button.blue:hover {
      background: rgba(2, 106, 168, 0.45);
    }

    button.green {
      background: rgba(21, 128, 61, 0.25);
      color: #86efac;
      border: 1px solid rgba(34, 197, 94, 0.4);
    }

    button.green:hover {
      background: rgba(21, 128, 61, 0.45);
    }

    button.danger {
      background: rgba(153, 27, 27, 0.25);
      color: #fca5a5;
      border: 1px solid rgba(248, 113, 113, 0.4);
    }

    button.danger:hover {
      background: rgba(153, 27, 27, 0.5);
    }

    button:disabled {
      opacity: 0.5;
      cursor: default;
      transform: none;
    }

    .actions-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: 8px;
      flex-wrap: wrap;
    }

    .detail-actions-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 10px;
    }

    .status {
      font-size: 12px;
      color: #6b7280;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      margin-right: 6px;
      display: inline-block;
      background: #38bdf8;
      box-shadow: 0 0 12px rgba(56, 189, 248, 0.6);
    }

    .status-dot.pending {
      background: #fbbf24;
      box-shadow: 0 0 12px rgba(251, 191, 36, 0.6);
    }

    .status-dot.error {
      background: #f87171;
      box-shadow: 0 0 12px rgba(248, 113, 113, 0.7);
    }

    .versions-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
      flex-wrap: wrap;
    }

    .versions-title {
      font-size: 14px;
      font-weight: 500;
      color: #d1d5db;
    }

    .pill {
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(55, 65, 81, 0.9);
      color: #9ca3af;
    }

    .pill.blue {
      border-color: rgba(56, 189, 248, 0.3);
      color: #7dd3fc;
      background: rgba(56, 189, 248, 0.06);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      color: #e5e7eb;
    }

    thead {
      background: rgba(15, 23, 42, 0.9);
    }

    th,
    td {
      padding: 6px 8px;
      border-bottom: 1px solid rgba(31, 41, 55, 0.9);
      text-align: left;
    }

    th {
      font-weight: 500;
      color: #9ca3af;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    tr:last-child td {
      border-bottom: none;
    }

    .version-status {
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.06em;
      padding: 2px 6px;
      border-radius: 999px;
      border: 1px solid rgba(55, 65, 81, 0.9);
      background: rgba(15, 23, 42, 0.9);
    }

    .version-status.active {
      border-color: #22c55e;
      color: #bbf7d0;
    }

    .version-status.archived {
      border-color: #6b7280;
      color: #e5e7eb;
    }

    .tiny-btn {
      font-size: 11px;
      padding: 3px 7px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(55, 65, 81, 0.9);
      color: #9ca3af;
      cursor: pointer;
      transition:
        background 0.12s ease,
        border-color 0.12s ease;
    }

    .tiny-btn:hover {
      background: rgba(15, 23, 42, 0.95);
      border-color: #0284c7;
      color: #7dd3fc;
    }

    pre {
      margin: 0;
      padding: 10px 11px;
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(31, 41, 55, 0.9);
      color: #e5e7eb;
      font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo,
        Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      font-size: 12px;
      max-height: 260px;
      overflow: auto;
      white-space: pre;
      line-height: 1.45;
      margin-top: 8px;
    }

    .readonly-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #7dd3fc;
      background: rgba(56, 189, 248, 0.06);
      border: 1px solid rgba(56, 189, 248, 0.18);
      border-radius: 10px;
      padding: 7px 12px;
    }

    .readonly-banner-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #38bdf8;
      box-shadow: 0 0 8px rgba(56, 189, 248, 0.7);
      flex-shrink: 0;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 48px 24px;
      text-align: center;
    }

    .empty-state-icon {
      font-size: 36px;
      opacity: 0.35;
    }

    .empty-state-title {
      font-size: 15px;
      font-weight: 500;
      color: #d1d5db;
    }

    .empty-state-desc {
      font-size: 13px;
      color: #6b7280;
      max-width: 36ch;
      line-height: 1.5;
    }

    .process-description-box {
      font-size: 13px;
      color: #9ca3af;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(55, 65, 81, 0.7);
      border-radius: 8px;
      padding: 8px 10px;
      margin-top: 10px;
      margin-bottom: 2px;
      line-height: 1.5;
    }

    .not-logged-in {
      font-size: 13px;
      color: #fbbf24;
      background: rgba(120, 80, 0, 0.3);
      border: 1px solid rgba(251, 191, 36, 0.4);
      border-radius: 10px;
      padding: 10px 14px;
      margin-top: 4px;
    }

    /* Modals */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(2, 6, 23, 0.75);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: radial-gradient(circle at top left, #1e293b, #020617 70%);
      border-radius: 18px;
      padding: 28px 28px 24px;
      width: min(460px, 90vw);
      box-shadow:
        0 24px 60px rgba(15, 23, 42, 0.8),
        0 0 0 1px rgba(15, 23, 42, 0.9);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .modal.modal-delete {
      border: 1px solid rgba(248, 113, 113, 0.3);
    }

    .modal.modal-clone {
      border: 1px solid rgba(34, 197, 94, 0.25);
    }

    .modal-title {
      font-size: 18px;
      font-weight: 600;
    }

    .modal-title.delete {
      color: #fca5a5;
    }

    .modal-title.clone {
      color: #86efac;
    }

    .modal-body {
      font-size: 13px;
      color: #9ca3af;
      line-height: 1.6;
    }

    .modal-body strong {
      color: #e5e7eb;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 4px;
    }

    /* Clone option cards */
    .clone-options {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .clone-option {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid rgba(55, 65, 81, 0.9);
      background: rgba(15, 23, 42, 0.5);
      cursor: pointer;
      transition:
        border-color 0.15s ease,
        background 0.15s ease;
      text-align: left;
      width: 100%;
    }

    .clone-option:hover:not(:disabled) {
      border-color: rgba(34, 197, 94, 0.5);
      background: rgba(21, 128, 61, 0.12);
    }

    .clone-option:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .clone-option-icon {
      font-size: 22px;
      line-height: 1;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .clone-option-content {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .clone-option-title {
      font-size: 13px;
      font-weight: 600;
      color: #e5e7eb;
    }

    .clone-option-desc {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.5;
    }

    .clone-option-badge {
      display: inline-flex;
      align-items: center;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 999px;
      margin-top: 3px;
      width: fit-content;
    }

    .clone-option-badge.all {
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: #7dd3fc;
    }

    .clone-option-badge.active {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #86efac;
    }

    .clone-option-badge.warn {
      background: rgba(251, 191, 36, 0.1);
      border: 1px solid rgba(251, 191, 36, 0.3);
      color: #fde68a;
    }

    .clone-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 13px;
      color: #86efac;
      padding: 8px 0;
    }
  `;

  @property({ type: String }) userEmail = '';

  @state() private nameFilter = '';
  @state() private ownerFilter = '';
  @state() private domainFilter = ''; // ADDED

  @state() private processes: PublicCatalogListItem[] = [];
  @state() private isLoadingProcesses = false;
  @state() private processesError = '';

  @state() private selectedProcessId: number | null = null;
  @state() private processDetail: PublicCatalogProcess | null = null;
  @state() private isLoadingDetail = false;
  @state() private detailError = '';

  @state() private expandedVersionId: number | null = null;
  @state() private isDetailCodeExpanded = false;

  // Clone state
  @state() private showCloneModal = false;
  @state() private isCloningProcess = false;
  @state() private cloneError = '';
  @state() private cloneSuccessMessage = '';

  // Delete state
  @state() private isDeletingProcess = false;
  @state() private deleteError = '';
  @state() private showDeleteConfirm = false;

  // ---------------------------------------------------------------------------
  // Auth header helper
  // ---------------------------------------------------------------------------

  private get authHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-User-Email': this.userEmail,
    };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  override firstUpdated(): void {
    if (this.userEmail) {
      this.loadProcesses();
    }
  }

  override updated(changedProperties: Map<string, unknown>): void {
    super.updated(changedProperties);

    if (changedProperties.has('userEmail') && this.userEmail) {
      this.loadProcesses();
    }

    if (
      changedProperties.has('expandedVersionId') &&
      this.expandedVersionId !== null
    ) {
      const v = this.processDetail?.versions.find(
        (ver) => ver.id === this.expandedVersionId
      );
      if (!v) return;

      requestAnimationFrame(() => {
        const canvas = this.renderRoot?.querySelector(
          `ad-canvas-editor[data-version-id="${this.expandedVersionId}"]`
        ) as any;
        if (!canvas) return;

        if (v.canvas_state && typeof canvas.setFullState === 'function') {
          canvas.setFullState(v.canvas_state);
        } else if (v.prompt && typeof canvas.setStructure === 'function') {
          this.populateCanvas(canvas, v.prompt);
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  private async loadProcesses(): Promise<void> {
    if (!this.userEmail) {
      this.processesError = 'Not logged in — cannot load public catalog.';
      return;
    }

    this.isLoadingProcesses = true;
    this.processesError = '';

    const params = new URLSearchParams();
    if (this.nameFilter.trim()) params.append('name', this.nameFilter.trim());
    if (this.ownerFilter.trim()) params.append('owner', this.ownerFilter.trim());
    if (this.domainFilter.trim()) params.append('domain', this.domainFilter.trim()); // ADDED

    const qs = params.toString();
    const url = qs
      ? `http://localhost:8000/api/v1/catalog/public?${qs}`
      : 'http://localhost:8000/api/v1/catalog/public';

    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: this.authHeaders,
      });

      if (!resp.ok) throw new Error(`Backend returned status ${resp.status}`);

      const data = (await resp.json()) as PublicCatalogListItem[];
      this.processes = [...data].sort((a, b) => b.id - a.id);

      if (this.processes.length > 0 && this.selectedProcessId === null) {
        this.onSelectProcess(this.processes[0]);
      } else if (
        this.selectedProcessId !== null &&
        !this.processes.some((p) => p.id === this.selectedProcessId)
      ) {
        this.selectedProcessId = null;
        this.processDetail = null;
      }
    } catch (error: unknown) {
      console.error('Failed to load public processes', error);
      this.processesError =
        error instanceof Error
          ? `Failed to load public processes: ${error.message}`
          : 'Failed to load public processes.';
    } finally {
      this.isLoadingProcesses = false;
    }
  }

  private async loadProcessDetail(processId: number): Promise<void> {
    if (!this.userEmail) return;

    this.isLoadingDetail = true;
    this.detailError = '';
    this.processDetail = null;
    this.expandedVersionId = null;
    this.isDetailCodeExpanded = false;
    this.cloneError = '';
    this.cloneSuccessMessage = '';
    this.deleteError = '';
    this.showDeleteConfirm = false;
    this.showCloneModal = false;

    try {
      const resp = await fetch(
        `http://localhost:8000/api/v1/catalog/public/${processId}`,
        {
          method: 'GET',
          headers: this.authHeaders,
        }
      );

      if (!resp.ok) throw new Error(`Backend returned status ${resp.status}`);

      const data = (await resp.json()) as PublicCatalogProcess;
      this.processDetail = data;
    } catch (error: unknown) {
      console.error('Failed to load public process detail', error);
      this.detailError =
        error instanceof Error
          ? `Failed to load process detail: ${error.message}`
          : 'Failed to load process detail.';
    } finally {
      this.isLoadingDetail = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Canvas helper
  // ---------------------------------------------------------------------------

  private populateCanvas(canvas: any, prompt: any): void {
    if (!prompt) return;
    try {
      const parsed = typeof prompt === 'string' ? JSON.parse(prompt) : prompt;

      if (parsed.nodes || parsed.edges) {
        canvas.setStructure(parsed);
        return;
      }

      if (Array.isArray(parsed.actors) && Array.isArray(parsed.actions)) {
        canvas.setStructure({
          actors: parsed.actors as string[],
          actions: (parsed.actions as any[]).map((a: any) => ({
            actor: a.actor,
            action: a.action,
          })),
          decisions: Array.isArray(parsed.decisions)
            ? (parsed.decisions as any[]).map((d: any) => ({
                condition: d.condition,
                branchyes: d.branch_yes ?? d.branchyes ?? 'Yes',
                branchno: d.branch_no ?? d.branchno ?? 'No',
                yes_action_index: d.yes_action_index ?? null,
                no_action_index: d.no_action_index ?? null,
              }))
            : null,
          parallelblocks: null,
        });
      }
    } catch (e) {
      console.warn('populateCanvas: failed to parse or apply structure', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Clone handlers
  // ---------------------------------------------------------------------------

  private onCloneClick(): void {
    this.cloneError = '';
    this.cloneSuccessMessage = '';
    this.showCloneModal = true;
  }

  private onCancelClone(): void {
    this.showCloneModal = false;
    this.cloneError = '';
  }

  private async onConfirmClone(mode: CloneMode): Promise<void> {
    if (!this.processDetail) return;

    this.isCloningProcess = true;
    this.cloneError = '';
    this.cloneSuccessMessage = '';

    try {
      const body = mode === 'active_only'
        ? JSON.stringify({ active_only: true })
        : JSON.stringify({ active_only: false });

      const resp = await fetch(
        `http://localhost:8000/api/v1/catalog/public/${this.processDetail.id}/clone`,
        {
          method: 'POST',
          headers: this.authHeaders,
          body,
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        const detail =
          err && typeof err.detail === 'string'
            ? err.detail
            : `Backend returned status ${resp.status}`;
        throw new Error(detail);
      }

      const modeLabel =
        mode === 'active_only' ? 'active version' : 'all versions';
      this.cloneSuccessMessage = `Process "${this.processDetail.name}" (${modeLabel}) cloned to your catalog.`;
      this.showCloneModal = false;
    } catch (error: unknown) {
      console.error('Failed to clone process', error);
      this.cloneError =
        error instanceof Error
          ? `Failed to clone: ${error.message}`
          : 'Failed to clone process.';
    } finally {
      this.isCloningProcess = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Delete handlers
  // ---------------------------------------------------------------------------

  private onDeleteClick(): void {
    this.deleteError = '';
    this.showDeleteConfirm = true;
  }

  private onCancelDelete(): void {
    this.showDeleteConfirm = false;
    this.deleteError = '';
  }

  private async onConfirmDelete(): Promise<void> {
    if (!this.processDetail) return;

    this.isDeletingProcess = true;
    this.deleteError = '';

    try {
      const resp = await fetch(
        `http://localhost:8000/api/v1/catalog/public/${this.processDetail.id}`,
        {
          method: 'DELETE',
          headers: this.authHeaders,
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        const detail =
          err && typeof err.detail === 'string'
            ? err.detail
            : `Backend returned status ${resp.status}`;
        throw new Error(detail);
      }

      this.processes = this.processes.filter(
        (p) => p.id !== this.processDetail!.id
      );
      this.processDetail = null;
      this.selectedProcessId = null;
      this.showDeleteConfirm = false;

      if (this.processes.length > 0) {
        this.onSelectProcess(this.processes[0]);
      }
    } catch (error: unknown) {
      console.error('Failed to delete public process', error);
      this.deleteError =
        error instanceof Error
          ? `Failed to delete: ${error.message}`
          : 'Failed to delete process.';
    } finally {
      this.isDeletingProcess = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  override render() {
    if (!this.userEmail) {
      return html`
        <div class="not-logged-in">
          ⚠ You must be logged in to browse the public catalog.
        </div>
      `;
    }

    return html`
      ${this.showCloneModal ? this.renderCloneModal() : null}
      ${this.showDeleteConfirm ? this.renderDeleteConfirmModal() : null}
      <div class="layout">
        ${this.renderLeftColumn()} ${this.renderRightColumn()}
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Clone modal
  // ---------------------------------------------------------------------------

  private renderCloneModal() {
    if (!this.processDetail) return null;

    const activeVersion = this.processDetail.versions.find(
      (v) => v.status === 'active'
    );
    const hasActiveVersion = !!activeVersion;
    const totalVersions = this.processDetail.versions.length;

    return html`
      <div class="modal-overlay">
        <div class="modal modal-clone">
          <div class="modal-title clone">Clone process</div>
          <div class="modal-body">
            Choose how to clone
            <strong>"${this.processDetail.name}"</strong>
            into your catalog:
          </div>

          ${this.isCloningProcess
            ? html`
                <div class="clone-loading">
                  <span>⏳</span>
                  <span>Cloning process…</span>
                </div>
              `
            : html`
                <div class="clone-options">
                  <button
                    class="clone-option"
                    @click=${() => this.onConfirmClone('all_versions')}
                    ?disabled=${this.isCloningProcess}
                  >
                    <div class="clone-option-icon"></div>
                    <div class="clone-option-content">
                      <div class="clone-option-title">All versions</div>
                      <div class="clone-option-desc">
                        Clone the entire process history including all archived
                        and active versions.
                      </div>
                      <span class="clone-option-badge all">
                        ${totalVersions} version${totalVersions === 1 ? '' : 's'}
                      </span>
                    </div>
                  </button>

                  <button
                    class="clone-option"
                    @click=${() => this.onConfirmClone('active_only')}
                    ?disabled=${this.isCloningProcess || !hasActiveVersion}
                  >
                    <div class="clone-option-icon"></div>
                    <div class="clone-option-content">
                      <div class="clone-option-title">Active version only</div>
                      <div class="clone-option-desc">
                        Clone only the current active version — no archived
                        history.
                      </div>
                      ${hasActiveVersion
                        ? html`
                            <span class="clone-option-badge active">
                              ${activeVersion!.version_name || 'Active version'}
                            </span>
                          `
                        : html`
                            <span class="clone-option-badge warn">
                              ⚠ No active version available
                            </span>
                          `}
                    </div>
                  </button>
                </div>
              `}

          ${this.cloneError
            ? html`<div class="error">${this.cloneError}</div>`
            : null}

          <div class="modal-actions">
            <button
              class="secondary"
              @click=${this.onCancelClone}
              ?disabled=${this.isCloningProcess}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Delete modal
  // ---------------------------------------------------------------------------

  private renderDeleteConfirmModal() {
    if (!this.processDetail) return null;

    return html`
      <div class="modal-overlay">
        <div class="modal modal-delete">
          <div class="modal-title delete">Delete public process</div>
          <div class="modal-body">
            Are you sure you want to permanently delete
            <strong>"${this.processDetail.name}"</strong> from the public
            catalog? This action cannot be undone.
          </div>

          ${this.deleteError
            ? html`<div class="error">${this.deleteError}</div>`
            : null}

          <div class="modal-actions">
            <button
              class="secondary"
              @click=${this.onCancelDelete}
              ?disabled=${this.isDeletingProcess}
            >
              Cancel
            </button>
            <button
              class="danger"
              @click=${this.onConfirmDelete}
              ?disabled=${this.isDeletingProcess}
            >
              ${this.isDeletingProcess ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderLeftColumn() {
    return html`
      <aside class="card public-accent">
        <div class="card-header">
          <div>
            <div class="card-title" style="color: #7dd3fc;">Public processes</div>
            <div class="card-subtitle">
              Publicly shared processes from all users.
            </div>
          </div>
        </div>

        <div class="filters">
          <div>
            <label for="pubNameFilter">Name filter</label>
            <input
              id="pubNameFilter"
              type="text"
              .value=${this.nameFilter}
              @input=${this.onNameFilterChange}
              placeholder="Substring of process name"
              autocomplete="off"
            />
          </div>
          <div>
            <label for="pubDomainFilter">Domain filter</label>
            <input
              id="pubDomainFilter"
              type="text"
              .value=${this.domainFilter}
              @input=${this.onDomainFilterChange}
              placeholder="Domain substring"
              autocomplete="off"
            />
          </div>
          <div>
            <label for="pubOwnerFilter">Owner filter</label>
            <input
              id="pubOwnerFilter"
              type="text"
              .value=${this.ownerFilter}
              @input=${this.onOwnerFilterChange}
              placeholder="Owner e-mail substring"
              autocomplete="off"
            />
          </div>
        </div>

        <div class="actions-row">
          <button
            class="blue"
            @click=${this.onReloadClick}
            ?disabled=${this.isLoadingProcesses}
          >
            ${this.isLoadingProcesses ? 'Reloading…' : 'Reload list'}
          </button>
        </div>

        <div class="status">
          <span
            class="status-dot ${this.processesError
              ? 'error'
              : this.isLoadingProcesses
              ? 'pending'
              : ''}"
          ></span>
          ${this.processesError
            ? 'Failed to load public processes'
            : this.isLoadingProcesses
            ? 'Loading public catalog…'
            : `${this.processes.length} public process(es)`}
        </div>

        ${this.renderProcessesList()}
      </aside>
    `;
  }

  private renderProcessesList() {
    if (this.isLoadingProcesses) {
      return html`<div class="placeholder small">Loading processes…</div>`;
    }
    if (this.processesError) {
      return html`<div class="error">${this.processesError}</div>`;
    }
    if (!this.processes.length) {
      return html`
        <div class="empty-state">
          <div class="empty-state-icon">🌐</div>
          <div class="empty-state-title">No public processes yet</div>
          <div class="empty-state-desc">
            Processes published by users will appear here. Use "Make public" in
            your catalog to share a process.
          </div>
        </div>
      `;
    }
    return html`
      <ul class="process-list">
        ${this.processes.map(
          (p) => html`
            <li
              class="process-item ${p.id === this.selectedProcessId
                ? 'selected'
                : ''}"
              @click=${() => this.onSelectProcess(p)}
            >
              <div class="process-name">${p.name}</div>
              <div class="process-meta">
                ${p.domain ?? 'No domain'} ·
                ${p.versions_count} version${p.versions_count === 1 ? '' : 's'}
              </div>
              <div class="owner-badge">
                <span>👤</span>
                <span>${p.owner_email}</span>
              </div>
            </li>
          `
        )}
      </ul>
    `;
  }

  private renderRightColumn() {
    return html`
      <section class="card public-accent">
        <div class="card-header">
          <div>
            <div class="card-title" style="color: #7dd3fc;">Process detail</div>
            <div class="card-subtitle">
              Read-only view of public process versions and their diagrams.
            </div>
          </div>
        </div>

        <div class="readonly-banner">
          <span class="readonly-banner-dot"></span>
          Public catalog — read-only view. No edits possible.
        </div>

        ${this.renderProcessDetail()}
      </section>
    `;
  }

  private renderProcessDetail() {
    if (this.isLoadingDetail) {
      return html`<div class="placeholder">Loading process detail…</div>`;
    }
    if (this.detailError) {
      return html`<div class="error">${this.detailError}</div>`;
    }
    if (!this.processDetail) {
      return html`
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">No process selected</div>
          <div class="empty-state-desc">
            Select a public process on the left to explore its versions and
            activity diagrams.
          </div>
        </div>
      `;
    }

    const { name, domain, description, owner_email, versions } =
      this.processDetail;

    const isOwner = this.userEmail === owner_email;

    return html`
      <div class="versions-header">
        <div>
          <div class="versions-title">${name}</div>
          <div class="card-subtitle" style="margin-top: 3px;">
            Domain: ${domain ?? 'No domain'} · ${versions.length}
            version${versions.length === 1 ? '' : 's'}
          </div>
          <div class="owner-badge" style="margin-top: 6px;">
            <span>👤</span>
            <span>${owner_email}</span>
          </div>
          ${description
            ? html`<div class="process-description-box">${description}</div>`
            : null}
        </div>
        <span class="pill blue">${versions.length} version(s)</span>
      </div>

      <div class="detail-actions-row">
        <button
          class="green"
          @click=${this.onCloneClick}
          ?disabled=${this.isCloningProcess}
          title="Clone this process into your local catalog"
        >
          Clone to my catalog
        </button>

        ${isOwner
          ? html`
              <button
                class="danger"
                @click=${this.onDeleteClick}
                ?disabled=${this.isDeletingProcess}
                title="Delete this public process (you are the owner)"
              >
                Delete
              </button>
            `
          : null}
      </div>

      ${this.cloneSuccessMessage
        ? html`<div class="success-banner">✓ ${this.cloneSuccessMessage}</div>`
        : null}
      ${this.cloneError
        ? html`<div class="error">${this.cloneError}</div>`
        : null}

      ${versions.length === 0
        ? html`<div class="placeholder small">
            This public process has no stored versions.
          </div>`
        : html`
            <table>
              <thead>
                <tr>
                  <th>Version Name</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${versions.map((v) => this.renderVersionRow(v))}
              </tbody>
            </table>

            ${this.renderExpandedDetail()}
          `}
    `;
  }

  private renderVersionRow(v: PublicCatalogVersion) {
    const statusClass = v.status === 'active' ? 'active' : 'archived';

    return html`
      <tr>
        <td>
          <div>${v.version_name || '—'}</div>
        </td>
        <td>
          <span class="version-status ${statusClass}">${v.status}</span>
        </td>
        <td>${new Date(v.created_at).toLocaleString()}</td>
        <td>
          <button
            class="tiny-btn"
            @click=${() => this.onToggleVersion(v.id)}
          >
            ${this.expandedVersionId === v.id ? 'Hide' : 'Show'} detail
          </button>
        </td>
      </tr>
    `;
  }

  private renderExpandedDetail() {
      if (
        !this.processDetail ||
        this.expandedVersionId === null ||
        !this.processDetail.versions.length
      ) {
        return null;
      }

      const v = this.processDetail.versions.find(
        (ver) => ver.id === this.expandedVersionId
      );
      if (!v) return null;

      return html`
        <div style="margin-top: 8px;">
    
          <!-- Header: "Visual diagram representation" + Download button -->
          <div style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 6px;
          ">
            <div class="card-subtitle">Visual diagram representation</div>
            ${v.prompt
              ? html`<button
                  class="secondary"
                  style="font-size: 12px; padding: 6px 12px;"
                  @click=${() => this.onDownloadDiagramClick(v)}
                >
                  Download
                </button>`
              : null}
          </div>
    
          ${v.version_description
            ? html`<div style="
                font-size: 13px;
                color: #9ca3af;
                background: rgba(15, 23, 42, 0.6);
                border: 1px solid rgba(55, 65, 81, 0.7);
                border-radius: 8px;
                padding: 8px 10px;
                margin-top: 6px;
                margin-bottom: 4px;
                line-height: 1.5;
              ">
                ${v.version_description}
              </div>`
            : null}
    
          ${v.prompt
            ? html`
                <div
                  style="position: relative; overflow: hidden; border-radius: 8px;"
                >
                  <ad-canvas-editor
                    data-version-id="${v.id}"
                    .readOnly=${true}
                  ></ad-canvas-editor>
                  <div
                    style="
                      position: absolute;
                      inset: 0;
                      z-index: 10;
                      cursor: default;
                      pointer-events: none;
                    "
                  ></div>
                </div>
              `
            : html`
                <div class="placeholder small" style="margin-top: 8px;">
                  No diagram structure saved for this version.
                </div>
              `}
    
          <!-- Footer: "Generated PlantUML" + Show/Hide code -->
          <div
            style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 10px;
              margin-top: 16px;
            "
          >
            <div>
              <div class="card-subtitle">Generated PlantUML</div>
              <div style="font-size: 11px; color: #6b7280;">
                Inspect the PlantUML source code for this version.
              </div>
            </div>
            <button
              class="secondary"
              style="font-size: 12px; padding: 6px 12px;"
              @click=${() => {
                this.isDetailCodeExpanded = !this.isDetailCodeExpanded;
              }}
            >
              ${this.isDetailCodeExpanded ? 'Hide code' : 'Show code'}
            </button>
          </div>
    
          ${this.isDetailCodeExpanded
            ? html`<pre style="margin-top: 8px;">${v.plantuml_code}</pre>`
            : null}
        </div>
      `;
    }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  private onNameFilterChange(event: Event): void {
    this.nameFilter = (event.target as HTMLInputElement).value;
  }

  private onOwnerFilterChange(event: Event): void {
    this.ownerFilter = (event.target as HTMLInputElement).value;
  }

  // ADDED
  private onDomainFilterChange(event: Event): void {
    this.domainFilter = (event.target as HTMLInputElement).value;
  }

  private onReloadClick(): void {
    this.loadProcesses();
  }

  private onSelectProcess(process: PublicCatalogListItem): void {
    this.selectedProcessId = process.id;
    this.isDetailCodeExpanded = false;
    this.cloneError = '';
    this.cloneSuccessMessage = '';
    this.deleteError = '';
    this.showDeleteConfirm = false;
    this.showCloneModal = false;
    this.loadProcessDetail(process.id);
  }

  private onToggleVersion(versionId: number): void {
    this.expandedVersionId =
      this.expandedVersionId === versionId ? null : versionId;
    this.isDetailCodeExpanded = false;
  }

  private async onDownloadDiagramClick(v: PublicCatalogVersion): Promise<void> {
      const canvasEditor = this.renderRoot?.querySelector(
        `ad-canvas-editor[data-version-id="${v.id}"]`
      ) as any;

      if (!canvasEditor) {
        console.warn('Download: ad-canvas-editor not found.');
        return;
      }

      await canvasEditor.updateComplete?.catch(() => {});

      const svgEl: SVGSVGElement | null =
        canvasEditor.shadowRoot?.querySelector('svg') ?? null;

      if (!svgEl) {
        console.warn('Download: no <svg> found in shadow root.');
        return;
      }

      const svgWidth = svgEl.width?.baseVal?.value || svgEl.viewBox?.baseVal?.width || 800;
      const svgHeight = svgEl.height?.baseVal?.value || svgEl.viewBox?.baseVal?.height || 600;

      const serializer = new XMLSerializer();
      const svgClone = svgEl.cloneNode(true) as SVGSVGElement;
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('width', String(svgWidth));
      bgRect.setAttribute('height', String(svgHeight));
      bgRect.setAttribute('fill', '#ffffff');
      svgClone.insertBefore(bgRect, svgClone.firstChild);

      const svgString = serializer.serializeToString(svgClone);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const scale = 2;
        const offscreen = document.createElement('canvas');
        offscreen.width = svgWidth * scale;
        offscreen.height = svgHeight * scale;

        const ctx = offscreen.getContext('2d')!;
        ctx.scale(scale, scale);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, svgWidth, svgHeight);
        ctx.drawImage(img, 0, 0, svgWidth, svgHeight);

        URL.revokeObjectURL(url);

        const dataUrl = offscreen.toDataURL('image/png');
        this._triggerDownload(dataUrl, v);
      };

      img.onerror = (err) => {
        console.error('Download: failed to load SVG as image', err);
        URL.revokeObjectURL(url);
      };

      img.src = url;
    }

    private _triggerDownload(dataUrl: string, v: PublicCatalogVersion): void {
      const processName = (this.processDetail?.name ?? 'diagram')
        .replace(/\s+/g, '_')
        .toLowerCase();
      const versionLabel = (v.version_name || `v${v.version_number}`)
        .replace(/\s+/g, '_')
        .toLowerCase();
      const filename = `${processName}_${versionLabel}.png`;

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      link.click();
    }
}

declare global {
  interface HTMLElementTagNameMap {
    'ad-public-catalog-view': AdPublicCatalogView;
  }
}
