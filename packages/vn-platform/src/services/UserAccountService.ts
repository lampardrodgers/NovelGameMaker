import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from "node:crypto";
import type {
  CreatedUserAccountActionToken,
  CreatedUserSession,
  UserAccountMfaPolicy,
  UserAccountMfaRecoveryCodes,
  UserAccountMfaTotpSetup,
  UserAccountActionTokenPurpose,
  UserAccountActionTokenRecord,
  UserAccountActionTokenRepository,
  UserAccountAccessPolicy,
  UserAccountNotifier,
  UserAccountRecord,
  UserAccountRepository,
  UserAccountSecurityPolicy,
  UserSessionRecord,
  UserSessionRepository
} from "../types.js";
import { AuditService } from "./AuditService.js";

const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const DEFAULT_SECURITY_POLICY: UserAccountSecurityPolicy = {
  passwordMinLength: 8,
  passwordRequireLetter: true,
  passwordRequireNumber: false,
  passwordRequireSymbol: false,
  blockedPasswordTerms: [],
  maxFailedLoginAttempts: 5,
  failedLoginLockoutMs: 15 * 60 * 1000
};
const DEFAULT_ACCESS_POLICY: UserAccountAccessPolicy = {
  ssoRequiredEmailDomains: []
};
const DEFAULT_MFA_POLICY: UserAccountMfaPolicy = {
  enabled: false,
  issuer: "NovelGameMaker",
  totpStepSeconds: 30,
  totpWindowSteps: 1,
  trustedDeviceTtlMs: 30 * 24 * 60 * 60 * 1000,
  maxTrustedDevices: 10
};
const TOTP_DIGITS = 6;
const MFA_RECOVERY_CODE_COUNT = 10;
const MFA_RECOVERY_CODE_CHARS = 15;

type UserMfaVerificationResult =
  | { kind: "totp"; counter: number }
  | { kind: "recovery"; recoveryCodeHashes: string[] };

export class UserAccountValidationError extends Error {}

export class UserAuthenticationError extends Error {
  constructor() {
    super("Invalid email or password.");
  }
}

export class UserAccountLockedError extends Error {
  constructor(readonly lockedUntil?: string) {
    super("Account is temporarily locked. Try again later.");
  }
}

export class UserAccountSsoRequiredError extends Error {
  constructor(readonly domain: string) {
    super("SSO is required for this email domain.");
  }
}

export class UserMfaRequiredError extends Error {
  constructor() {
    super("MFA code is required.");
  }
}

export class UserAccountService {
  private readonly securityPolicy: UserAccountSecurityPolicy;
  private readonly mfaPolicy: UserAccountMfaPolicy;
  private readonly accessPolicy: UserAccountAccessPolicy;

  constructor(
    private readonly users: UserAccountRepository,
    private readonly sessions: UserSessionRepository,
    private readonly actionTokens: UserAccountActionTokenRepository,
    private readonly auditService?: AuditService,
    private readonly notifier?: UserAccountNotifier,
    securityPolicy: Partial<UserAccountSecurityPolicy> = {},
    mfaPolicy: Partial<UserAccountMfaPolicy> = {},
    accessPolicy: Partial<UserAccountAccessPolicy> = {}
  ) {
    this.securityPolicy = normalizeSecurityPolicy(securityPolicy);
    this.mfaPolicy = normalizeMfaPolicy(mfaPolicy);
    this.accessPolicy = normalizeAccessPolicy(accessPolicy);
  }

