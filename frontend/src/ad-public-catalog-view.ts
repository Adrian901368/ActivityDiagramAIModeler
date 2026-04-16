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
  `;

  @property({ type: String }) userEmail = '';

  @state() private nameFilter = '';
  @state() private ownerFilter = '';

  @state() private processes: PublicCatalogListItem[] = [];
  @state() private isLoadingProcesses = false;
  @state() private processesError = '';

  @state() private selectedProcessId: number | null = null;
  @state() private processDetail: PublicCatalogProcess | null = null;
  @state() private isLoadingDetail = false;
  @state() private detailError = '';

  @state() private expandedVersionId: number | null = null;
  @state() private isDetailCodeExpanded = false;

  // ---------------------------------------------------------------------------
  // Auth header helper — used by every fetch in this component
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

  // Reload the list whenever the parent passes a new/resolved userEmail.
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

    const qs = params.toString();
    const url = qs
      ? `http://localhost:8000/api/v1/catalog/public?${qs}`
      : 'http://localhost:8000/api/v1/catalog/public';

    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: this.authHeaders,   // <-- FIX: header pridaný
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

    try {
      const resp = await fetch(
        `http://localhost:8000/api/v1/catalog/public/${processId}`,
        {
          method: 'GET',
          headers: this.authHeaders,   // <-- FIX: header pridaný
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
  // Render
  // ---------------------------------------------------------------------------

  override render() {
    // Guard: show warning if parent did not pass userEmail yet
    if (!this.userEmail) {
      return html`
        <div class="not-logged-in">
          ⚠ You must be logged in to browse the public catalog.
        </div>
      `;
    }

    return html`
      <div class="layout">
        ${this.renderLeftColumn()} ${this.renderRightColumn()}
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
          Public catalog — read-only view. No edits or deletions possible.
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
        <div class="card-subtitle">Visual diagram representation</div>

        ${v.version_description
          ? html`<div class="process-description-box" style="margin-top: 6px;">
              ${v.version_description}
            </div>`
          : null}

        ${v.prompt
          ? html`
              <div
                style="position: relative; overflow: hidden; border-radius: 8px; margin-top: 8px;"
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
          ? html`<pre>${v.plantuml_code}</pre>`
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

  private onReloadClick(): void {
    this.loadProcesses();
  }

  private onSelectProcess(process: PublicCatalogListItem): void {
    this.selectedProcessId = process.id;
    this.isDetailCodeExpanded = false;
    this.loadProcessDetail(process.id);
  }

  private onToggleVersion(versionId: number): void {
    this.expandedVersionId =
      this.expandedVersionId === versionId ? null : versionId;
    this.isDetailCodeExpanded = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ad-public-catalog-view': AdPublicCatalogView;
  }
}