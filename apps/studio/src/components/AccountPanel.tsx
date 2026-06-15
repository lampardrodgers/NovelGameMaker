import { useState } from "react";
import type {
  ProductionMfaTotpSetup,
  ProductionUserAccountRecord,
  ProductionUserSessionRecord
} from "../studio/productionApi";

interface AccountPanelProps {
  apiEnabled: boolean;
  user?: ProductionUserAccountRecord;
  sessionToken?: string;
  sessions: ProductionUserSessionRecord[];
  mfaTotpSetup?: ProductionMfaTotpSetup;
  mfaRecoveryCodes: string[];
  mfaDeviceToken?: string;
  oauthAuthorizationUrl?: string;
  oauthState?: string;
  isLoading: boolean;
  isLoadingSessions: boolean;
  onRegister(input: { email: string; password: string; name?: string }): void;
  onLogin(input: { email: string; password: string; mfaCode?: string; rememberMfaDevice?: boolean }): void;
  onStartOAuth(input: { returnUrl?: string }): void;
  onCompleteOAuth(input: { state: string; code: string }): void;
  onRefresh(): void;
  onRefreshSessions(): void;
  onRevokeSession(sessionId: string): void;
  onLogout(): void;
  onRequestVerification(): void;
  onVerifyEmail(verificationToken: string): void;
  onRequestPasswordReset(email: string): void;
  onConfirmPasswordReset(input: { resetToken: string; password: string }): void;
  onStartMfaTotpSetup(): void;
  onConfirmMfaTotpSetup(code: string): void;
  onDisableMfaTotp(input: { password: string; code?: string }): void;
  onRegenerateMfaRecoveryCodes(input: { password: string; code?: string }): void;
  onRevokeMfaTrustedDevices(input: { password: string; code?: string }): void;
}