  async register(input: {
    email: string;
    password: string;
    name?: string;
    sessionExpiresAt?: string;
  }): Promise<CreatedUserSession> {
    const email = normalizeEmail(input.email);
    this.assertPasswordAuthAllowed(email);
    assertPassword(input.password, this.securityPolicy);
    const existing = await this.users.getByEmail(email);
    if (existing) {
      throw new UserAccountValidationError("Email is already registered.");
    }
    const now = new Date();
    const nowIso = now.toISOString();
    const user = await this.users.create({
      id: createRecordId("user"),
      email,
      passwordHash: hashPassword(input.password),
      name: input.name?.trim() || undefined,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    await this.auditService?.record({
      action: "user_registered",
      targetType: "user_account",
      targetId: user.id,
      details: {
        email: user.email,
        name: user.name
      },
      createdAt: nowIso
    });
    const session = await this.createSessionForUser(user, now, input.sessionExpiresAt);
    await this.requestEmailVerification(user.id, now);
    return session;
  }

  async login(input: {
    email: string;
    password: string;
    mfaCode?: string;
    mfaDeviceToken?: string;
    rememberMfaDevice?: boolean;
    sessionExpiresAt?: string;
  }): Promise<CreatedUserSession> {
    const email = normalizeEmail(input.email);
    this.assertPasswordAuthAllowed(email);
    const user = await this.users.getByEmail(email);
    if (!user || user.disabledAt) {
      throw new UserAuthenticationError();
    }
    const now = new Date();
    if (isLoginLocked(user, now)) {
      throw new UserAccountLockedError(user.lockedUntil);
    }
    if (!verifyPassword(input.password, user.passwordHash)) {
      await this.recordFailedLogin(user, now);
      throw new UserAuthenticationError();
    }

    let nextMfaTotpLastUsedCounter = user.mfaTotpLastUsedCounter;
    let nextMfaRecoveryCodeHashes = user.mfaRecoveryCodeHashes;
    let nextMfaTrustedDevices = pruneMfaTrustedDevices(user.mfaTrustedDevices ?? [], now);
    let mfaDeviceToken: string | undefined;
    if (isMfaTotpEnabled(user)) {
      const trustedDevices = input.mfaDeviceToken
        ? this.verifyMfaTrustedDevice(user, input.mfaDeviceToken, now)
        : undefined;
      if (trustedDevices) {
        nextMfaTrustedDevices = trustedDevices;
        await this.recordMfaTrustedDeviceUsed(user, now);
      } else {
        if (!input.mfaCode?.trim()) {
          throw new UserMfaRequiredError();
        }
        const mfaVerification = this.verifyUserMfaCode(user, input.mfaCode, now);
        if (!mfaVerification) {
          await this.auditService?.record({
            action: "user_mfa_totp_failed",
            targetType: "user_account",
            targetId: user.id,
            outcome: "failed",
            details: {
              email: user.email
            },
            createdAt: now.toISOString()
          });
          throw new UserAuthenticationError();
        }
        if (mfaVerification.kind === "totp") {
          nextMfaTotpLastUsedCounter = mfaVerification.counter;
        } else {
          nextMfaRecoveryCodeHashes = mfaVerification.recoveryCodeHashes;
          await this.recordMfaRecoveryCodeUsed(user, now);
        }
        if (input.rememberMfaDevice) {
          const trustedDevice = this.createMfaTrustedDevice(nextMfaTrustedDevices, now);
          nextMfaTrustedDevices = trustedDevice.devices;
          mfaDeviceToken = trustedDevice.token;
          await this.recordMfaTrustedDeviceCreated(user, now);
        }
      }
    }

    const nowIso = now.toISOString();
    const updatedUser = await this.users.update({
      ...user,
      failedLoginCount: 0,
      lastFailedLoginAt: undefined,
      lockedUntil: undefined,
      lastLoginAt: nowIso,
      mfaTotpLastUsedCounter: nextMfaTotpLastUsedCounter,
      mfaRecoveryCodeHashes: nextMfaRecoveryCodeHashes,
      mfaTrustedDevices: nextMfaTrustedDevices.length > 0 ? nextMfaTrustedDevices : undefined,
      updatedAt: nowIso
    });
    await this.auditService?.record({
      action: "user_logged_in",
      targetType: "user_account",
      targetId: updatedUser.id,
      details: {
        email: updatedUser.email
      },
      createdAt: nowIso
    });
    const created = await this.createSessionForUser(updatedUser, now, input.sessionExpiresAt);
    return mfaDeviceToken ? { ...created, mfaDeviceToken } : created;
  }

  async startMfaTotpSetup(userId: string): Promise<UserAccountMfaTotpSetup> {
    this.assertMfaEnabled();
    const user = await this.requireActiveUser(userId);
    const nowIso = new Date().toISOString();
    const secret = base32Encode(randomBytes(20));
    const updated = await this.users.update({
      ...user,
      mfaTotpSecretEncrypted: this.encryptMfaSecret(secret),
      mfaTotpEnabledAt: undefined,
      mfaTotpLastUsedCounter: undefined,
      mfaRecoveryCodeHashes: undefined,
      mfaRecoveryCodesUpdatedAt: undefined,
      mfaTrustedDevices: undefined,
      updatedAt: nowIso
    });
    await this.auditService?.record({
      action: "user_mfa_totp_setup_started",
      targetType: "user_account",
      targetId: user.id,
      details: {
        email: user.email
      },
      createdAt: nowIso
    });
    return {
      secret,
      otpauthUrl: createTotpUrl({
        issuer: this.mfaPolicy.issuer,
        email: user.email,
        secret,
        periodSeconds: this.mfaPolicy.totpStepSeconds
      }),
      user: updated
    };
  }

  async confirmMfaTotpSetup(input: {
    userId: string;
    code: string;
  }): Promise<UserAccountMfaRecoveryCodes> {
    this.assertMfaEnabled();
    const user = await this.requireActiveUser(input.userId);
    const now = new Date();
    const counter = this.verifyUserTotp(user, input.code, now);
    if (counter === undefined) {
      await this.auditService?.record({
        action: "user_mfa_totp_setup_failed",
        targetType: "user_account",
        targetId: user.id,
        outcome: "failed",
        details: {
          email: user.email
        },
        createdAt: now.toISOString()
      });
      throw new UserAuthenticationError();
    }

    const nowIso = now.toISOString();
    const recoveryCodes = createRecoveryCodes();
    const updated = await this.users.update({
      ...user,
      mfaTotpEnabledAt: nowIso,
      mfaTotpLastUsedCounter: undefined,
      mfaRecoveryCodeHashes: recoveryCodes.map(hashRecoveryCode),
      mfaRecoveryCodesUpdatedAt: nowIso,
      mfaTrustedDevices: undefined,
      updatedAt: nowIso
    });
    await this.auditService?.record({
      action: "user_mfa_totp_enabled",
      targetType: "user_account",
      targetId: user.id,
      details: {
        email: user.email
      },
      createdAt: nowIso
    });
    return {
      recoveryCodes,
      user: updated
    };
  }

  async disableMfaTotp(input: {
    userId: string;
    password: string;
    code?: string;
  }): Promise<UserAccountRecord> {
    this.assertMfaEnabled();
    const user = await this.requireActiveUser(input.userId);
    if (!verifyPassword(input.password, user.passwordHash)) {
      throw new UserAuthenticationError();
    }
    const now = new Date();
    if (isMfaTotpEnabled(user)) {
      const mfaVerification = this.verifyUserMfaCode(user, input.code ?? "", now);
      if (!mfaVerification) {
        throw new UserAuthenticationError();
      }
      if (mfaVerification.kind === "recovery") {
        await this.recordMfaRecoveryCodeUsed(user, now);
      }
    }
    const nowIso = now.toISOString();
    const updated = await this.users.update({
      ...user,
      mfaTotpSecretEncrypted: undefined,
      mfaTotpEnabledAt: undefined,
      mfaTotpLastUsedCounter: undefined,
      mfaRecoveryCodeHashes: undefined,
      mfaRecoveryCodesUpdatedAt: undefined,
      mfaTrustedDevices: undefined,
      updatedAt: nowIso
    });
    await this.auditService?.record({
      action: "user_mfa_totp_disabled",
      targetType: "user_account",
      targetId: user.id,
      details: {
        email: user.email
      },
      createdAt: nowIso
    });
    return updated;
  }

  async revokeMfaTrustedDevices(input: {
    userId: string;
    password: string;
    code?: string;
  }): Promise<UserAccountRecord> {
    this.assertMfaEnabled();
    const user = await this.requireActiveUser(input.userId);
    if (!isMfaTotpEnabled(user)) {
      throw new UserAccountValidationError("MFA is not enabled for this user.");
    }
    if (!verifyPassword(input.password, user.passwordHash)) {
      throw new UserAuthenticationError();
    }
    const now = new Date();
    const mfaVerification = this.verifyUserMfaCode(user, input.code ?? "", now);
    if (!mfaVerification) {
      throw new UserAuthenticationError();
    }
    if (mfaVerification.kind === "recovery") {
      await this.recordMfaRecoveryCodeUsed(user, now);
    }
    const nowIso = now.toISOString();
    const updated = await this.users.update({
      ...user,
      mfaTotpLastUsedCounter: mfaVerification.kind === "totp"
        ? mfaVerification.counter
        : user.mfaTotpLastUsedCounter,
      mfaRecoveryCodeHashes: mfaVerification.kind === "recovery"
        ? mfaVerification.recoveryCodeHashes
        : user.mfaRecoveryCodeHashes,
      mfaTrustedDevices: undefined,
      updatedAt: nowIso
    });
    await this.auditService?.record({
      action: "user_mfa_trusted_devices_revoked",
      targetType: "user_account",
      targetId: user.id,
      details: {
        email: user.email
      },
      createdAt: nowIso
    });
    return updated;
  }

  async regenerateMfaRecoveryCodes(input: {
    userId: string;
    password: string;
    code?: string;
  }): Promise<UserAccountMfaRecoveryCodes> {
    this.assertMfaEnabled();
    const user = await this.requireActiveUser(input.userId);
    if (!isMfaTotpEnabled(user)) {
      throw new UserAccountValidationError("MFA is not enabled for this user.");
    }
    if (!verifyPassword(input.password, user.passwordHash)) {
      throw new UserAuthenticationError();
    }
    const now = new Date();
    const mfaVerification = this.verifyUserMfaCode(user, input.code ?? "", now);
    if (!mfaVerification) {
      throw new UserAuthenticationError();
    }
    if (mfaVerification.kind === "recovery") {
      await this.recordMfaRecoveryCodeUsed(user, now);
    }

    const nowIso = now.toISOString();
    const recoveryCodes = createRecoveryCodes();
    const updated = await this.users.update({
      ...user,
      mfaTotpLastUsedCounter: mfaVerification.kind === "totp"
        ? mfaVerification.counter
        : user.mfaTotpLastUsedCounter,
      mfaRecoveryCodeHashes: recoveryCodes.map(hashRecoveryCode),
      mfaRecoveryCodesUpdatedAt: nowIso,
      updatedAt: nowIso
    });
    await this.auditService?.record({
      action: "user_mfa_recovery_codes_regenerated",
      targetType: "user_account",
      targetId: user.id,
      details: {
        email: user.email,
        recoveryCodeCount: recoveryCodes.length
      },
      createdAt: nowIso
    });
    return {
      recoveryCodes,
      user: updated
    };
  }

  async authenticate(sessionToken: string): Promise<{ user: UserAccountRecord; session: UserSessionRecord } | undefined> {
    const session = await this.sessions.getByHash(hashToken(sessionToken));
    if (!session || session.revokedAt || isExpired(session)) {
      return undefined;
    }
    const user = await this.users.getById(session.userId);
    if (!user || user.disabledAt) {
      return undefined;
    }
    const nowIso = new Date().toISOString();
    const updated = await this.sessions.update({
      ...session,
      lastUsedAt: nowIso,
      updatedAt: nowIso
    });
    return { user, session: updated };
  }

  async getUser(id: string): Promise<UserAccountRecord | undefined> {
    return this.users.getById(id);
  }

  async getUserByEmail(email: string): Promise<UserAccountRecord | undefined> {
    return this.users.getByEmail(normalizeEmail(email));
  }

  async provisionScimUser(input: {
    email: string;
    name?: string;
    active?: boolean;
    emailVerified?: boolean;
    now?: Date;
  }): Promise<UserAccountRecord> {
    const email = normalizeEmail(input.email);
    const name = input.name?.trim() || undefined;
    const active = input.active !== false;
    const now = input.now ?? new Date();
    const nowIso = now.toISOString();
    const existing = await this.users.getByEmail(email);
    const disabledAt = active ? undefined : existing?.disabledAt ?? nowIso;

    const user = existing
      ? await this.users.update({
          ...existing,
          name: name ?? existing.name,
          emailVerifiedAt: existing.emailVerifiedAt ?? (input.emailVerified === false ? undefined : nowIso),
          disabledAt,
          updatedAt: nowIso
        })
      : await this.users.create({
          id: createRecordId("user"),
          email,
          passwordHash: hashPassword(randomBytes(32).toString("base64url")),
          name,
          emailVerifiedAt: input.emailVerified === false ? undefined : nowIso,
          disabledAt,
          createdAt: nowIso,
          updatedAt: nowIso
        });

    if (!active) {
      await this.revokeUserSessions(user.id, nowIso);
    }

    await this.auditService?.record({
      action: existing ? "user_scim_updated" : "user_scim_provisioned",
      targetType: "user_account",
      targetId: user.id,
      details: {
        email: user.email,
        active
      },
      createdAt: nowIso
    });
    return user;
  }

  async disableScimUser(input: {
    userId?: string;
    email?: string;
    now?: Date;
  }): Promise<UserAccountRecord | undefined> {
    const user = input.userId
      ? await this.users.getById(input.userId)
      : input.email
        ? await this.users.getByEmail(normalizeEmail(input.email))
        : undefined;
    if (!user) {
      return undefined;
    }
    const now = input.now ?? new Date();
    const nowIso = now.toISOString();
    const updated = await this.users.update({
      ...user,
      disabledAt: user.disabledAt ?? nowIso,
      updatedAt: nowIso
    });
    await this.revokeUserSessions(user.id, nowIso);
    await this.auditService?.record({
      action: "user_scim_disabled",
      targetType: "user_account",
      targetId: updated.id,
      details: {
        email: updated.email
      },
      createdAt: nowIso
    });
    return updated;
  }

  async loginWithExternalIdentity(input: {
    provider: string;
    subject: string;
    email: string;
    emailVerified?: boolean;
    name?: string;
    linkedUserId?: string;
    sessionExpiresAt?: string;
  }): Promise<CreatedUserSession> {
    const email = normalizeEmail(input.email);
    const now = new Date();
    const nowIso = now.toISOString();
    const existing = input.linkedUserId
      ? await this.users.getById(input.linkedUserId)
      : await this.users.getByEmail(email);
    if (input.linkedUserId && !existing) {
      throw new UserAccountValidationError("Linked SSO user account is not available.");
    }
    if (existing?.disabledAt) {
      throw new UserAccountValidationError("User account is not available.");
    }

    const user = existing
      ? await this.users.update({
          ...existing,
          name: existing.name || input.name?.trim() || undefined,
          emailVerifiedAt: existing.emailVerifiedAt ?? (input.emailVerified === false ? undefined : nowIso),
          failedLoginCount: 0,
          lastFailedLoginAt: undefined,
          lockedUntil: undefined,
          lastLoginAt: nowIso,
          updatedAt: nowIso
        })
      : await this.users.create({
          id: createRecordId("user"),
          email,
          passwordHash: hashPassword(randomBytes(32).toString("base64url")),
          name: input.name?.trim() || undefined,
          emailVerifiedAt: input.emailVerified === false ? undefined : nowIso,
          lastLoginAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso
        });

    await this.auditService?.record({
      action: existing ? "user_sso_logged_in" : "user_sso_registered",
      targetType: "user_account",
      targetId: user.id,
      details: {
        email: user.email,
        provider: input.provider,
        subjectHash: hashToken(input.subject),
        linkedUserId: input.linkedUserId
      },
      createdAt: nowIso
    });
    return this.createSessionForUser(user, now, input.sessionExpiresAt);
  }

  async requestEmailVerification(userId: string, now = new Date()): Promise<CreatedUserAccountActionToken | undefined> {
    const user = await this.users.getById(userId);
    if (!user || user.disabledAt || user.emailVerifiedAt) {
      return undefined;
    }
    const token = await this.createActionToken({
      user,
      purpose: "email_verification",
      now,
      expiresAt: new Date(now.getTime() + DEFAULT_EMAIL_VERIFICATION_TTL_MS).toISOString()
    });
    await this.auditService?.record({
      action: "user_email_verification_requested",
      targetType: "user_account",
      targetId: user.id,
      details: {
        email: user.email,
        actionTokenId: token.record.id,
        expiresAt: token.record.expiresAt
      },
      createdAt: now.toISOString()
    });
    await this.notifyUserAccount("user_email_verification_requested", user, token.record, now.toISOString(), token.actionToken);
    return token;
  }

  async verifyEmail(verificationToken: string): Promise<UserAccountRecord> {
    const actionToken = await this.readUsableActionToken(verificationToken, "email_verification");
    const user = await this.users.getById(actionToken.userId);
    if (!user || user.disabledAt || user.email !== actionToken.email) {
      throw new UserAccountValidationError("Email verification token is not valid.");
    }
    const nowIso = new Date().toISOString();
    const verified = await this.users.update({
      ...user,
      emailVerifiedAt: user.emailVerifiedAt ?? nowIso,
      updatedAt: nowIso
    });
    await this.markActionTokenUsed(actionToken, nowIso);
    await this.auditService?.record({
      action: "user_email_verified",
      targetType: "user_account",
      targetId: verified.id,
      details: {
        email: verified.email,
        actionTokenId: actionToken.id
      },
      createdAt: nowIso
    });
    await this.notifyUserAccount("user_email_verified", verified, actionToken, nowIso);
    return verified;
  }

  async requestPasswordReset(email: string, now = new Date()): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    this.assertPasswordAuthAllowed(normalizedEmail);
    const user = await this.users.getByEmail(normalizedEmail);
    if (!user || user.disabledAt) {
      return;
    }
    const token = await this.createActionToken({
      user,
      purpose: "password_reset",
      now,
      expiresAt: new Date(now.getTime() + DEFAULT_PASSWORD_RESET_TTL_MS).toISOString()
    });
    await this.auditService?.record({
      action: "user_password_reset_requested",
      targetType: "user_account",
      targetId: user.id,
      details: {
        email: user.email,
        actionTokenId: token.record.id,
        expiresAt: token.record.expiresAt
      },
      createdAt: now.toISOString()
    });
    await this.notifyUserAccount("user_password_reset_requested", user, token.record, now.toISOString(), token.actionToken);
  }

  async resetPassword(input: {
    resetToken: string;
    password: string;
  }): Promise<UserAccountRecord> {
    const actionToken = await this.readUsableActionToken(input.resetToken, "password_reset");
    const user = await this.users.getById(actionToken.userId);
    if (!user || user.disabledAt || user.email !== actionToken.email) {
      throw new UserAccountValidationError("Password reset token is not valid.");
    }
    this.assertPasswordAuthAllowed(user.email);
    assertPassword(input.password, this.securityPolicy);
    const nowIso = new Date().toISOString();
    const updated = await this.users.update({
      ...user,
      passwordHash: hashPassword(input.password),
      failedLoginCount: 0,
      lastFailedLoginAt: undefined,
      lockedUntil: undefined,
      passwordUpdatedAt: nowIso,
      updatedAt: nowIso
    });
    await this.markActionTokenUsed(actionToken, nowIso);
    await this.revokeUserSessions(user.id, nowIso);
    await this.auditService?.record({
      action: "user_password_reset_completed",
      targetType: "user_account",
      targetId: updated.id,
      details: {
        email: updated.email,
        actionTokenId: actionToken.id
      },
      createdAt: nowIso
    });
    await this.notifyUserAccount("user_password_reset_completed", updated, actionToken, nowIso);
    return updated;
  }

  async listSessions(userId: string, limit = 50): Promise<UserSessionRecord[]> {
    return this.sessions.listByUser(userId, limit);
  }

  async revokeUserSession(userId: string, sessionId: string): Promise<UserSessionRecord | undefined> {
    const existing = await this.sessions.getById(sessionId);
    if (!existing || existing.userId !== userId) {
      return undefined;
    }
    return this.revokeSession(sessionId);
  }

  async revokeSession(id: string): Promise<UserSessionRecord | undefined> {
    const existing = await this.sessions.getById(id);
    if (!existing) {
      return undefined;
    }
    const revoked = await this.sessions.update({
      ...existing,
      revokedAt: existing.revokedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await this.auditService?.record({
      action: "user_session_revoked",
      targetType: "user_session",
      targetId: revoked.id,
      details: {
        userId: revoked.userId
      }
    });
    return revoked;
  }

  async logout(sessionToken: string): Promise<UserSessionRecord | undefined> {
    const existing = await this.sessions.getByHash(hashToken(sessionToken));
    if (!existing) {
      return undefined;
    }
    return this.revokeSession(existing.id);
  }

  private async recordFailedLogin(user: UserAccountRecord, now: Date): Promise<UserAccountRecord> {
    const nowIso = now.toISOString();
    const nextFailedLoginCount = (user.failedLoginCount ?? 0) + 1;
    const lockedUntil = this.securityPolicy.maxFailedLoginAttempts > 0 &&
      nextFailedLoginCount >= this.securityPolicy.maxFailedLoginAttempts
      ? new Date(now.getTime() + this.securityPolicy.failedLoginLockoutMs).toISOString()
      : user.lockedUntil;
    const updated = await this.users.update({
      ...user,
      failedLoginCount: nextFailedLoginCount,
      lastFailedLoginAt: nowIso,
      lockedUntil,
      updatedAt: nowIso
    });
    await this.auditService?.record({
      action: lockedUntil ? "user_login_locked" : "user_login_failed",
      targetType: "user_account",
      targetId: user.id,
      outcome: "failed",
      details: {
        email: user.email,
        failedLoginCount: nextFailedLoginCount,
        lockedUntil
      },
      createdAt: nowIso
    });
    return updated;
  }

  private async requireActiveUser(userId: string): Promise<UserAccountRecord> {
    const user = await this.users.getById(userId);
    if (!user || user.disabledAt) {
      throw new UserAccountValidationError("User account is not available.");
    }
    return user;
  }

  private assertMfaEnabled(): void {
    if (!this.mfaPolicy.enabled) {
      throw new UserAccountValidationError("MFA is not enabled for this API.");
    }
    if (!this.mfaPolicy.secretEncryptionKey) {
      throw new UserAccountValidationError("MFA encryption key is required.");
    }
  }

  private assertPasswordAuthAllowed(email: string): void {
    const domain = getEmailDomain(email);
    if (domain && this.accessPolicy.ssoRequiredEmailDomains.includes(domain)) {
      throw new UserAccountSsoRequiredError(domain);
    }
  }

  private encryptMfaSecret(secret: string): string {
    if (!this.mfaPolicy.secretEncryptionKey) {
      throw new UserAccountValidationError("MFA encryption key is required.");
    }
    const key = createHash("sha256").update(this.mfaPolicy.secretEncryptionKey).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, "utf-8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
  }

  private decryptMfaSecret(encrypted: string): string {
    if (!this.mfaPolicy.secretEncryptionKey) {
      throw new UserAccountValidationError("MFA encryption key is required.");
    }
    const [version, ivValue, tagValue, ciphertextValue] = encrypted.split(":");
    if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) {
      throw new UserAccountValidationError("MFA secret is not readable.");
    }
    const key = createHash("sha256").update(this.mfaPolicy.secretEncryptionKey).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final()
    ]).toString("utf-8");
  }

