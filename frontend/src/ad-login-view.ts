// app/frontend/src/ad-login-view.ts
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

declare const __API_BASE_URL__: string;
const API_BASE = __API_BASE_URL__;

@customElement('ad-login-view')
export class AdLoginView extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: radial-gradient(ellipse at top, #0f172a, #020617 70%);
    }

    .login-card {
      background: radial-gradient(circle at top left, #1e293b, #020617 70%);
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 20px;
      padding: 40px 36px 36px;
      width: 100%;
      max-width: 400px;
      box-shadow:
        0 24px 60px rgba(15, 23, 42, 0.7),
        0 0 0 1px rgba(15, 23, 42, 0.8);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .login-header {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 4px;
    }

    .login-title {
      font-size: 22px;
      font-weight: 700;
      color: #f1f5f9;
      letter-spacing: -0.01em;
    }

    .login-subtitle {
      font-size: 13px;
      color: #6b7280;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    label {
      font-size: 12px;
      font-weight: 500;
      color: #d1d5db;
    }

    input {
      width: 100%;
      background: rgba(15, 23, 42, 0.8);
      border-radius: 10px;
      border: 1px solid rgba(55, 65, 81, 0.9);
      color: #e5e7eb;
      font-family: inherit;
      font-size: 14px;
      padding: 10px 12px;
      box-sizing: border-box;
      outline: none;
      transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease;
    }

    input:focus {
      border-color: #4f46e5;
      box-shadow:
        0 0 0 1px rgba(79, 70, 229, 0.8),
        0 0 18px rgba(59, 130, 246, 0.25);
    }

    .error {
      font-size: 12px;
      color: #fecaca;
      background: rgba(153, 27, 27, 0.35);
      border: 1px solid rgba(248, 113, 113, 0.6);
      border-radius: 10px;
      padding: 9px 12px;
    }

    button.primary {
      width: 100%;
      padding: 11px;
      border-radius: 999px;
      border: 1px solid rgba(129, 140, 248, 0.9);
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: #f1f5f9;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition:
        background 0.15s ease,
        opacity 0.15s ease;
      margin-top: 4px;
    }

    button.primary:hover {
      background: linear-gradient(135deg, #4338ca, #6d28d9);
    }

    button.primary:disabled {
      opacity: 0.55;
      cursor: default;
    }
  `;

  @state() private email = '';
  @state() private password = '';
  @state() private error = '';
  @state() private isLoading = false;

  private async onSubmit(e: Event): Promise<void> {
    e.preventDefault();
    this.error = '';

    const email = this.email.trim();
    const password = this.password.trim();

    if (!email || !password) {
      this.error = 'Please fill in both fields.';
      return;
    }

    this.isLoading = true;

    try {
      const resp = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!resp.ok) {
        this.error = 'Invalid credentials';
        return;
      }

      const data = await resp.json();

      this.dispatchEvent(
        new CustomEvent('login-success', {
          detail: { email: data.email },
          bubbles: true,
          composed: true,
        })
      );
    } catch {
      this.error = 'Cannot connect to server. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  override render() {
    return html`
      <div class="login-card">
        <div class="login-header">
          <div class="login-title">Log in to app</div>
          <div class="login-subtitle">
            Use your STU faculty test account to continue.
          </div>
        </div>

        <form @submit=${this.onSubmit}>
          <div class="field">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="xfaculty@stuba.sk"
              .value=${this.email}
              @input=${(e: Event) =>
                (this.email = (e.target as HTMLInputElement).value)}
              autocomplete="email"
              ?disabled=${this.isLoading}
            />
          </div>

          <div class="field" style="margin-top: 14px;">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              .value=${this.password}
              @input=${(e: Event) =>
                (this.password = (e.target as HTMLInputElement).value)}
              autocomplete="current-password"
              ?disabled=${this.isLoading}
            />
          </div>

          ${this.error
            ? html`<div class="error" style="margin-top: 14px;">
                ${this.error}
              </div>`
            : null}

          <button
            class="primary"
            type="submit"
            ?disabled=${this.isLoading}
            style="margin-top: 22px;"
          >
            ${this.isLoading ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ad-login-view': AdLoginView;
  }
}