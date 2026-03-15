import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './ad-catalog-view'; // catalog screen

interface CatalogProcess {
  id: number;
  name: string;
  domain: string | null;
  versions_count: number;
}

type View = 'generate' | 'catalog';

@customElement('ad-app')
export class AdApp extends LitElement {
  static override styles = css`
    :host {
      display: block;
      min-height: 100vh;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
        sans-serif;
      background: #0f172a;
      color: #e5e7eb;
    }

    .page {
      max-width: 1360px;
      margin: 0 auto;
      padding: 24px 16px 48px;
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    header {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .badge {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #a5b4fc;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #4ade80;
      box-shadow: 0 0 12px rgba(74, 222, 128, 0.7);
    }

    h1 {
      font-size: clamp(28px, 3vw, 34px);
      margin: 0;
      font-weight: 650;
      letter-spacing: 0.02em;
      color: #e5e7eb;
    }

    .subtitle {
      max-width: 720px;
      font-size: 15px;
      color: #9ca3af;
      line-height: 1.5;
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 0.6fr) minmax(0, 2fr);
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
        0 0 21px rgba(15, 23, 42, 0.8);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .sidebar {
      min-height: 260px;
    }

    .main-column {
      display: flex;
      flex-direction: column;
      gap: 18px;
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

    label {
      font-size: 14px;
      font-weight: 500;
      color: #d1d5db;
      display: inline-block;
      margin-bottom: 4px;
    }

    input[type='text'],
    textarea {
      width: 100%;
      background: rgba(15, 23, 42, 0.8);
      border-radius: 10px;
      border: 1px solid rgba(55, 65, 81, 0.9);
      color: #e5e7eb;
      font-family: inherit;
      font-size: 14px;
      padding: 9px 11px;
      box-sizing: border-box;
      outline: none;
      transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease,
        background 0.15s ease;
    }

    input[type='text']:focus,
    textarea:focus {
      border-color: #4f46e5;
      box-shadow:
        0 0 1px rgba(79, 70, 229, 0.8),
        0 0 24px rgba(59, 130, 246, 0.4);
      background: rgba(15, 23, 42, 0.95);
    }

    textarea {
      min-height: 160px;
      resize: vertical;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 4px;
    }

    @media (max-width: 900px) {
      .meta-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .hint {
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
    }

    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 28px;
      margin-top: 16px;
    }

    .button-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    button {
      border-radius: 999px;
      border: none;
      cursor: pointer;
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      padding: 9px 16px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition:
        transform 0.12s ease,
        box-shadow 0.12s ease,
        background 0.12s ease,
        opacity 0.12s ease;
    }

    button.primary {
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: white;
      box-shadow:
        0 14px 30px rgba(79, 70, 229, 0.5),
        0 0 1px rgba(129, 140, 248, 0.7);
    }

    button.primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow:
        0 18px 40px rgba(79, 70, 229, 0.7),
        0 0 1px rgba(129, 140, 248, 0.9);
    }

    button.secondary {
      background: rgba(15, 23, 42, 0.75);
      color: #9ca3af;
      border: 1px solid rgba(55, 65, 81, 0.9);
    }

    button.text {
      background: transparent;
      color: #9ca3af;
      padding-inline: 0;
      border-radius: 0;
      border: none;
      box-shadow: none;
    }

    button.text:hover:not(:disabled) {
      background: rgba(15, 23, 42, 0.6);
      box-shadow: none;
      transform: none;
    }

    button.full-width {
      width: 100%;
      justify-content: center;
    }

    button:disabled {
      opacity: 0.6;
      cursor: default;
      transform: none;
      box-shadow: none;
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

    .diagram-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }

    .diagram-title {
      font-size: 14px;
      font-weight: 500;
      color: #d1d5db;
    }

    .diagram-meta {
      font-size: 11px;
      color: #6b7280;
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
      max-height: 360px;
      overflow: auto;
      white-space: pre;
      line-height: 1.45;
    }

    .placeholder {
      font-size: 13px;
      color: #6b7280;
      padding: 18px 14px;
      text-align: left;
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

    .process-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 360px;
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

    .catalog-actions {
      margin-top: 10px;
    }

    .catalog-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .pill {
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(55, 65, 81, 0.9);
      color: #9ca3af;
    }
  `;