  private verifyUserTotp(user: UserAccountRecord, code: string, now: Date): number | undefined {
    if (!user.mfaTotpSecretEncrypted) {
      throw new UserAccountValidationError("MFA setup has not been started.");
    }
    const secret = this.decryptMfaSecret(user.mfaTotpSecretEncrypted);
    return verifyTotpCode({
      secret,
      code,
      now,
      stepSeconds: this.mfaPolicy.totpStepSeconds,
      windowSteps: this.mfaPolicy.totpWindowSteps,
      minCounter: user.mfaTotpLastUsedCounter
    });
  }

  private verifyUserMfaCode(user: UserAccountRecord, code: string, now: Date): UserMfaVerificationResult | undefined {
    const counter = this.verifyUserTotp(user, code, now);
    if (counter !== undefined) {
      return {
        kind: "totp",
        counter
      };
    }
    const recoveryCodeHashes = consumeRecoveryCodeHash(user.mfaRecoveryCodeHashes ?? [], code);
    return recoveryCodeHashes
      ? {
          kind: "recovery",
          recoveryCodeHashes
        }
      : undefined;
  }

  private async recordMfaRecoveryCodeUsed(user: UserAccountRecord, now: Date): Promise<void> {
    await this.auditService?.record({
      action: "user_mfa_recovery_code_used",
      targetType: "user_account",
      targetId: user.id,
      details: {
        email: user.email
      },
      createdAt: now.toISOString()
    });
  }