export function AccountPanel({
  apiEnabled,
  user,
  sessionToken,
  sessions,
  mfaTotpSetup,
  mfaRecoveryCodes,
  mfaDeviceToken,
  oauthAuthorizationUrl,
  oauthState,
  isLoading,
  isLoadingSessions,
  onRegister,
  onLogin,
  onStartOAuth,
  onCompleteOAuth,
  onRefresh,
  onRefreshSessions,
  onRevokeSession,
  onLogout,
  onRequestVerification,
  onVerifyEmail,
  onRequestPasswordReset,
  onConfirmPasswordReset,
  onStartMfaTotpSetup,
  onConfirmMfaTotpSetup,
  onDisableMfaTotp,
  onRegenerateMfaRecoveryCodes,
  onRevokeMfaTrustedDevices
}: AccountPanelProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSetupCode, setMfaSetupCode] = useState("");
  const [mfaDisablePassword, setMfaDisablePassword] = useState("");
  const [mfaDisableCode, setMfaDisableCode] = useState("");
  const [mfaRecoveryPassword, setMfaRecoveryPassword] = useState("");
  const [mfaRecoveryCode, setMfaRecoveryCode] = useState("");
  const [rememberMfaDevice, setRememberMfaDevice] = useState(false);
  const [mfaDevicePassword, setMfaDevicePassword] = useState("");
  const [mfaDeviceCode, setMfaDeviceCode] = useState("");
  const [oauthReturnUrl, setOauthReturnUrl] = useState("/studio");
  const [oauthManualState, setOauthManualState] = useState("");
  const [oauthCode, setOauthCode] = useState("");
  const disabled = !apiEnabled || isLoading;
  const sessionDisabled = disabled || isLoadingSessions;
  const activeEmail = user?.email ?? email;
  const mfaEnabled = Boolean(user?.mfaTotpEnabledAt);
  const activeSessionCount = sessions.filter((session) => !session.revokedAt).length;

  return (
    <section className="account-panel" aria-label="Account">
      <div className="account-header">
        <div>
          <div className="panel-title">Account</div>
          <div className="account-readout">
            {apiEnabled
              ? user
	                ? `${user.email}${user.emailVerifiedAt ? " / verified" : " / unverified"}${mfaEnabled ? " / MFA on" : " / MFA off"}${mfaDeviceToken ? " / device remembered" : ""}`
                : sessionToken
                  ? "Session saved locally"
                  : "No account session"
              : "Production API is offline"}
          </div>
        </div>
        <div className="account-actions">
          <button type="button" onClick={onRefresh} disabled={disabled || !sessionToken}>
            Refresh Account
          </button>
          <button type="button" onClick={onLogout} disabled={disabled || !sessionToken}>
            Logout
          </button>
        </div>
      </div>

      <div className="account-grid">
        <label>
          <span>Email</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="editor@example.com"
            autoComplete="email"
          />
        </label>
        <label>
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Editor"
            autoComplete="name"
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="at least 8 characters"
            autoComplete="current-password"
          />
        </label>
        <label>
          <span>MFA Code</span>
          <input
            value={mfaCode}
            onChange={(event) => setMfaCode(event.target.value)}
            placeholder="000000 or recovery code"
            autoComplete="one-time-code"
            aria-label="MFA login code"
          />
        </label>
	        <div className="account-form-actions">
	          <button
	            type="button"
	            onClick={() => onLogin({
	              email,
	              password,
	              mfaCode: mfaCode.trim() || undefined,
	              rememberMfaDevice
	            })}
	            disabled={disabled || !email.trim() || !password}
	          >
	            Login
	          </button>
          <button
            type="button"
            onClick={() => onRegister({ email, password, name: name.trim() || undefined })}
            disabled={disabled || !email.trim() || !password}
          >
	            Register
	          </button>
	        </div>
	        <label className="account-checkbox">
	          <input
	            type="checkbox"
	            checked={rememberMfaDevice}
	            onChange={(event) => setRememberMfaDevice(event.target.checked)}
	          />
	          <span>Remember MFA device</span>
	        </label>
      </div>

      <div className="account-token-row">
        <input
          value={oauthReturnUrl}
          onChange={(event) => setOauthReturnUrl(event.target.value)}
          placeholder="/studio"
          aria-label="SSO return URL"
        />
        <button
          type="button"
          onClick={() => onStartOAuth({ returnUrl: oauthReturnUrl.trim() || undefined })}
          disabled={disabled}
        >
          Start SSO
        </button>
      </div>

      {oauthAuthorizationUrl ? (
        <div className="account-mfa-secret">
          <input readOnly value={oauthAuthorizationUrl} aria-label="SSO authorization URL" />
          <input readOnly value={oauthState ?? ""} aria-label="SSO state" />
        </div>
      ) : null}

      <div className="account-token-row">
        <input
          value={oauthManualState || oauthState || ""}
          onChange={(event) => setOauthManualState(event.target.value)}
          placeholder="vno_ state"
          aria-label="SSO state input"
        />
        <input
          value={oauthCode}
          onChange={(event) => setOauthCode(event.target.value)}
          placeholder="mock code or IdP code"
          aria-label="SSO authorization code"
        />
        <button
          type="button"
          onClick={() => onCompleteOAuth({
            state: (oauthManualState || oauthState || "").trim(),
            code: oauthCode
          })}
          disabled={disabled || !(oauthManualState || oauthState || "").trim() || !oauthCode.trim()}
        >
          Complete SSO
        </button>
      </div>

      <div className="account-token-row">
        <button type="button" onClick={onRefreshSessions} disabled={sessionDisabled || !sessionToken}>
          {isLoadingSessions ? "Loading Sessions" : "Refresh Sessions"}
        </button>
        <span className="account-session-readout">
          {sessions.length > 0 ? `${activeSessionCount} active / ${sessions.length} total` : "No sessions loaded"}
        </span>
      </div>

      {sessions.length > 0 ? (
        <ul className="account-session-list">
          {sessions.slice(0, 5).map((session) => (
            <li key={session.id} className={session.revokedAt ? "is-revoked" : undefined}>
              <div className="account-session-main">
                <strong>{session.tokenPrefix}</strong>
                <span>{session.revokedAt ? "revoked" : "active"}</span>
              </div>
              <div className="account-session-meta">
                <span>created {formatSessionTime(session.createdAt)}</span>
                {session.lastUsedAt ? <span>used {formatSessionTime(session.lastUsedAt)}</span> : null}
                {session.expiresAt ? <span>expires {formatSessionTime(session.expiresAt)}</span> : null}
              </div>
              <button
                type="button"
                onClick={() => onRevokeSession(session.id)}
                disabled={sessionDisabled || Boolean(session.revokedAt)}
              >
                Revoke Session
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="account-token-row">
        <button type="button" onClick={onRequestVerification} disabled={disabled || !sessionToken}>
          Send Verification
        </button>
        <input
          value={verificationToken}
          onChange={(event) => setVerificationToken(event.target.value)}
          placeholder="vne_ verification token"
          aria-label="Verification token"
        />
        <button
          type="button"
          onClick={() => onVerifyEmail(verificationToken)}
          disabled={!apiEnabled || isLoading || !verificationToken.trim()}
        >
          Verify Email
        </button>
      </div>

      <div className="account-token-row">
        <button
          type="button"
          onClick={() => onRequestPasswordReset(resetEmail.trim() || activeEmail)}
          disabled={disabled || !(resetEmail.trim() || activeEmail)}
        >
          Request Reset
        </button>
        <input
          value={resetEmail}
          onChange={(event) => setResetEmail(event.target.value)}
          placeholder="reset email"
          aria-label="Password reset email"
          autoComplete="email"
        />
      </div>

      <div className="account-token-row">
        <input
          value={resetToken}
          onChange={(event) => setResetToken(event.target.value)}
          placeholder="vnr_ reset token"
          aria-label="Password reset token"
        />
        <input
          type="password"
          value={resetPassword}
          onChange={(event) => setResetPassword(event.target.value)}
          placeholder="new password"
          aria-label="New password"
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => onConfirmPasswordReset({ resetToken, password: resetPassword })}
          disabled={!apiEnabled || isLoading || !resetToken.trim() || !resetPassword}
        >
          Confirm Reset
        </button>
      </div>

      <div className="account-token-row">
        <button type="button" onClick={onStartMfaTotpSetup} disabled={disabled || !sessionToken}>
          Setup MFA
        </button>
        <input
          value={mfaSetupCode}
          onChange={(event) => setMfaSetupCode(event.target.value)}
          placeholder="setup code"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="MFA setup code"
        />
        <button
          type="button"
          onClick={() => onConfirmMfaTotpSetup(mfaSetupCode)}
          disabled={disabled || !mfaSetupCode.trim()}
        >
          Confirm MFA
        </button>
      </div>

      {mfaTotpSetup ? (
        <div className="account-mfa-secret">
          <input readOnly value={mfaTotpSetup.secret} aria-label="MFA setup secret" />
          <input readOnly value={mfaTotpSetup.otpauthUrl} aria-label="MFA otpauth URL" />
        </div>
      ) : null}

      {mfaRecoveryCodes.length > 0 ? (
        <div className="account-mfa-recovery-codes">
          <textarea
            readOnly
            value={mfaRecoveryCodes.join("\n")}
            aria-label="MFA recovery codes"
          />
        </div>
      ) : null}

      <div className="account-token-row">
        <input
          type="password"
          value={mfaRecoveryPassword}
          onChange={(event) => setMfaRecoveryPassword(event.target.value)}
          placeholder="password"
          autoComplete="current-password"
          aria-label="MFA recovery code password"
        />
        <input
          value={mfaRecoveryCode}
          onChange={(event) => setMfaRecoveryCode(event.target.value)}
          placeholder="TOTP or recovery code"
          autoComplete="one-time-code"
          aria-label="MFA recovery code regeneration code"
        />
        <button
          type="button"
          onClick={() => onRegenerateMfaRecoveryCodes({
            password: mfaRecoveryPassword,
            code: mfaRecoveryCode.trim() || undefined
          })}
          disabled={disabled || !mfaEnabled || !mfaRecoveryPassword || !mfaRecoveryCode.trim()}
        >
          Regenerate Codes
        </button>
      </div>

      <div className="account-token-row">
        <input
          type="password"
          value={mfaDevicePassword}
          onChange={(event) => setMfaDevicePassword(event.target.value)}
          placeholder="password"
          autoComplete="current-password"
          aria-label="MFA trusted devices password"
        />
        <input
          value={mfaDeviceCode}
          onChange={(event) => setMfaDeviceCode(event.target.value)}
          placeholder="TOTP or recovery code"
          autoComplete="one-time-code"
          aria-label="MFA trusted devices code"
        />
        <button
          type="button"
          onClick={() => onRevokeMfaTrustedDevices({
            password: mfaDevicePassword,
            code: mfaDeviceCode.trim() || undefined
          })}
          disabled={disabled || !mfaEnabled || !mfaDevicePassword || !mfaDeviceCode.trim()}
        >
          Forget Devices
        </button>
      </div>

      <div className="account-token-row">
        <input
          type="password"
          value={mfaDisablePassword}
          onChange={(event) => setMfaDisablePassword(event.target.value)}
          placeholder="password"
          autoComplete="current-password"
          aria-label="MFA disable password"
        />
        <input
          value={mfaDisableCode}
          onChange={(event) => setMfaDisableCode(event.target.value)}
          placeholder="TOTP or recovery code"
          autoComplete="one-time-code"
          aria-label="MFA disable code"
        />
        <button
          type="button"
          onClick={() => onDisableMfaTotp({ password: mfaDisablePassword, code: mfaDisableCode.trim() || undefined })}
          disabled={disabled || !mfaDisablePassword || (mfaEnabled && !mfaDisableCode.trim())}
        >
          Disable MFA
        </button>
      </div>
    </section>
  );
}

function formatSessionTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toISOString().replace(".000Z", "Z");
}