  @state() private view: View = 'generate';

  @state() private processName = '';
  @state() private domain = '';
  @state() private versionName = '';
  @state() private processText = '';

  @state() private isGenerating = false;
  @state() private isSaving = false;
  @state() private plantuml = '';
  @state() private errorMessage = '';
  @state() private lastSaveSucceeded = false;

  @state() private processes: CatalogProcess[] = [];
  @state() private isLoadingProcesses = false;
  @state() private processesError = '';

  // Stores last structured prompt returned by backend
  @state() private lastPrompt: any = null;
  // Editable JSON representation of the structured prompt
  @state() private promptText = '';

  override firstUpdated(): void {
    this.loadProcesses();
  }

  private async loadProcesses(): Promise<void> {
    this.isLoadingProcesses = true;
    this.processesError = '';
    try {
      const resp = await fetch(
        'http://localhost:8000/api/v1/catalog/processes',
      );
      if (!resp.ok) {
        throw new Error(`Backend returned status ${resp.status}`);
      }
      const data = (await resp.json()) as CatalogProcess[];
      this.processes = data.sort((a, b) => b.id - a.id);
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

  override render() {
    return this.view === 'generate'
      ? this.renderGenerateView()
      : this.renderCatalogView();
  }

  private renderGenerateView() {
    const promptPlaceholder =
      '{\n  "process_name": "...",\n  "domain": "...",\n  "actors": [...],\n  "actions": [...],\n  "decisions": [...]\n}';

    return html`
      <div class="page">
        <header>
          <div class="title-row">
            <div>
              <div class="badge">
                <span class="badge-dot"></span>
                UML Activity Generator
              </div>
              <h1>AI-supported UML activity diagram modeling</h1>
            </div>
          </div>
          <p class="subtitle">
            Describe a process in natural language and let the model generate a
            UML activity diagram in PlantUML syntax. You can store multiple
            versions per process and domain.
          </p>
        </header>

        <div class="layout">
          <aside class="card sidebar">
            <div class="card-header">
              <div>
                <div class="card-title">Processes in catalog</div>
                <div class="card-subtitle">
                  Existing processes with number of stored versions.
                </div>
              </div>
              <button
                class="text"
                @click=${this.onEnterCatalogClick}
                ?disabled=${this.view === 'catalog'}
              >
                Open full catalog
              </button>
            </div>

            ${this.renderProcessesPanel()}
          </aside>

          <div class="main-column">
            <section class="card">
              <div class="card-header">
                <div>
                  <div class="card-title">Process description</div>
                  <div class="card-subtitle">
                    Name the process, specify domain and describe the flow in
                    text.
                  </div>
                </div>
              </div>

              <div class="meta-grid">
                <div>
                  <label for="processName">Process name</label>
                  <input
                    id="processName"
                    type="text"
                    .value=${this.processName}
                    @input=${this.onProcessNameChange}
                    placeholder="e.g. Course registration"
                    autocomplete="off"
                  />
                </div>
                <div>
                  <label for="domain">Domain</label>
                  <input
                    id="domain"
                    type="text"
                    .value=${this.domain}
                    @input=${this.onDomainChange}
                    placeholder="e.g. University"
                    autocomplete="off"
                  />
                </div>
                <div>
                  <label for="versionName">Version label</label>
                  <input
                    id="versionName"
                    type="text"
                    .value=${this.versionName}
                    @input=${this.onVersionNameChange}
                    placeholder="e.g. v1 - initial draft"
                    autocomplete="off"
                  />
                </div>
              </div>

              <div>
                <label for="processText">Text prompt</label>
                <textarea
                  id="processText"
                  .value=${this.processText}
                  @input=${this.onTextChange}
                  placeholder="Describe the process step-by-step. Include actors, decisions, and important alternative or error flows."
                ></textarea>
                <div class="hint">
                  Tip: Start from one of the scenarios in your thesis and
                  refine it into a precise step-by-step description.
                </div>
              </div>

              <div class="actions">
                <div class="button-row">
                  <button
                    class="primary"
                    ?disabled=${this.isGenerating ||
                    this.isSaving ||
                    !this.processText.trim()}
                    @click=${this.onGenerateClick}
                  >
                    ${this.isGenerating ? 'Generating…' : 'Generate diagram'}
                  </button>
                  <button
                    class="secondary"
                    ?disabled=${!this.plantuml.trim()}
                    @click=${this.onSaveClick}
                  >
                    ${this.isSaving ? 'Saving…' : 'Save to catalog'}
                  </button>
                  <button
                    class="text"
                    ?disabled=${!this.plantuml && !this.processText}
                    @click=${this.onClearClick}
                  >
                    Clear
                  </button>
                </div>
                <div class="status">
                  <span
                    class="status-dot ${this.errorMessage
                      ? 'error'
                      : this.lastSaveSucceeded
                        ? ''
                        : 'pending'}"
                    aria-hidden="true"
                  ></span>
                  ${this.errorMessage
                    ? 'Last operation failed.'
                    : this.lastSaveSucceeded
                      ? 'Last save succeeded.'
                      : 'Ready. Describe a process and generate a diagram.'}
                </div>
              </div>

              ${this.errorMessage
                ? html`<div class="error">${this.errorMessage}</div>`
                : null}
            </section>

            <section class="card">
              <div class="diagram-header">
                <div>
                  <div class="diagram-title">Prompt JSON & Generated PlantUML</div>
                  <div class="diagram-meta">
                    Inspect or edit the structured JSON before saving, and view
                    the PlantUML code.
                  </div>
                </div>
              </div>

              <div style="margin-bottom: 10px;">
                <label for="promptJson">Prompt JSON (optional, editable)</label>
                <textarea
                  id="promptJson"
                  .value=${this.promptText}
                  @input=${this.onPromptJsonChange}
                  placeholder=${promptPlaceholder}
                ></textarea>
                <div class="hint">
                  You can adjust the structured JSON before saving. If left
                  empty, the last generated prompt (if any) will be used.
                </div>
              </div>

              ${this.plantuml
                ? html`<pre>${this.plantuml}</pre>`
                : html`<div class="placeholder">
                    Generated PlantUML code will appear here after you run
                    generation.
                  </div>`}
            </section>
          </div>
        </div>
      </div>
    `;
  }

  private renderCatalogView() {
    return html`
      <div class="page">
        <header>
          <div class="title-row">
            <div>
              <div class="badge">
                <span class="badge-dot"></span>
                UML Activity Catalog
              </div>
              <h1>Catalog of generated activity diagrams</h1>
            </div>
            <button class="secondary" @click=${this.onBackToGenerateClick}>
              Back to generator
            </button>
          </div>
          <p class="subtitle">
            Browse processes, their versions and inspect PlantUML code for each
            activity diagram.
          </p>
        </header>

        <ad-catalog-view></ad-catalog-view>
      </div>
    `;
  }

  private renderProcessesPanel() {
    if (this.isLoadingProcesses) {
      return html`<div class="placeholder small">Loading processes…</div>`;
    }

    if (this.processesError) {
      return html`<div class="error small">${this.processesError}</div>`;
    }

    if (!this.processes.length) {
      return html`<div class="placeholder small">
        No processes in the catalog yet. Generate and save your first diagram.
      </div>`;
    }

    return html`
      <ul class="process-list">
        ${this.processes.map(
          (p) => html`
            <li class="process-item" @click=${() => this.onProcessClick(p)}>
              <div class="process-name">${p.name}</div>
              <div class="process-meta">
                ${p.domain ?? 'No domain'} • ${p.versions_count} version(s)
              </div>
            </li>
          `,
        )}
      </ul>
      <div class="catalog-actions">
        <button class="secondary full-width" @click=${this.onEnterCatalogClick}>
          Enter catalog
        </button>
      </div>
    `;
  }

  private onProcessNameChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    this.processName = target.value;
  }

  private onDomainChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    this.domain = target.value;
  }