  private verifyMfaTrustedDevice(user: UserAccountRecord, token: string, now: Date): UserAccountRecord["mfaTrustedDevices"] | undefined {
    const tokenHash = hashMfaTrustedDeviceToken(token);
    let matched = false;
    const nowIso = now.toISOString();
    const devices = pruneMfaTrustedDevices(user.mfaTrustedDevices ?? [], now).map((device) => {
      if (!matched && safeEqualStrings(device.tokenHash, tokenHash)) {
        matched = true;
        return {
          ...device,
          lastUsedAt: nowIso
        };
      }
      return device;
    });
    return matched ? devices : undefined;
  }

  private createMfaTrustedDevice(existingDevices: NonNullable<UserAccountRecord["mfaTrustedDevices"]>, now: Date): {
    token: string;
    devices: NonNullable<UserAccountRecord["mfaTrustedDevices"]>;
  } {
    const token = createPlainMfaDeviceToken();
    const nowIso = now.toISOString();
    const device = {
      id: createRecordId("mfa_device"),
      tokenHash: hashMfaTrustedDeviceToken(token),
      tokenPrefix: token.slice(0, 12),
      createdAt: nowIso,
      expiresAt: new Date(now.getTime() + this.mfaPolicy.trustedDeviceTtlMs).toISOString()
    };
    return {
      token,
      devices: [...existingDevices, device].slice(-this.mfaPolicy.maxTrustedDevices)
    };
  }

