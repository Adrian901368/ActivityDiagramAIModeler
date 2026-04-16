// app/frontend/src/ad-app.ts
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './ad-login-view';
import './ad-catalog-view';
import './ad-canvas-editor';
import './ad-public-catalog-view';

type View = 'generate' | 'catalog' | 'public';

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
      flex-wrap: nowrap;
      min-width: 0;
    }

    .title-left {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1 1 0;
      overflow: hidden;
    }

    .title-right {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
      flex-wrap: wrap;
      justify-content: flex-end;
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
      flex-shrink: 0;
    }

    h1 {
      font-size: clamp(18px, 2.2vw, 30px);
      margin: 0;
      font-weight: 650;
      letter-spacing: 0.02em;
      color: #e5e7eb;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .subtitle {
      max-width: 860px;
      font-size: 15px;
      color: #9ca3af;
      line-height: 1.5;
    }

    /* Nav tabs */
    .nav-tabs {
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(55, 65, 81, 0.8);
      border-radius: 999px;
      padding: 4px;
    }

    .nav-tab {
      font-size: 13px;
      font-weight: 500;
      padding: 6px 16px;
      border-radius: 999px;
      border: none;
      cursor: pointer;
      font-family: inherit;
      color: #6b7280;
      background: transparent;
      transition:
        background 0.15s ease,
        color 0.15s ease,
        box-shadow 0.15s ease;
      white-space: nowrap;
    }

    .nav-tab:hover:not(.active) {
      color: #d1d5db;
      background: rgba(55, 65, 81, 0.4);
    }

    .nav-tab.active {
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: #e5e7eb;
      box-shadow: 0 2px 12px rgba(79, 70, 229, 0.5);
    }

    .nav-tab.public-tab.active {
      background: linear-gradient(135deg, #0369a1, #0284c7);
      box-shadow: 0 2px 12px rgba(3, 105, 161, 0.5);
    }

    .main-column {
      display: flex;
      flex-direction: column;
      gap: 18px;
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

    .label-optional {
      font-size: 11px;
      font-weight: 400;
      color: #4b5563;
      margin-left: 5px;
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

    .descriptions-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
    }

    .descriptions-grid textarea {
      min-height: 80px;
    }

    @media (max-width: 900px) {
      .descriptions-grid {
        grid-template-columns: minmax(0, 1fr);
      }
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

    button.danger {
      background: rgba(127, 29, 29, 0.9);
      color: #fee2e2;
      border: 1px solid rgba(248, 113, 113, 0.9);
    }

    button.danger:hover:not(:disabled) {
      background: rgba(153, 27, 27, 1);
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

    .user-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(55, 65, 81, 0.9);
      border-radius: 999px;
      padding: 5px 12px 5px 8px;
      font-size: 12px;
      color: #9ca3af;
    }

    .user-chip-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: #4ade80;
      box-shadow: 0 0 8px rgba(74, 222, 128, 0.7);
      flex-shrink: 0;
    }

    .user-chip-email {
      color: #d1d5db;
      font-weight: 500;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;

  // ---------------------------------------------------------------------------
  // Session resolution
  // ---------------------------------------------------------------------------

  private static resolveInitialEmail(): string {
    const stored = sessionStorage.getItem('ad_user_email');
    if (!stored) return '';

    try {
      const entries = performance.getEntriesByType(
        'navigation'
      ) as PerformanceNavigationTiming[];
      const navType = entries[0]?.type;

      if (navType === 'navigate' || navType === 'prerender') {
        sessionStorage.removeItem('ad_user_email');
        return '';
      }
    } catch {
      // Performance API unavailable — keep session as safe fallback
    }

    return stored;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  @state() private userEmail: string = AdApp.resolveInitialEmail();

  @state() private view: View = 'generate';

  @state() private processName = '';
  @state() private domain = '';
  @state() private versionName = '';
  @state() private processText = '';
  @state() private processDescription = '';
  @state() private initialVersionDescription = '';

  @state() private isGenerating = false;
  @state() private isSaving = false;
  @state() private plantuml = '';
  @state() private errorMessage = '';
  @state() private lastSaveSucceeded = false;

  @state() private lastPrompt: any = null;
  @state() private promptText = '';

  @state() private isPlantUmlExpanded = false;

  // ---------------------------------------------------------------------------
  // Auth helpers
  // ---------------------------------------------------------------------------

  private authHeaders(): Record<string, string> {
    return this.userEmail ? { 'X-User-Email': this.userEmail } : {};
  }

  private get isLoggedIn(): boolean {
    return this.userEmail.length > 0;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  override render() {
    if (!this.isLoggedIn) {
      return html`
        <ad-login-view @login-success=${this.onLoginSuccess}></ad-login-view>
      `;
    }

    switch (this.view) {
      case 'catalog':
        return this.renderCatalogView();
      case 'public':
        return this.renderPublicCatalogView();
      default:
        return this.renderGenerateView();
    }
  }

  // ---------------------------------------------------------------------------
  // Shared header helpers
  // ---------------------------------------------------------------------------

  private renderNavTabs() {
    return html`
      <div class="nav-tabs">
        <button
          class="nav-tab ${this.view === 'generate' ? 'active' : ''}"
          @click=${() => this.onNavTabClick('generate')}
        >
          Generator
        </button>
        <button
          class="nav-tab ${this.view === 'catalog' ? 'active' : ''}"
          @click=${() => this.onNavTabClick('catalog')}
        >
          My catalog
        </button>
        <button
          class="nav-tab public-tab ${this.view === 'public' ? 'active' : ''}"
          @click=${() => this.onNavTabClick('public')}
        >
          Public catalog
        </button>
      </div>
    `;
  }

  private renderUserChip() {
    if (!this.isLoggedIn) return null;
    return html`
      <div style="display: flex; align-items: center; gap: 10px;">
        <div class="user-chip">
          <span class="user-chip-dot"></span>
          <span class="user-chip-email" title=${this.userEmail}>
            ${this.userEmail}
          </span>
        </div>
        <button
          class="danger"
          style="font-size: 12px; padding: 6px 12px;"
          @click=${this.onLogoutClick}
        >
          Log out
        </button>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  private renderGenerateView() {
    return html`
      <div class="page">
        <header>
          <div class="title-row">
            <div class="title-left">
              <div class="badge">
                <span class="badge-dot"></span>
                UML Activity Diagrams Generator
              </div>
              <h1>AI-supported UML activity diagram Modeling Tool<br/>and Catalog</h1>
            </div>
            <div class="title-right">
              ${this.renderNavTabs()}
              ${this.renderUserChip()}
            </div>
          </div>
          <p class="subtitle">
            Describe a process in natural language and let the model generate a
            UML activity diagram. You can store multiple versions per process
            or domain and share to public catalog. 
          </p>
        </header>

        <div class="main-column">
          <section class="card">
            <div class="card-header">
              <div>
                <div class="card-title">Create a process</div>
                <div class="card-subtitle">
                  Name the process, specify domain and describe the flow in
                  text.
                </div>
              </div>
            </div>

            <div class="meta-grid">
              <div>
                <label for="processName">Process Name</label>
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
                <label for="versionName">Version Label</label>
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

            <div class="descriptions-grid">
              <div>
                <label for="processDescription">
                  Process description
                  <span class="label-optional">optional</span>
                </label>
                <textarea
                  id="processDescription"
                  .value=${this.processDescription}
                  @input=${this.onProcessDescriptionChange}
                  placeholder="Brief description of process."
                ></textarea>
              </div>
              <div>
                <label for="initialVersionDescription">
                  Initial Version Description
                  <span class="label-optional">optional</span>
                </label>
                <textarea
                  id="initialVersionDescription"
                  .value=${this.initialVersionDescription}
                  @input=${this.onInitialVersionDescriptionChange}
                  placeholder="Notes about this specific version."
                ></textarea>
              </div>
            </div>

            <div>
              <label for="processText">Prompt From Scratch</label>
              <textarea
                id="processText"
                .value=${this.processText}
                @input=${this.onTextChange}
                placeholder="Describe the process step-by-step. Include actors, decisions, and important alternative or error flows."
              ></textarea>
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
                  ?disabled=${this.isSaving || !this.plantuml.trim()}
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
            <div class="card-header">
              <div>
                <div class="card-title">Visual canvas editor</div>
                <div class="card-subtitle">
                  Drag UML activity nodes between swimlanes and reorder them
                  visually.
                </div>
              </div>
            </div>

            <ad-canvas-editor
              @structure-change=${this.onCanvasStructureChange}
            ></ad-canvas-editor>

            <div class="hint">
              Use the toolbar inside the canvas to add actions and arrange
              them. The editor emits a structured representation compatible
              with your backend model.
            </div>
          </section>

          <section class="card">
            <div class="diagram-header" style="margin-bottom: 0;">
              <div>
                <div class="diagram-title">Generated PlantUML</div>
                <div class="diagram-meta">
                  Inspect the PlantUML generated code.
                </div>
              </div>
              <button
                class="secondary"
                style="font-size: 12px; padding: 6px 12px;"
                ?disabled=${!this.plantuml}
                @click=${this.onTogglePlantUmlClick}
              >
                ${this.isPlantUmlExpanded ? 'Hide code' : 'Show code'}
              </button>
            </div>

            ${this.isPlantUmlExpanded
              ? html`
                  <div style="margin-top: 12px;">
                    ${this.plantuml
                      ? html`<pre>${this.plantuml}</pre>`
                      : html`<div class="placeholder">
                          Generated PlantUML code will appear here after you
                          run generation.
                        </div>`}
                  </div>
                `
              : null}
          </section>
        </div>
      </div>
    `;
  }

  private renderCatalogView() {
    return html`
      <div class="page">
        <header>
          <div class="title-row">
            <div class="title-left">
              <div class="badge">
                <span class="badge-dot"></span>
                UML Activity Catalog
              </div>
              <h1>My Catalog of Processes</h1>
            </div>
            <div class="title-right">
              ${this.renderNavTabs()}
              ${this.renderUserChip()}
            </div>
          </div>
          <p class="subtitle">
            Browse your processes, manage version history for each activity diagram.
          </p>
        </header>

        <ad-catalog-view .userEmail=${this.userEmail}></ad-catalog-view>
      </div>
    `;
  }

  private renderPublicCatalogView() {
    return html`
      <div class="page">
        <header>
          <div class="title-row">
            <div class="title-left">
              <div class="badge" style="color: #7dd3fc;">
                <span
                  class="badge-dot"
                  style="background: #38bdf8; box-shadow: 0 0 12px rgba(56,189,248,0.7);"
                ></span>
                UML activity Public Catalog
              </div>
              <h1>Public Catalog of Processes</h1>
            </div>
            <div class="title-right">
              ${this.renderNavTabs()}
              ${this.renderUserChip()}
            </div>
          </div>
          <p class="subtitle">
            Browse and clone publicly shared processes contributed by all
            users.
          </p>
        </header>

        <ad-public-catalog-view
          .userEmail=${this.userEmail}
        ></ad-public-catalog-view>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Auth handlers
  // ---------------------------------------------------------------------------

  private onLoginSuccess(e: CustomEvent): void {
    this.userEmail = (e.detail as { email: string }).email;
    sessionStorage.setItem('ad_user_email', this.userEmail);
  }

  private onLogoutClick(): void {
    sessionStorage.removeItem('ad_user_email');
    this.userEmail = '';
    this.view = 'generate';
    this.plantuml = '';
    this.processText = '';
    this.processName = '';
    this.domain = '';
    this.versionName = '';
    this.processDescription = '';
    this.initialVersionDescription = '';
    this.lastPrompt = null;
    this.promptText = '';
    this.errorMessage = '';
    this.lastSaveSucceeded = false;
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  private onNavTabClick(view: View): void {
    this.view = view;
  }

  // ---------------------------------------------------------------------------
  // Input handlers
  // ---------------------------------------------------------------------------

  private onProcessNameChange(e: Event): void {
    this.processName = (e.target as HTMLInputElement).value;
  }

  private onDomainChange(e: Event): void {
    this.domain = (e.target as HTMLInputElement).value;
  }

  private onVersionNameChange(e: Event): void {
    this.versionName = (e.target as HTMLInputElement).value;
  }

  private onProcessDescriptionChange(e: Event): void {
    this.processDescription = (e.target as HTMLTextAreaElement).value;
  }

  private onInitialVersionDescriptionChange(e: Event): void {
    this.initialVersionDescription = (e.target as HTMLTextAreaElement).value;
  }

  private onTextChange(e: Event): void {
    this.processText = (e.target as HTMLTextAreaElement).value;
  }

  private onCanvasStructureChange(e: CustomEvent): void {
    try {
      this.promptText = JSON.stringify(e.detail, null, 2);
    } catch {
      // Ignore serialization errors
    }
  }

  private onTogglePlantUmlClick(): void {
    this.isPlantUmlExpanded = !this.isPlantUmlExpanded;
  }

  // ---------------------------------------------------------------------------
  // Generate
  // ---------------------------------------------------------------------------

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
      const params = new URLSearchParams({ process_name: name, domain });
      if (version) params.set('version_name', version);

      const response = await fetch(
        `http://localhost:8000/api/v1/generate-from-text?${params.toString()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description }),
        }
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
      this.plantuml = data.plantuml_code ?? JSON.stringify(data, null, 2);

      const prompt = data.prompt ?? null;
      this.lastPrompt = prompt;

      if (
        prompt &&
        Array.isArray(prompt.actors) &&
        Array.isArray(prompt.actions)
      ) {
        const structure = {
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
                no_action_index:
                  d.no_action_index ?? d.noActionIndex ?? null,
              }))
            : null,
          parallelblocks: null,
        };

        this.promptText = JSON.stringify(structure, null, 2);

        const canvas = this.renderRoot?.querySelector(
          'ad-canvas-editor'
        ) as any;
        if (canvas && typeof canvas.setStructure === 'function') {
          canvas.setStructure(structure);
        }
      } else {
        this.promptText =
          prompt != null ? JSON.stringify(prompt, null, 2) : '';
      }
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

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  private async onSaveClick(): Promise<void> {
    const name = this.processName.trim();
    const domain = this.domain.trim();
    const version = this.versionName.trim();
    const code = this.plantuml.trim();
    const processDesc = this.processDescription.trim();
    const versionDesc = this.initialVersionDescription.trim();

    this.errorMessage = '';
    this.lastSaveSucceeded = false;

    if (!name || !domain || !code) {
      this.errorMessage =
        'Process name, domain and generated PlantUML code are required to save.';
      return;
    }

    let promptForSave: any = {};
    if (this.promptText.trim()) {
      try {
        promptForSave = JSON.parse(this.promptText);
      } catch {
        this.errorMessage =
          'Prompt JSON is not valid JSON. Please fix it or clear the field.';
        return;
      }
    } else {
      promptForSave = this.lastPrompt ?? {};
    }

    const canvas = this.renderRoot?.querySelector('ad-canvas-editor') as any;
    const canvasState =
      canvas && typeof canvas.getFullState === 'function'
        ? canvas.getFullState()
        : null;

    this.isSaving = true;

    try {
      const params = new URLSearchParams({ process_name: name, domain });
      if (version) params.set('version_name', version);
      if (processDesc) params.set('process_description', processDesc);

      const payload = {
        plantuml_code: code,
        prompt: promptForSave,
        canvas_state: canvasState,
        version_description: versionDesc || null,
      };

      const response = await fetch(
        `http://localhost:8000/api/v1/catalog/save?${params.toString()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.authHeaders(),
          },
          body: JSON.stringify(payload),
        }
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

  // ---------------------------------------------------------------------------
  // Misc handlers
  // ---------------------------------------------------------------------------

  private onClearClick(): void {
    this.processText = '';
    this.plantuml = '';
    this.versionName = '';
    this.processDescription = '';
    this.initialVersionDescription = '';
    this.errorMessage = '';
    this.lastSaveSucceeded = false;
    this.lastPrompt = null;
    this.promptText = '';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ad-app': AdApp;
  }
}