  private onVersionNameChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    this.versionName = target.value;
  }

  private onTextChange(e: Event): void {
    const target = e.target as HTMLTextAreaElement;
    this.processText = target.value;
  }

  private onPromptJsonChange(e: Event): void {
    const target = e.target as HTMLTextAreaElement;
    this.promptText = target.value;
  }

  private async onGenerateClick(): Promise<void> {
    const name = this.processName.trim();
    const domain = this.domain.trim();
    const version = this.versionName.trim();
    const description = this.processText.trim();

    this.errorMessage = '';
    this.lastSaveSucceeded = false;

    if (!name || !domain || !description) {
      this.errorMessage = 'Process name, domain and text prompt are required.';
      return;
    }

    this.isGenerating = true;
    this.lastPrompt = null;
    this.promptText = '';

    try {
      const params = new URLSearchParams();
      params.set('process_name', name);
      params.set('domain', domain);
      if (version) {
        params.set('version_name', version);
      }

      const response = await fetch(
        `http://localhost:8000/api/v1/generate-from-text?${params.toString()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ description }),
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        const detail =
          err && typeof err.detail === 'string'
            ? err.detail
            : `Backend returned status ${response.status}`;
        throw new Error(detail);
      }

      const data = await response.json();
      this.plantuml =
        data.plantuml_code ?? JSON.stringify(data, null, 2);
      this.lastPrompt = data.prompt ?? null;
      this.promptText =
        data.prompt != null ? JSON.stringify(data.prompt, null, 2) : '';
    } catch (error: unknown) {
      console.error('Generation failed', error);
      this.errorMessage =
        error instanceof Error
          ? `Generation failed: ${error.message}`
          : 'Generation failed due to an unknown error.';
    } finally {
      this.isGenerating = false;
    }
  }

  private async onSaveClick(): Promise<void> {
    const name = this.processName.trim();
    const domain = this.domain.trim();
    const version = this.versionName.trim();
    const code = this.plantuml.trim();

    this.errorMessage = '';
    this.lastSaveSucceeded = false;

    if (!name || !domain || !code) {
      this.errorMessage =
        'Process name, domain and generated PlantUML code are required to save.';
      return;
    }

    // Validate / choose prompt JSON before we start saving
    let promptForSave: any = {};
    if (this.promptText.trim()) {
      try {
        promptForSave = JSON.parse(this.promptText);
      } catch (err) {
        this.errorMessage =
          'Prompt JSON is not valid JSON. Please fix it or clear the field.';
        return;
      }
    } else {
      // If user left JSON empty, fall back to lastPrompt or empty object
      promptForSave = this.lastPrompt ?? {};
    }

    this.isSaving = true;

    try {
      const params = new URLSearchParams();
      params.set('process_name', name);
      params.set('domain', domain);
      if (version) {
        params.set('version_name', version);
      }

      const payload = {
        plantuml_code: code,
        prompt: promptForSave,
      };

      const response = await fetch(
        `http://localhost:8000/api/v1/catalog/save?${params.toString()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        const detail =
          err && typeof err.detail === 'string'
            ? err.detail
            : `Backend returned status ${response.status}`;
        throw new Error(detail);
      }

      this.lastSaveSucceeded = true;
      await this.loadProcesses();
    } catch (error: unknown) {
      console.error('Save failed', error);
      this.errorMessage =
        error instanceof Error
          ? `Save failed: ${error.message}`
          : 'Save failed due to an unknown error.';
    } finally {
      this.isSaving = false;
    }
  }

  private onClearClick(): void {
    this.processText = '';
    this.plantuml = '';
    this.versionName = '';
    this.errorMessage = '';
    this.lastSaveSucceeded = false;
    this.lastPrompt = null;
    this.promptText = '';
  }

  private onEnterCatalogClick(): void {
    this.view = 'catalog';
  }

  private onBackToGenerateClick(): void {
    this.view = 'generate';
  }

  private onProcessClick(process: CatalogProcess): void {
    this.processName = process.name;
    this.domain = process.domain ?? '';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ad-app': AdApp;
  }
}