  private async recordMfaTrustedDeviceCreated(user: UserAccountRecord, now: Date): Promise<void> {
    await this.auditService?.record({
      action: "user_mfa_trusted_device_created",
      targetType: "user_account",
      targetId: user.id,
      details: {
        email: user.email
      },
      createdAt: now.toISOString()
    });
  }

  private async recordMfaTrustedDeviceUsed(user: UserAccountRecord, now: Date): Promise<void> {
    await this.auditService?.record({
      action: "user_mfa_trusted_device_used",
      targetType: "user_account",
      targetId: user.id,
      details: {
        email: user.email
      },
      createdAt: now.toISOString()
    });
  }

  private async createSessionForUser(
    user: UserAccountRecord,
    now: Date,
    expiresAt?: string
  ): Promise<CreatedUserSession> {
    const sessionToken = createPlainSessionToken();
    const nowIso = now.toISOString();
    const session = await this.sessions.create({
      id: createRecordId("session"),
      userId: user.id,
      tokenHash: hashToken(sessionToken),
      tokenPrefix: sessionToken.slice(0, 12),
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAt: expiresAt ?? new Date(now.getTime() + DEFAULT_SESSION_TTL_MS).toISOString()
    });
    await this.auditService?.record({
      action: "user_session_created",
      targetType: "user_session",
      targetId: session.id,
      details: {
        userId: user.id,
        expiresAt: session.expiresAt
      },
      createdAt: nowIso
    });
    return { sessionToken, session, user };
  }

