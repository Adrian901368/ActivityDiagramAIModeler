import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

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
  created_at: string;
  llm_model: string;
  tokens_used: number | null;
  status: string;
  plantuml_code: string;
}

interface CatalogProcessDetail {
  process_id: number;
  process_name: string;
  domain: string | null;
  versions: CatalogVersion[];
}

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

    button.danger {
      background: rgba(127, 29, 29, 0.9);
      color: #fee2e2;
      border: 1px solid rgba(248, 113, 113, 0.9);
    }

    button.danger:hover {
      background: rgba(153, 27, 27, 1);
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
  `;

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

  override firstUpdated(): void {
    this.loadProcesses();
  }

  private async loadProcesses(): Promise<void> {
    this.isLoadingProcesses = true;
    this.processesError = '';

    const params = new URLSearchParams();
    if (this.nameFilter.trim()) {
      params.append('name', this.nameFilter.trim());
    }
    if (this.domainFilter.trim()) {
      params.append('domain', this.domainFilter.trim());
    }

    const url =
      params.toString().length > 0
        ? `http://localhost:8000/api/v1/catalog/processes?${params.toString()}`
        : 'http://localhost:8000/api/v1/catalog/processes';

    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Backend returned status ${resp.status}`);
      }
      const data = (await resp.json()) as CatalogProcess[];
      this.processes = data;

      if (data.length > 0 && this.selectedProcessId === null) {
        this.onSelectProcess(data[0]);
      } else if (
        this.selectedProcessId !== null &&
        !data.some((p) => p.id === this.selectedProcessId)
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

    const url = `http://localhost:8000/api/v1/catalog/${processId}`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Backend returned status ${resp.status}`);
      }
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

  override render() {
    return html`
      <div class="layout">
        ${this.renderLeftColumn()} ${this.renderRightColumn()}
      </div>
    `;
  }

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
          (p) => html`<li
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
          </li>`
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
    if (!this.processDetail) {
      return html``;
    }
    return html`
      <button
        class="danger"
        @click=${this.onDeleteProcessClick}
        ?disabled=${this.isDeletingProcess}
      >
        Delete process
      </button>
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

    const { process_name, domain, versions } = this.processDetail;

    return html`
      <div class="versions-header">
        <div>
          <div class="versions-title">${process_name}</div>
          <div class="card-subtitle">
            Domain: ${domain ?? 'No domain'} · ${versions.length}
            version${versions.length === 1 ? '' : 's'}
          </div>
        </div>
        <span class="pill">
          Manage versions: publish or delete, inspect PlantUML code
        </span>
      </div>

      ${versions.length === 0
        ? html`<div class="placeholder small">
            This process has no stored versions yet.
          </div>`
        : html`
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Version name</th>
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

  private renderVersionRow(v: CatalogVersion) {
    const statusClass =
      v.status === 'active'
        ? 'active'
        : v.status === 'draft'
        ? 'draft'
        : 'archived';

    const canPublish = v.status !== 'active';

    return html`
      <tr>
        <td>${v.version_number}</td>
        <td>${v.version_name || '—'}</td>
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
              ${this.expandedVersionId === v.id ? 'Hide' : 'Show'} code
            </button>
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
      <pre>
${v.plantuml_code}
      </pre>
    `;
  }

  private onNameFilterChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.nameFilter = target.value;
  }

  private onDomainFilterChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.domainFilter = target.value;
  }

  private onReloadClick(): void {
    this.loadProcesses();
  }

  private onSelectProcess(process: CatalogProcess): void {
    this.selectedProcessId = process.id;
    this.loadProcessDetail(process.id);
  }

  private onTogglePlantuml(versionId: number): void {
    this.expandedVersionId =
      this.expandedVersionId === versionId ? null : versionId;
  }

  private async onDeleteAllClick(): Promise<void> {
    if (!confirm('Delete ALL processes and their versions from catalog?')) {
      return;
    }
    this.isDeletingAll = true;
    try {
      const resp = await fetch('http://localhost:8000/api/v1/catalog', {
        method: 'DELETE',
      });
      if (!resp.ok) {
        throw new Error(`Backend returned status ${resp.status}`);
      }
      this.selectedProcessId = null;
      this.processDetail = null;
      this.expandedVersionId = null;
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
    ) {
      return;
    }

    this.isDeletingProcess = true;
    try {
      const resp = await fetch(
        `http://localhost:8000/api/v1/catalog/${this.processDetail.process_id}`,
        { method: 'DELETE' }
      );
      if (!resp.ok) {
        throw new Error(`Backend returned status ${resp.status}`);
      }
      this.selectedProcessId = null;
      this.processDetail = null;
      this.expandedVersionId = null;
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
    ) {
      return;
    }

    this.isMutatingVersion = true;
    try {
      const resp = await fetch(
        `http://localhost:8000/api/v1/catalog/${v.process_id}/versions/${
          v.version_number
        }`,
        { method: 'DELETE' }
      );
      if (!resp.ok) {
        throw new Error(`Backend returned status ${resp.status}`);
      }
      if (this.expandedVersionId === v.id) {
        this.expandedVersionId = null;
      }
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
    if (!confirm(`Publish version #${v.version_number}?`)) {
      return;
    }

    this.isMutatingVersion = true;
    try {
      const resp = await fetch(
        `http://localhost:8000/api/v1/catalog/${v.process_id}/versions/${
          v.version_number
        }/publish`,
        { method: 'PUT' }
      );
      if (!resp.ok) {
        throw new Error(`Backend returned status ${resp.status}`);
      }
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
}

declare global {
  interface HTMLElementTagNameMap {
    'ad-catalog-view': AdCatalogView;
  }
}
