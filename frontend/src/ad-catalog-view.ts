// src/components/ad-catalog-view.ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface CatalogProcess {
  id: number;
  name: string;
  domain: string | null;
  versions_count: number;
}

interface CatalogVersion {
  id: number;
  process_id: number;
  version_number: number;
  version_name: string;
  version_description: string | null;
  created_at: string;
  llm_model: string;
  tokens_used: number | null;
  status: string;
  plantuml_code: string;
  image_path: string | null;
  prompt: Record<string, unknown> | null;
  canvas_state: Record<string, unknown> | null;
}

interface CatalogProcessDetail {
  process_id: number;
  process_name: string;
  domain: string | null;
  description?: string | null;
  versions: CatalogVersion[];
}

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
  access: string;
}

interface PublicCatalogProcess {
  id: number;
  name: string;
  domain: string | null;
  description: string | null;
  owner_email: string;
  versions: PublicCatalogVersion[];
  access: string;
}

type CatalogSubView = 'list' | 'create' | 'update';
type EditMode = 'create' | 'update' | null;
type MakePublicMode = 'active_only' | 'all_versions';

@customElement('ad-catalog-view')
export class AdCatalogView extends LitElement {
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
      border-color: #4f46e5;
      box-shadow:
        0 0 0 1px rgba(79, 70, 229, 0.8),
        0 0 18px rgba(59, 130, 246, 0.4);
      background: rgba(15, 23, 42, 0.95);
    }

    textarea {
      width: 100%;
      min-height: 140px;
      resize: vertical;
      background: rgba(15, 23, 42, 0.9);
      border-radius: 10px;
      border: 1px solid rgba(31, 41, 55, 0.9);
      color: #e5e7eb;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
        sans-serif;
      font-size: 13px;
      padding: 10px 11px;
      box-sizing: border-box;
      outline: none;
      line-height: 1.45;
    }

    textarea:focus {
      border-color: #4f46e5;
      box-shadow:
        0 0 0 1px rgba(79, 70, 229, 0.8),
        0 0 18px rgba(59, 130, 246, 0.4);
      background: rgba(15, 23, 42, 0.95);
    }

    .process-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 420px;
      overflow: auto;
    }

    .process-item {
      padding: 8px 9px;
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
      border-color: #4f46e5;
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

    .error.small {
      font-size: 12px;
      margin-top: 4px;
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

    button.primary {
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: #e5e7eb;
      border: 1px solid rgba(129, 140, 248, 0.9);
    }

    button.primary:hover {
      background: linear-gradient(135deg, #4338ca, #6d28d9);
    }

    button.success {
      background: rgba(20, 83, 45, 0.9);
      color: #bbf7d0;
      border: 1px solid rgba(34, 197, 94, 0.7);
    }

    button.success:hover {
      background: rgba(22, 101, 52, 1);
    }

    button.danger {
      background: rgba(127, 29, 29, 0.9);
      color: #fee2e2;
      border: 1px solid rgba(248, 113, 113, 0.9);
    }

    button.danger:hover {
      background: rgba(153, 27, 27, 1);
    }

    button.text {
      background: transparent;
      color: #9ca3af;
      padding-inline: 0;
      box-shadow: none;
    }

    button.text:hover {
      background: rgba(15, 23, 42, 0.6);
    }

    button:disabled {
      opacity: 0.6;
      cursor: default;
      transform: none;
      box-shadow: none;
    }

    .actions-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: 8px;
      flex-wrap: wrap;
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
      background: #4ade80;
      box-shadow: 0 0 12px rgba(74, 222, 128, 0.7);
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
      align-items: center;
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

    .version-status.draft {
      border-color: #fbbf24;
      color: #fef3c7;
    }

    .version-status.archived {
      border-color: #6b7280;
      color: #e5e7eb;
    }

    .version-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
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
      border-color: #4f46e5;
    }

    .tiny-btn.danger {
      border-color: rgba(248, 113, 113, 0.9);
      color: #fecaca;
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

    .diagram-preview {
      margin-top: 10px;
      border-radius: 12px;
      border: 1px solid rgba(31, 41, 55, 0.9);
      padding: 8px;
      background: rgba(15, 23, 42, 0.9);
      max-height: 360px;
      overflow: auto;
    }

    .diagram-preview img {
      display: block;
      max-width: 100%;
      height: auto;
      border-radius: 8px;
    }

    .edit-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }

    .edit-title {
      font-size: 16px;
      font-weight: 600;
      color: #e5e7eb;
    }

    .edit-subtitle {
      font-size: 13px;
      color: #9ca3af;
      margin-top: 4px;
    }

    .edit-meta {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 6px;
    }

    .edit-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 10px;
      flex-wrap: wrap;
    }

    .process-edit-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(79, 70, 229, 0.4);
      border-radius: 12px;
      padding: 14px 14px 12px;
      margin-bottom: 4px;
    }

    .process-edit-form-title {
      font-size: 12px;
      font-weight: 600;
      color: #818cf8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 2px;
    }

    /* Make Public Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(2, 6, 23, 0.85);
      backdrop-filter: blur(4px);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .modal {
      background: radial-gradient(circle at top left, #1e293b, #020617 80%);
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 20px;
      padding: 28px 28px 24px;
      max-width: 440px;
      width: 100%;
      box-shadow:
        0 32px 64px rgba(2, 6, 23, 0.8),
        0 0 0 1px rgba(79, 70, 229, 0.15);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .modal-title {
      font-size: 17px;
      font-weight: 650;
      color: #e5e7eb;
      letter-spacing: 0.01em;
    }

    .modal-subtitle {
      font-size: 13px;
      color: #9ca3af;
      line-height: 1.55;
      margin-top: -8px;
    }

    .modal-option {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid rgba(55, 65, 81, 0.8);
      background: rgba(15, 23, 42, 0.6);
      cursor: pointer;
      transition:
        border-color 0.15s ease,
        background 0.15s ease;
    }

    .modal-option:hover {
      border-color: #4f46e5;
      background: rgba(79, 70, 229, 0.08);
    }

    .modal-option-title {
      font-size: 14px;
      font-weight: 600;
      color: #e5e7eb;
    }

    .modal-option-desc {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.45;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 4px;
    }

    .modal-error {
      font-size: 12px;
      color: #fecaca;
      background: rgba(153, 27, 27, 0.35);
      border: 1px solid rgba(248, 113, 113, 0.6);
      border-radius: 8px;
      padding: 7px 10px;
    }
  `;

  @property({ type: String }) userEmail = '';

  @state() private subView: CatalogSubView = 'list';

  @state() private nameFilter = '';
  @state() private domainFilter = '';

  @state() private processes: CatalogProcess[] = [];
  @state() private isLoadingProcesses = false;
  @state() private processesError = '';

  @state() private selectedProcessId: number | null = null;
  @state() private processDetail: CatalogProcessDetail | null = null;
  @state() private isLoadingDetail = false;
  @state() private detailError = '';

  @state() private expandedVersionId: number | null = null;

  @state() private isDeletingAll = false;
  @state() private isDeletingProcess = false;
  @state() private isMutatingVersion = false;

  @state() private isEditingProcess = false;
  @state() private editProcessNameInput = '';
  @state() private editProcessDescriptionInput = '';
  @state() private isSavingProcess = false;
  @state() private processEditError = '';

  @state() private editMode: EditMode = null;
  @state() private editProcessId: number | null = null;
  @state() private editProcessName = '';
  @state() private editVersionNumber: number | null = null;
  @state() private editVersionLabel = '';
  @state() private editVersionDescription = '';
  @state() private editDescriptionOriginal = '';
  @state() private editDescriptionCurrent = '';
  @state() private editGeneratedPlantuml = '';
  @state() private editError = '';
  @state() private isGenerating = false;
  @state() private editPromptJson: any = null;
  @state() private editPromptText = '';

  @state() private isPlantUmlExpanded = false;
  @state() private isDetailCodeExpanded = false;

  // Make Public modal state
  @state() private showMakePublicModal = false;
  @state() private isMakingPublic = false;
  @state() private makePublicError = '';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private authHeaders(): Record<string, string> {
    return this.userEmail ? { 'X-User-Email': this.userEmail } : {};
  }

  protected override updated(changedProperties: Map<string, unknown>): void {
    super.updated(changedProperties);

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

  override firstUpdated(): void {
    this.loadProcesses();
  }

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  private async loadProcesses(): Promise<void> {
    this.isLoadingProcesses = true;
    this.processesError = '';

    const params = new URLSearchParams();
    if (this.nameFilter.trim()) params.append('name', this.nameFilter.trim());
    if (this.domainFilter.trim()) params.append('domain', this.domainFilter.trim());

    const qs = params.toString();
    const url = qs
      ? `http://localhost:8000/api/v1/catalog/processes?${qs}`
      : 'http://localhost:8000/api/v1/catalog/processes';

    try {
      const resp = await fetch(url, { headers: { ...this.authHeaders() } });
      if (!resp.ok) throw new Error(`Backend returned status ${resp.status}`);

      const data = (await resp.json()) as CatalogProcess[];
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
      console.error('Failed to load processes', error);
      this.processesError =
        error instanceof Error
          ? `Failed to load processes: ${error.message}`
          : 'Failed to load processes.';
    } finally {
      this.isLoadingProcesses = false;
    }
  }

  private async loadProcessDetail(processId: number): Promise<void> {
    this.isLoadingDetail = true;
    this.detailError = '';
    this.processDetail = null;
    this.expandedVersionId = null;

    try {
      const resp = await fetch(
        `http://localhost:8000/api/v1/catalog/${processId}`,
        { headers: { ...this.authHeaders() } }
      );
      if (!resp.ok) throw new Error(`Backend returned status ${resp.status}`);

      const data = (await resp.json()) as CatalogProcessDetail;
      this.processDetail = data;
    } catch (error: unknown) {
      console.error('Failed to load process detail', error);
      this.detailError =
        error instanceof Error
          ? `Failed to load process detail: ${error.message}`
          : 'Failed to load process detail.';
    } finally {
      this.isLoadingDetail = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  override render() {
    return html`
      ${this.showMakePublicModal ? this.renderMakePublicModal() : null}
      ${this.subView === 'list'
        ? html`
            <div class="layout">
              ${this.renderLeftColumn()} ${this.renderRightColumn()}
            </div>
          `
        : this.renderEditView()}
    `;
  }

  // ===== LIST / DETAIL VIEW =====

  private renderLeftColumn() {
    return html`
      <aside class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Processes</div>
            <div class="card-subtitle">
              List of all catalogued processes (from DB).
            </div>
          </div>
        </div>

        <div class="filters">
          <div>
            <label for="nameFilter">Name filter</label>
            <input
              id="nameFilter"
              type="text"
              .value=${this.nameFilter}
              @input=${this.onNameFilterChange}
              placeholder="Substring of process name"
              autocomplete="off"
            />
          </div>
          <div>
            <label for="domainFilter">Domain filter</label>
            <input
              id="domainFilter"
              type="text"
              .value=${this.domainFilter}
              @input=${this.onDomainFilterChange}
              placeholder="Substring of domain"
              autocomplete="off"
            />
          </div>
        </div>

        <div class="actions-row">
          <button
            class="secondary"
            @click=${this.onReloadClick}
            ?disabled=${this.isLoadingProcesses}
          >
            ${this.isLoadingProcesses ? 'Reloading…' : 'Reload list'}
          </button>
          <button
            class="danger"
            @click=${this.onDeleteAllClick}
            ?disabled=${this.isDeletingAll || this.isLoadingProcesses}
          >
            Delete all
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
            ? 'Failed to load processes'
            : this.isLoadingProcesses
            ? 'Loading processes from catalog…'
            : `${this.processes.length} process(es) loaded`}
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
      return html`<div class="error small">${this.processesError}</div>`;
    }
    if (!this.processes.length) {
      return html`<div class="placeholder small">
        No processes in catalog for given filters.
      </div>`;
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
            </li>
          `
        )}
      </ul>
    `;
  }

  private renderRightColumn() {
    return html`
      <section class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Process detail</div>
            <div class="card-subtitle">
              Version history with generated PlantUML diagrams.
            </div>
          </div>

          ${this.renderProcessHeaderActions()}
        </div>

        ${this.renderProcessDetail()}
      </section>
    `;
  }

  private renderProcessHeaderActions() {
    if (!this.processDetail) return html``;
    return html`
      <div class="actions-row" style="justify-content: flex-end; margin-top:0">
        <button
          class="secondary"
          @click=${this.onEditProcessClick}
          ?disabled=${this.isMutatingVersion || this.isDeletingProcess}
        >
          Edit process
        </button>
        <button
          class="secondary"
          @click=${this.onCreateVersionClick}
          ?disabled=${this.isMutatingVersion}
        >
          Create new version
        </button>
        <button
          class="success"
          @click=${this.onMakePublicClick}
          ?disabled=${this.isMakingPublic || this.isDeletingProcess}
        >
          ${this.isMakingPublic ? 'Publishing…' : 'Make public'}
        </button>
        <button
          class="danger"
          @click=${this.onDeleteProcessClick}
          ?disabled=${this.isDeletingProcess}
        >
          Delete process
        </button>
      </div>
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
      return html`<div class="placeholder">
        Select a process on the left to see its versions and PlantUML code.
      </div>`;
    }

    const { process_name, domain, description, versions } = this.processDetail;

    return html`
      <div class="versions-header">
        <div>
          <div class="versions-title">${process_name}</div>
          <div class="card-subtitle">
            Domain: ${domain ?? 'No domain'} · ${versions.length}
            version${versions.length === 1 ? '' : 's'}
          </div>
          ${description
            ? html`<div style="
                font-size: 13px;
                color: #9ca3af;
                background: rgba(15, 23, 42, 0.6);
                border: 1px solid rgba(55, 65, 81, 0.7);
                border-radius: 8px;
                padding: 8px 10px;
                margin-top: 10px;
                margin-bottom: 2px;
                line-height: 1.5;
              ">${description}</div>`
            : null}
        </div>
        <span class="pill">
          Manage versions: create/update description, publish or delete
        </span>
      </div>

      ${this.isEditingProcess ? this.renderProcessEditForm() : null}

      ${versions.length === 0
        ? html`<div class="placeholder small">
            This process has no stored versions yet.
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

            ${this.renderExpandedPlantuml()}
          `}
    `;
  }

  private renderProcessEditForm() {
    return html`
      <div class="process-edit-form">
        <div class="process-edit-form-title">Edit process metadata</div>

        <div>
          <label for="editProcessName">Process name</label>
          <input
            id="editProcessName"
            type="text"
            .value=${this.editProcessNameInput}
            @input=${(e: Event) => {
              this.editProcessNameInput = (e.target as HTMLInputElement).value;
            }}
            placeholder="Process name"
            autocomplete="off"
          />
        </div>

        <div>
          <label for="editProcessDesc">
            Description
            <span style="font-size: 11px; font-weight: 400; color: #4b5563; margin-left: 5px;">optional</span>
          </label>
          <textarea
            id="editProcessDesc"
            .value=${this.editProcessDescriptionInput}
            @input=${(e: Event) => {
              this.editProcessDescriptionInput = (
                e.target as HTMLTextAreaElement
              ).value;
            }}
            placeholder="Short description of this process (optional)."
            style="min-height: 80px;"
          ></textarea>
        </div>

        ${this.processEditError
          ? html`<div class="error small">${this.processEditError}</div>`
          : null}

        <div style="display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap;">
          <button
            class="text"
            @click=${this.onCancelEditProcessClick}
            ?disabled=${this.isSavingProcess}
          >
            Cancel
          </button>
          <button
            class="primary"
            @click=${this.onSaveProcessClick}
            ?disabled=${this.isSavingProcess || !this.editProcessNameInput.trim()}
          >
            ${this.isSavingProcess ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Make Public Modal
  // ---------------------------------------------------------------------------

  private renderMakePublicModal() {
    const processName = this.processDetail?.process_name ?? '';
    return html`
      <div class="modal-backdrop" @click=${this.onModalBackdropClick}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-title">Make process public</div>
          <div class="modal-subtitle">
            A copy of <strong style="color:#e5e7eb;">${processName}</strong>
            will be created in the public catalog, visible to all users.
            Choose which versions to include:
          </div>

          ${this.makePublicError
            ? html`<div class="modal-error">${this.makePublicError}</div>`
            : null}

          <div
            class="modal-option"
            @click=${() => this.onConfirmMakePublic('active_only')}
            role="button"
            tabindex="0"
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') this.onConfirmMakePublic('active_only');
            }}
          >
            <div class="modal-option-title">Active version only</div>
            <div class="modal-option-desc">
              Only the currently active (published) version will be copied to
              the public catalog.
            </div>
          </div>

          <div
            class="modal-option"
            @click=${() => this.onConfirmMakePublic('all_versions')}
            role="button"
            tabindex="0"
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') this.onConfirmMakePublic('all_versions');
            }}
          >
            <div class="modal-option-title">All versions</div>
            <div class="modal-option-desc">
              All active and archived versions will be copied. Draft versions
              are never included.
            </div>
          </div>

          <div class="modal-footer">
            <button
              class="secondary"
              @click=${this.onCancelMakePublic}
              ?disabled=${this.isMakingPublic}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderVersionRow(v: CatalogVersion) {
    const statusClass =
      v.status === 'active'
        ? 'active'
        : v.status === 'draft'
        ? 'draft'
        : 'archived';

    const canPublish = v.status !== 'active';
    const canUpdate = v.status === 'draft';

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
          <div class="version-actions">
            <button
              class="tiny-btn"
              @click=${() => this.onTogglePlantuml(v.id)}
            >
              ${this.expandedVersionId === v.id ? 'Hide' : 'Show'} detail
            </button>
            ${canUpdate
              ? html`<button
                  class="tiny-btn"
                  ?disabled=${this.isMutatingVersion}
                  @click=${() => this.onUpdateVersionClick(v)}
                >
                  Update
                </button>`
              : null}
            <button
              class="tiny-btn"
              ?disabled=${!canPublish || this.isMutatingVersion}
              @click=${() => this.onPublishVersionClick(v)}
            >
              Publish
            </button>
            <button
              class="tiny-btn danger"
              ?disabled=${this.isMutatingVersion}
              @click=${() => this.onDeleteVersionClick(v)}
            >
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  private renderExpandedPlantuml() {
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
        <div class="card-subtitle">Visual diagram representation</div>

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
              Inspect the PlantUML code for this version.
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

  // ===== EDIT VIEW =====

  private renderEditView() {
    const title =
      this.editMode === 'create' ? 'Create new version' : 'Update draft version';
    const subtitle =
      this.editMode === 'create'
        ? 'Provide a refined text description of the process. The backend will regenerate the PlantUML diagram for this new version.'
        : 'Update the text description for this draft version. PlantUML will be regenerated on the backend from your description.';
    const processName = this.editProcessName || 'Unknown process';
    const saveLabel =
      this.editMode === 'create' ? 'Save as new version' : 'Save draft version';

    return html`
      <div style="display: flex; flex-direction: column; gap: 18px; width: 100%;">

        <section class="card">
          <div class="edit-header">
            <div>
              <div class="edit-title">${title}</div>
              <div class="edit-subtitle">${subtitle}</div>
            </div>
            <button class="text" @click=${this.onBackToCatalogClick}>
              ← Back to catalog
            </button>
          </div>

          <div class="edit-meta">
            Process: <strong>${processName}</strong>
            ${this.editMode === 'update' && this.editVersionNumber !== null
              ? html` · Draft version #${this.editVersionNumber}`
              : null}
          </div>

          <div style="margin-bottom: 8px;">
            <label for="editVersionLabel">Version Name</label>
            <input
              id="editVersionLabel"
              type="text"
              .value=${this.editVersionLabel}
              @input=${this.onEditVersionLabelChange}
              placeholder="e.g. ver 2 – improved decision branch"
              autocomplete="off"
            />
          </div>

          <div>
            <label for="editVersionDescription">
              ${this.editMode === 'update'
                ? 'Updated Draft Version Description'
                : 'New Version Description'}
              <span style="font-size: 11px; font-weight: 400; color: #4b5563; margin-left: 5px;">optional</span>
            </label>
            <textarea
              id="editVersionDescription"
              .value=${this.editVersionDescription}
              @input=${this.onEditVersionDescriptionChange}
              placeholder="Notes about this version — e.g. what changed, assumptions, limitations."
              style="min-height: 80px;"
            ></textarea>
          </div>

          <div>
            <label for="editDescription">Text Prompt</label>
            <textarea
              id="editDescription"
              .value=${this.editDescriptionCurrent}
              @input=${this.onEditDescriptionChange}
              placeholder="Describe the process step-by-step for this version."
            ></textarea>
          </div>

          ${this.editError
            ? html`<div class="error">${this.editError}</div>`
            : null}

          <div
            class="edit-actions"
            style="justify-content: flex-start; margin-top: 16px; gap: 12px;"
          >
            <button
              class="primary"
              @click=${this.onEditGenerateClick}
              ?disabled=${this.isGenerating ||
              !this.editDescriptionCurrent.trim() ||
              this.editMode === null ||
              this.editProcessId === null}
            >
              ${this.isGenerating ? 'Generating…' : 'Generate diagram'}
            </button>
            <button
              class="secondary"
              @click=${this.onEditSaveClick}
              ?disabled=${this.isGenerating ||
              !this.editGeneratedPlantuml.trim() ||
              this.editMode === null ||
              this.editProcessId === null}
            >
              ${saveLabel}
            </button>
            <button
              class="text"
              @click=${this.onRevertEditClick}
              ?disabled=${this.isGenerating ||
              this.editDescriptionCurrent === this.editDescriptionOriginal}
            >
              Revert
            </button>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Visual canvas editor (beta)</div>
              <div class="card-subtitle" style="font-size: 12px; color: #6b7280;">
                Drag UML activity nodes between swimlanes and reorder them visually.
              </div>
            </div>
          </div>

          <ad-canvas-editor
            @structure-change=${this.onCanvasStructureChange}
          ></ad-canvas-editor>

          <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">
            Use the toolbar inside the canvas to add actions and arrange them.
          </div>
        </section>

        <section class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
            <div>
              <div class="card-title" style="font-size: 14px; font-weight: 500; color: #d1d5db;">
                Generated PlantUML
              </div>
              <div class="card-subtitle" style="font-size: 11px; color: #6b7280;">
                Inspect the PlantUML code generated by the LLM before saving it.
              </div>
            </div>
            <button
              class="secondary"
              style="font-size: 12px; padding: 6px 12px;"
              ?disabled=${!this.editGeneratedPlantuml}
              @click=${this.onTogglePlantUmlClick}
            >
              ${this.isPlantUmlExpanded ? 'Hide code' : 'Show code'}
            </button>
          </div>

          ${this.isPlantUmlExpanded
            ? html`
                <div style="margin-top: 12px;">
                  ${this.editGeneratedPlantuml
                    ? html`<pre>${this.editGeneratedPlantuml}</pre>`
                    : html`<div class="placeholder small">
                        Generated PlantUML code will appear here after you
                        click <strong>Generate diagram</strong>.
                      </div>`}
                </div>
              `
            : null}
        </section>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Handlers: filters & selection
  // ---------------------------------------------------------------------------

  private onNameFilterChange(event: Event): void {
    this.nameFilter = (event.target as HTMLInputElement).value;
  }

  private onDomainFilterChange(event: Event): void {
    this.domainFilter = (event.target as HTMLInputElement).value;
  }

  private onReloadClick(): void {
    this.loadProcesses();
  }

  private onSelectProcess(process: CatalogProcess): void {
    this.selectedProcessId = process.id;
    this.isEditingProcess = false;
    this.processEditError = '';
    this.loadProcessDetail(process.id);
  }

  private onTogglePlantuml(versionId: number): void {
    this.expandedVersionId =
      this.expandedVersionId === versionId ? null : versionId;
    this.isDetailCodeExpanded = false;
  }

  // ---------------------------------------------------------------------------
  // Handlers: inline process edit
  // ---------------------------------------------------------------------------

  private onEditProcessClick(): void {
    if (!this.processDetail) return;
    this.editProcessNameInput = this.processDetail.process_name;
    this.editProcessDescriptionInput = this.processDetail.description ?? '';
    this.processEditError = '';
    this.isEditingProcess = true;
  }

  private onCancelEditProcessClick(): void {
    this.isEditingProcess = false;
    this.processEditError = '';
  }

  private async onSaveProcessClick(): Promise<void> {
    if (!this.processDetail) return;

    const name = this.editProcessNameInput.trim();
    if (!name) {
      this.processEditError = 'Process name must not be empty.';
      return;
    }

    this.isSavingProcess = true;
    this.processEditError = '';

    try {
      const resp = await fetch(
        `http://localhost:8000/api/v1/catalog/${this.processDetail.process_id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...this.authHeaders(),
          },
          body: JSON.stringify({
            name,
            description: this.editProcessDescriptionInput.trim() || null,
          }),
        }
      );

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(
          `Backend returned status ${resp.status}${text ? ` – ${text.slice(0, 200)}` : ''}`
        );
      }

      const updated = (await resp.json()) as CatalogProcessDetail;
      this.processDetail = updated;
      this.isEditingProcess = false;

      this.processes = this.processes.map((p) =>
        p.id === updated.process_id ? { ...p, name: updated.process_name } : p
      );
    } catch (error: unknown) {
      console.error('Failed to update process', error);
      this.processEditError =
        error instanceof Error
          ? `Failed to update process: ${error.message}`
          : 'Failed to update process.';
    } finally {
      this.isSavingProcess = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Handlers: Make Public
  // ---------------------------------------------------------------------------

  private onMakePublicClick(): void {
    if (!this.processDetail) return;
    this.makePublicError = '';
    this.showMakePublicModal = true;
  }

  private onCancelMakePublic(): void {
    this.showMakePublicModal = false;
    this.makePublicError = '';
  }

  private onModalBackdropClick(): void {
    if (!this.isMakingPublic) {
      this.showMakePublicModal = false;
      this.makePublicError = '';
    }
  }

  private async onConfirmMakePublic(mode: MakePublicMode): Promise<void> {
      if (!this.processDetail) return;

      this.isMakingPublic = true;
      this.makePublicError = '';

      try {
        const resp = await fetch(
          `http://localhost:8000/api/v1/catalog/${this.processDetail.process_id}/make-public`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...this.authHeaders(),
            },
            body: JSON.stringify({ mode }),
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

        this.showMakePublicModal = false;
      } catch (error: unknown) {
        console.error('Failed to make process public', error);
        this.makePublicError =
          error instanceof Error
            ? `Failed to publish: ${error.message}`
            : 'Failed to publish process.';
      } finally {
        this.isMakingPublic = false;
      }
    }

  // ---------------------------------------------------------------------------
  // Handlers: delete / publish
  // ---------------------------------------------------------------------------

  private async onDeleteAllClick(): Promise<void> {
    if (!confirm('Delete ALL your processes and their versions from catalog?')) return;
    this.isDeletingAll = true;
    try {
      const resp = await fetch('http://localhost:8000/api/v1/catalog', {
        method: 'DELETE',
        headers: { ...this.authHeaders() },
      });
      if (!resp.ok) throw new Error(`Backend returned status ${resp.status}`);
      this.selectedProcessId = null;
      this.processDetail = null;
      this.expandedVersionId = null;
      this.isEditingProcess = false;
      await this.loadProcesses();
    } catch (error: unknown) {
      console.error('Failed to delete all processes', error);
      this.processesError =
        error instanceof Error
          ? `Failed to delete all processes: ${error.message}`
          : 'Failed to delete all processes.';
    } finally {
      this.isDeletingAll = false;
    }
  }

  private async onDeleteProcessClick(): Promise<void> {
    if (!this.processDetail) return;
    if (
      !confirm(
        `Delete process "${this.processDetail.process_name}" and all its versions?`
      )
    ) return;

    this.isDeletingProcess = true;
    try {
      const resp = await fetch(
        `http://localhost:8000/api/v1/catalog/${this.processDetail.process_id}`,
        { method: 'DELETE', headers: { ...this.authHeaders() } }
      );
      if (!resp.ok) throw new Error(`Backend returned status ${resp.status}`);
      this.selectedProcessId = null;
      this.processDetail = null;
      this.expandedVersionId = null;
      this.isEditingProcess = false;
      await this.loadProcesses();
    } catch (error: unknown) {
      console.error('Failed to delete process', error);
      this.detailError =
        error instanceof Error
          ? `Failed to delete process: ${error.message}`
          : 'Failed to delete process.';
    } finally {
      this.isDeletingProcess = false;
    }
  }

  private async onDeleteVersionClick(v: CatalogVersion): Promise<void> {
    if (
      !confirm(
        `Delete version #${v.version_number} (${v.version_name || 'no name'})?`
      )
    ) return;

    this.isMutatingVersion = true;
    try {
      const resp = await fetch(
        `http://localhost:8000/api/v1/catalog/${v.process_id}/versions/${v.version_number}`,
        { method: 'DELETE', headers: { ...this.authHeaders() } }
      );
      if (!resp.ok) throw new Error(`Backend returned status ${resp.status}`);
      if (this.expandedVersionId === v.id) this.expandedVersionId = null;
      await this.loadProcessDetail(v.process_id);
      await this.loadProcesses();
    } catch (error: unknown) {
      console.error('Failed to delete version', error);
      this.detailError =
        error instanceof Error
          ? `Failed to delete version: ${error.message}`
          : 'Failed to delete version.';
    } finally {
      this.isMutatingVersion = false;
    }
  }

  private async onPublishVersionClick(v: CatalogVersion): Promise<void> {
    if (!confirm(`Publish version #${v.version_number}?`)) return;

    this.isMutatingVersion = true;
    try {
      const resp = await fetch(
        `http://localhost:8000/api/v1/catalog/${v.process_id}/versions/${v.version_number}/publish`,
        { method: 'PUT', headers: { ...this.authHeaders() } }
      );
      if (!resp.ok) throw new Error(`Backend returned status ${resp.status}`);
      await this.loadProcessDetail(v.process_id);
      await this.loadProcesses();
    } catch (error: unknown) {
      console.error('Failed to publish version', error);
      this.detailError =
        error instanceof Error
          ? `Failed to publish version: ${error.message}`
          : 'Failed to publish version.';
    } finally {
      this.isMutatingVersion = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Handlers: create / update version (navigation)
  // ---------------------------------------------------------------------------

  private onCreateVersionClick(): void {
    if (!this.processDetail || !this.processDetail.versions.length) {
      this.detailError =
        'Cannot create new version – process detail or versions are not loaded.';
      return;
    }

    const versions = this.processDetail.versions;

    const base =
      versions.find((v) => v.status === 'active') ??
      [...versions].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

    this.subView = 'create';
    this.editMode = 'create';
    this.editProcessId = this.processDetail.process_id;
    this.editProcessName = this.processDetail.process_name;
    this.editVersionNumber = null;
    this.editVersionLabel = '';
    this.editVersionDescription = '';
    this.editDescriptionOriginal = '';
    this.editDescriptionCurrent = '';
    this.editGeneratedPlantuml = base ? base.plantuml_code : '';
    this.editPromptJson = base ? base.prompt : null;
    this.editPromptText =
      base?.prompt != null ? JSON.stringify(base.prompt, null, 2) : '';
    this.editError = '';
    this.isPlantUmlExpanded = false;

    this.initCanvasForEdit(base?.canvas_state ?? null, this.editPromptJson);
  }

  private onUpdateVersionClick(v: CatalogVersion): void {
    if (v.status !== 'draft') return;
    this.subView = 'update';
    this.editMode = 'update';
    this.editProcessId = v.process_id;
    this.editProcessName = this.processDetail?.process_name ?? '';
    this.editVersionNumber = v.version_number;
    this.editVersionLabel = v.version_name;
    this.editVersionDescription = v.version_description ?? '';
    this.editDescriptionOriginal = '';
    this.editDescriptionCurrent = '';
    this.editGeneratedPlantuml = v.plantuml_code;
    this.editPromptJson = v.prompt ?? null;
    this.editPromptText =
      v.prompt != null ? JSON.stringify(v.prompt, null, 2) : '';
    this.editError = '';
    this.isPlantUmlExpanded = false;

    this.initCanvasForEdit(v.canvas_state ?? null, this.editPromptJson);
  }

  private onBackToCatalogClick(): void {
    this.subView = 'list';
    this.editMode = null;
    this.editError = '';
    this.editVersionDescription = '';
    this.isGenerating = false;
    this.editPromptJson = null;
    this.editPromptText = '';
  }

  // ---------------------------------------------------------------------------
  // Handlers: edit form
  // ---------------------------------------------------------------------------

  private onTogglePlantUmlClick(): void {
    this.isPlantUmlExpanded = !this.isPlantUmlExpanded;
  }

  private onCanvasStructureChange(e: CustomEvent): void {
    try {
      this.editPromptText = JSON.stringify(e.detail, null, 2);
    } catch {
      // Ignore serialization errors
    }
  }

  private async initCanvasForEdit(
    canvasState: Record<string, unknown> | null,
    prompt: any
  ): Promise<void> {
    await this.updateComplete;
    const canvas = this.renderRoot?.querySelector(
      'ad-canvas-editor:not([data-version-id])'
    ) as any;
    if (!canvas) return;

    if (canvasState && typeof canvas.setFullState === 'function') {
      canvas.setFullState(canvasState);
      return;
    }

    if (typeof canvas.setStructure === 'function') {
      if (prompt && Array.isArray(prompt.actors) && Array.isArray(prompt.actions)) {
        canvas.setStructure({
          actors: prompt.actors as string[],
          actions: (prompt.actions as any[]).map((a: any) => ({
            actor: a.actor,
            action: a.action,
          })),
          decisions: Array.isArray(prompt.decisions)
            ? (prompt.decisions as any[]).map((d: any) => ({
                condition: d.condition,
                branchyes:
                  d.branch_yes ?? d.branchyes ?? d.branchYes ?? 'Yes branch',
                branchno:
                  d.branch_no ?? d.branchno ?? d.branchNo ?? 'No branch',
                yes_action_index:
                  d.yes_action_index ?? d.yesActionIndex ?? null,
                no_action_index: d.no_action_index ?? d.noActionIndex ?? null,
              }))
            : null,
          parallelblocks: null,
        });
      } else {
        canvas.setStructure({ actors: [], actions: [], decisions: [] });
      }
    }
  }

  private onEditVersionLabelChange(event: Event): void {
    this.editVersionLabel = (event.target as HTMLInputElement).value;
  }

  private onEditDescriptionChange(event: Event): void {
    this.editDescriptionCurrent = (event.target as HTMLTextAreaElement).value;
  }

  private onRevertEditClick(): void {
    this.editDescriptionCurrent = this.editDescriptionOriginal;
    this.editError = '';
  }

  private onEditVersionDescriptionChange(event: Event): void {
    this.editVersionDescription = (event.target as HTMLTextAreaElement).value;
  }

  private async onEditGenerateClick(): Promise<void> {
    if (!this.editMode || this.editProcessId === null || !this.processDetail) return;

    const description = this.editDescriptionCurrent.trim();
    if (!description) {
      this.editError = 'Description must not be empty.';
      return;
    }

    const processName = this.processDetail.process_name;
    const domain = this.processDetail.domain ?? '';

    this.isGenerating = true;
    this.editError = '';

    const params = new URLSearchParams({ process_name: processName, domain });
    if (this.editVersionLabel.trim()) {
      params.append('version_name', this.editVersionLabel.trim());
    }

    try {
      const resp = await fetch(
        `http://localhost:8000/api/v1/generate-from-text?${params.toString()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description }),
        }
      );
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(
          `Backend returned status ${resp.status}${text ? ` – ${text.slice(0, 200)}` : ''}`
        );
      }
      const data = await resp.json();
      this.editGeneratedPlantuml = data.plantuml_code ?? '';
      this.editDescriptionOriginal = description;
      this.editPromptJson = data.prompt ?? null;
      this.editPromptText =
        data.prompt != null ? JSON.stringify(data.prompt, null, 2) : '';
      this.isPlantUmlExpanded = true;
      this.initCanvasForEdit(null, this.editPromptJson);
    } catch (error: unknown) {
      console.error('Failed to generate diagram from text', error);
      this.editError =
        error instanceof Error
          ? `Failed to generate diagram: ${error.message}`
          : 'Failed to generate diagram.';
    } finally {
      this.isGenerating = false;
    }
  }

  private async onEditSaveClick(): Promise<void> {
    if (!this.editMode || this.editProcessId === null) return;

    const code = this.editGeneratedPlantuml.trim();
    if (!code) {
      this.editError =
        'No generated PlantUML available. Please generate the diagram first.';
      return;
    }

    if (this.editPromptText.trim()) {
      try {
        this.editPromptJson = JSON.parse(this.editPromptText);
      } catch {
        this.editError =
          'Prompt JSON is not valid JSON. Please fix it or clear the field.';
        return;
      }
    } else {
      this.editPromptJson = {};
    }

    const editCanvas = this.renderRoot?.querySelector(
      'ad-canvas-editor:not([data-version-id])'
    ) as any;
    const canvasState =
      editCanvas && typeof editCanvas.getFullState === 'function'
        ? editCanvas.getFullState()
        : null;

    this.isGenerating = true;
    this.editError = '';

    const params = new URLSearchParams();
    if (this.editVersionLabel.trim()) {
      params.append('version_name', this.editVersionLabel.trim());
    }

    let url: string;
    let method: string;

    if (this.editMode === 'create') {
      url = `http://localhost:8000/api/v1/catalog/${this.editProcessId}/versions`;
      if (params.toString()) url += `?${params.toString()}`;
      method = 'POST';
    } else {
      if (this.editVersionNumber === null) {
        this.editError = 'Internal error: missing version number.';
        this.isGenerating = false;
        return;
      }
      url = `http://localhost:8000/api/v1/catalog/${this.editProcessId}/versions/${this.editVersionNumber}`;
      if (params.toString()) url += `?${params.toString()}`;
      method = 'PUT';
    }

    const payload = {
      plantuml_code: code,
      prompt: this.editPromptJson ?? {},
      canvas_state: canvasState,
      version_description: this.editVersionDescription.trim() || null,
    };

    try {
      const resp = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...this.authHeaders(),
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(
          `Backend returned status ${resp.status}${text ? ` – ${text.slice(0, 200)}` : ''}`
        );
      }

      const version = (await resp.json()) as CatalogVersion;
      this.editGeneratedPlantuml = version.plantuml_code;
      this.editVersionNumber = version.version_number;
      this.editVersionLabel = version.version_name;
      this.editVersionDescription = version.version_description ?? '';
      this.editPromptJson = version.prompt ?? null;
      this.editPromptText =
        version.prompt != null ? JSON.stringify(version.prompt, null, 2) : '';

      if (this.editMode === 'create') this.editMode = 'update';

      await this.loadProcessDetail(version.process_id);
      await this.loadProcesses();
    } catch (error: unknown) {
      console.error('Failed to save version', error);
      this.editError =
        error instanceof Error
          ? `Failed to save version: ${error.message}`
          : 'Failed to save version.';
    } finally {
      this.isGenerating = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ad-catalog-view': AdCatalogView;
  }
}