  private async createActionToken(input: {
    user: UserAccountRecord;
    purpose: UserAccountActionTokenPurpose;
    now: Date;
    expiresAt: string;
  }): Promise<CreatedUserAccountActionToken> {
    const actionToken = createPlainActionToken(input.purpose);
    const nowIso = input.now.toISOString();
    const record = await this.actionTokens.create({
      id: createRecordId("user_action_token"),
      userId: input.user.id,
      email: input.user.email,
      purpose: input.purpose,
      tokenHash: hashToken(actionToken),
      tokenPrefix: actionToken.slice(0, 12),
      status: "pending",
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAt: input.expiresAt
    });
    return { actionToken, record };
  }

  private async readUsableActionToken(
    rawToken: string,
    purpose: UserAccountActionTokenPurpose
  ): Promise<UserAccountActionTokenRecord> {
    const actionToken = await this.actionTokens.getByHash(hashToken(rawToken));
    if (!actionToken || actionToken.purpose !== purpose || actionToken.status !== "pending") {
      throw new UserAccountValidationError(`${purpose} token is not valid.`);
    }
    const nowIso = new Date().toISOString();
    if (actionToken.expiresAt && actionToken.expiresAt <= nowIso) {
      await this.actionTokens.update({
        ...actionToken,
        status: "expired",
        updatedAt: nowIso
      });
      throw new UserAccountValidationError(`${purpose} token is expired.`);
    }
    return actionToken;
  }

  private async markActionTokenUsed(actionToken: UserAccountActionTokenRecord, nowIso: string): Promise<void> {
    await this.actionTokens.update({
      ...actionToken,
      status: "used",
      usedAt: nowIso,
      updatedAt: nowIso
    });
  }

  private async revokeUserSessions(userId: string, nowIso: string): Promise<void> {
    const sessions = await this.sessions.listByUser(userId, 200);
    await Promise.all(
      sessions
        .filter((session) => !session.revokedAt)
        .map((session) =>
          this.sessions.update({
            ...session,
            revokedAt: nowIso,
            updatedAt: nowIso
          })
        )
    );
  }

  private async notifyUserAccount(
    event: "user_email_verification_requested" | "user_email_verified" | "user_password_reset_requested" | "user_password_reset_completed",
    user: UserAccountRecord,
    actionToken: UserAccountActionTokenRecord,
    createdAt: string,
    plainActionToken?: string
  ): Promise<void> {
    if (!this.notifier) {
      return;
    }
    try {
      await this.notifier.notify({
        event,
        userId: user.id,
        email: user.email,
        actionTokenId: actionToken.id,
        actionTokenPurpose: actionToken.purpose,
        actionToken: plainActionToken,
        createdAt,
        expiresAt: actionToken.expiresAt,
        metadata: {
          tokenPrefix: actionToken.tokenPrefix,
          status: actionToken.status
        }
      });
    } catch (error) {
      await this.auditService?.record({
        action: "user_account_notification_failed",
        targetType: "user_account",
        targetId: user.id,
        outcome: "failed",
        details: {
          event,
          provider: this.notifier.id,
          actionTokenId: actionToken.id,
          error: error instanceof Error ? error.message : String(error)
        },
        createdAt
      });
    }
  }
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    throw new UserAccountValidationError("User account requires a valid email.");
  }
  return normalized;
}

function normalizeSecurityPolicy(input: Partial<UserAccountSecurityPolicy>): UserAccountSecurityPolicy {
  const policy = {
    ...DEFAULT_SECURITY_POLICY,
    ...input
  };
  if (!Number.isInteger(policy.passwordMinLength) || policy.passwordMinLength < 8) {
    throw new UserAccountValidationError("Password minimum length must be at least 8.");
  }
  if (!Array.isArray(policy.blockedPasswordTerms)) {
    throw new UserAccountValidationError("Blocked password terms must be a list.");
  }
  const blockedPasswordTerms = policy.blockedPasswordTerms
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
  if (!Number.isInteger(policy.maxFailedLoginAttempts) || policy.maxFailedLoginAttempts < 0) {
    throw new UserAccountValidationError("Max failed login attempts must be a non-negative integer.");
  }
  if (!Number.isInteger(policy.failedLoginLockoutMs) || policy.failedLoginLockoutMs <= 0) {
    throw new UserAccountValidationError("Failed login lockout must be a positive duration.");
  }
  return {
    ...policy,
    passwordRequireLetter: Boolean(policy.passwordRequireLetter),
    passwordRequireNumber: Boolean(policy.passwordRequireNumber),
    passwordRequireSymbol: Boolean(policy.passwordRequireSymbol),
    blockedPasswordTerms
  };
}

function normalizeAccessPolicy(input: Partial<UserAccountAccessPolicy>): UserAccountAccessPolicy {
  if (input.ssoRequiredEmailDomains !== undefined && !Array.isArray(input.ssoRequiredEmailDomains)) {
    throw new UserAccountValidationError("SSO required email domains must be a list.");
  }
  return {
    ssoRequiredEmailDomains: normalizeEmailDomains(input.ssoRequiredEmailDomains ?? DEFAULT_ACCESS_POLICY.ssoRequiredEmailDomains)
  };
}

function normalizeMfaPolicy(input: Partial<UserAccountMfaPolicy>): UserAccountMfaPolicy {
  const policy = {
    ...DEFAULT_MFA_POLICY,
    ...input
  };
  if (!Number.isInteger(policy.totpStepSeconds) || policy.totpStepSeconds <= 0) {
    throw new UserAccountValidationError("TOTP step seconds must be a positive integer.");
  }
  if (!Number.isInteger(policy.totpWindowSteps) || policy.totpWindowSteps < 0 || policy.totpWindowSteps > 5) {
    throw new UserAccountValidationError("TOTP window steps must be an integer between 0 and 5.");
  }
  if (!Number.isInteger(policy.trustedDeviceTtlMs) || policy.trustedDeviceTtlMs <= 0) {
    throw new UserAccountValidationError("MFA trusted device TTL must be a positive duration.");
  }
  if (!Number.isInteger(policy.maxTrustedDevices) || policy.maxTrustedDevices < 1 || policy.maxTrustedDevices > 100) {
    throw new UserAccountValidationError("MFA max trusted devices must be an integer between 1 and 100.");
  }
  if (!policy.issuer.trim()) {
    throw new UserAccountValidationError("MFA issuer is required.");
  }
  return {
    ...policy,
    issuer: policy.issuer.trim(),
    secretEncryptionKey: policy.secretEncryptionKey?.trim() || undefined
  };
}

function normalizeEmailDomains(domains: string[]): string[] {
  return Array.from(new Set(domains
    .map((domain) => domain.trim().toLowerCase().replace(/^@+/, ""))
    .filter(Boolean)));
}

function getEmailDomain(email: string): string | undefined {
  return email.split("@").at(-1);
}

function assertPassword(password: string, policy: UserAccountSecurityPolicy): void {
  if (password.length < policy.passwordMinLength) {
    throw new UserAccountValidationError(`Password must be at least ${policy.passwordMinLength} characters.`);
  }
  if (policy.passwordRequireLetter && !/[A-Za-z]/.test(password)) {
    throw new UserAccountValidationError("Password must include at least one letter.");
  }
  if (policy.passwordRequireNumber && !/[0-9]/.test(password)) {
    throw new UserAccountValidationError("Password must include at least one number.");
  }
  if (policy.passwordRequireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    throw new UserAccountValidationError("Password must include at least one symbol.");
  }
  const normalized = password.toLowerCase();
  if (policy.blockedPasswordTerms.some((term) => normalized.includes(term))) {
    throw new UserAccountValidationError("Password contains a blocked common term.");
  }
}

function isLoginLocked(user: UserAccountRecord, now: Date): boolean {
  return Boolean(user.lockedUntil && user.lockedUntil > now.toISOString());
}

function isMfaTotpEnabled(user: UserAccountRecord): boolean {
  return Boolean(user.mfaTotpEnabledAt && user.mfaTotpSecretEncrypted);
}

function pruneMfaTrustedDevices(
  devices: NonNullable<UserAccountRecord["mfaTrustedDevices"]>,
  now: Date
): NonNullable<UserAccountRecord["mfaTrustedDevices"]> {
  const nowIso = now.toISOString();
  return devices.filter((device) => !device.revokedAt && device.expiresAt > nowIso);
}

function createRecoveryCodes(): string[] {
  const codes = new Set<string>();
  while (codes.size < MFA_RECOVERY_CODE_COUNT) {
    codes.add(formatRecoveryCode(base32Encode(randomBytes(10)).slice(0, MFA_RECOVERY_CODE_CHARS)));
  }
  return [...codes];
}

function formatRecoveryCode(code: string): string {
  return code.match(/.{1,5}/g)?.join("-") ?? code;
}

function normalizeRecoveryCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]+/g, "");
}

function hashRecoveryCode(code: string): string {
  return hashToken(`mfa_recovery:${normalizeRecoveryCode(code)}`);
}

function hashMfaTrustedDeviceToken(token: string): string {
  return hashToken(`mfa_device:${token}`);
}

function consumeRecoveryCodeHash(storedHashes: string[], code: string): string[] | undefined {
  const normalized = normalizeRecoveryCode(code);
  if (!/^[A-Z2-7]{12,}$/.test(normalized)) {
    return undefined;
  }
  const expectedHash = hashRecoveryCode(normalized);
  let matched = false;
  const remaining: string[] = [];
  for (const storedHash of storedHashes) {
    if (!matched && safeEqualStrings(storedHash, expectedHash)) {
      matched = true;
    } else {
      remaining.push(storedHash);
    }
  }
  return matched ? remaining : undefined;
}

function createTotpUrl(input: {
  issuer: string;
  email: string;
  secret: string;
  periodSeconds: number;
}): string {
  const label = `${input.issuer}:${input.email}`;
  const params = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(input.periodSeconds)
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

function verifyTotpCode(input: {
  secret: string;
  code: string;
  now: Date;
  stepSeconds: number;
  windowSteps: number;
  minCounter?: number;
}): number | undefined {
  const normalizedCode = input.code.trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalizedCode)) {
    return undefined;
  }
  const currentCounter = Math.floor(input.now.getTime() / 1000 / input.stepSeconds);
  for (let offset = -input.windowSteps; offset <= input.windowSteps; offset += 1) {
    const counter = currentCounter + offset;
    if (counter < 0 || input.minCounter !== undefined && counter <= input.minCounter) {
      continue;
    }
    const expected = createTotpCode(input.secret, counter);
    if (safeEqualStrings(expected, normalizedCode)) {
      return counter;
    }
  }
  return undefined;
}

function createTotpCode(secret: string, counter: number): string {
  const secretBytes = base32Decode(secret);
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secretBytes).update(counterBytes).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const value = ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;
  return String(value % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

function base32Encode(buffer: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(value: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let current = 0;
  const bytes: number[] = [];
  for (const char of value.replace(/=+$/g, "").toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index === -1) {
      throw new UserAccountValidationError("MFA secret is not valid base32.");
    }
    current = (current << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((current >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function safeEqualStrings(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [scheme, saltValue, expectedValue] = storedHash.split("$");
  if (scheme !== "scrypt" || !saltValue || !expectedValue) {
    return false;
  }
  const salt = Buffer.from(saltValue, "base64url");
  const expected = Buffer.from(expectedValue, "base64url");
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function createPlainSessionToken(): string {
  return `vns_${randomBytes(32).toString("base64url")}`;
}

function createPlainMfaDeviceToken(): string {
  return `vnd_${randomBytes(32).toString("base64url")}`;
}

function createPlainActionToken(purpose: UserAccountActionTokenPurpose): string {
  const prefix = purpose === "email_verification" ? "vne" : "vnr";
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isExpired(record: UserSessionRecord): boolean {
  return Boolean(record.expiresAt && record.expiresAt <= new Date().toISOString());
}

function createRecordId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
