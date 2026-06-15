import { createHash, randomBytes } from "node:crypto";
import type {
  AuditRepository,
  OAuthGroupRoleMapping,
  OAuthIdentityRecord,
  OAuthIdentityRepository,
  OAuthLoginCompleteResult,
  OAuthLoginProvider,
  OAuthLoginStartResult,
  OAuthProviderProfile,
  OAuthStateRecord,
  OAuthStateRepository,
  TeamMemberRecord,
  TeamMemberRole
} from "../types.js";
import { AuditService } from "./AuditService.js";
import { TeamService } from "./TeamService.js";
import { UserAccountService } from "./UserAccountService.js";

const DEFAULT_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const roleRank: Record<TeamMemberRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4
};

export interface OAuthServicePolicy {
  enabled: boolean;
  redirectUri: string;
  stateTtlMs?: number;
  allowedReturnUrlOrigins?: string[];
  requireVerifiedEmail?: boolean;
  allowedEmailDomains?: string[];
  groupRoleMappings?: OAuthGroupRoleMapping[];
}

export class OAuthValidationError extends Error {}

export class OAuthService {
  private readonly auditService?: AuditService;
  private readonly stateTtlMs: number;

  constructor(
    private readonly states: OAuthStateRepository,
    private readonly identities: OAuthIdentityRepository,
    private readonly userAccounts: UserAccountService,
    audit: AuditRepository | AuditService | undefined,
    private readonly provider: OAuthLoginProvider | undefined,
    private readonly policy: OAuthServicePolicy,
    private readonly teams?: TeamService
  ) {
    this.auditService = audit instanceof AuditService ? audit : audit ? new AuditService(audit) : undefined;
    this.stateTtlMs = policy.stateTtlMs ?? DEFAULT_OAUTH_STATE_TTL_MS;
  }

  async startLogin(input: {
    provider?: string;
    returnUrl?: string;
    now?: Date;
  } = {}): Promise<OAuthLoginStartResult> {
    this.assertEnabled();
    const provider = this.requireProvider(input.provider);
    const now = input.now ?? new Date();
    const nowIso = now.toISOString();
    const state = createPlainOAuthState();
    const codeVerifier = createPlainCodeVerifier();
    const record = await this.states.create({
      id: createRecordId("oauth_state"),
      provider: provider.id,
      stateHash: hashOAuthSecret(state),
      codeVerifier,
      returnUrl: normalizeReturnUrl(input.returnUrl, this.policy.allowedReturnUrlOrigins),
      status: "pending",
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAt: new Date(now.getTime() + this.stateTtlMs).toISOString()
    });
    const authorizationUrl = provider.createAuthorizationUrl({
      state,
      redirectUri: this.policy.redirectUri,
      codeChallenge: createCodeChallenge(codeVerifier),
      returnUrl: record.returnUrl
    });
    await this.auditService?.record({
      action: "oauth_login_started",
      targetType: "oauth_state",
      targetId: record.id,
      details: {
        provider: provider.id,
        expiresAt: record.expiresAt,
        returnUrl: record.returnUrl
      },
      createdAt: nowIso
    });
    return {
      provider: provider.id,
      authorizationUrl,
      state,
      expiresAt: record.expiresAt,
      returnUrl: record.returnUrl
    };
  }

  async completeLogin(input: {
    state: string;
    code: string;
    now?: Date;
  }): Promise<OAuthLoginCompleteResult> {
    this.assertEnabled();
    if (!input.state.trim()) {
      throw new OAuthValidationError("OAuth state is required.");
    }
    if (!input.code.trim()) {
      throw new OAuthValidationError("OAuth code is required.");
    }
    const state = await this.states.getByHash(hashOAuthSecret(input.state));
    if (!state) {
      throw new OAuthValidationError("OAuth state is not valid.");
    }
    const provider = this.requireProvider(state.provider);
    const now = input.now ?? new Date();
    const nowIso = now.toISOString();
    if (state.status !== "pending") {
      throw new OAuthValidationError("OAuth state has already been used.");
    }
    if (state.expiresAt <= nowIso) {
      await this.states.update({
        ...state,
        status: "expired",
        updatedAt: nowIso
      });
      throw new OAuthValidationError("OAuth state has expired.");
    }

    const usedState = await this.states.update({
      ...state,
      status: "used",
      updatedAt: nowIso,
      usedAt: nowIso
    });
    const profile = await provider.exchangeCode({
      code: input.code,
      redirectUri: this.policy.redirectUri,
      codeVerifier: usedState.codeVerifier
    });
    const normalizedProfile = normalizeProfile(profile, this.policy);
    const existingIdentity = await this.identities.getByProviderSubject(provider.id, normalizedProfile.subject);
    const createdSession = await this.userAccounts.loginWithExternalIdentity({
      provider: provider.id,
      subject: normalizedProfile.subject,
      email: normalizedProfile.email,
      emailVerified: normalizedProfile.emailVerified,
      name: normalizedProfile.name,
      linkedUserId: existingIdentity?.userId
    });
    const identity = await this.identities.upsert({
      id: existingIdentity?.id ?? createRecordId("oauth_identity"),
      provider: provider.id,
      subject: normalizedProfile.subject,
      userId: createdSession.user.id,
      email: normalizedProfile.email,
      name: normalizedProfile.name,
      createdAt: existingIdentity?.createdAt ?? nowIso,
      updatedAt: nowIso,
      lastLoginAt: nowIso,
      metadata: {
        ...normalizedProfile.metadata,
        groups: normalizedProfile.groups
      }
    });
    const mappedTeamMemberships = await this.applyGroupRoleMappings(normalizedProfile, createdSession.user.id, nowIso);
    await this.auditService?.record({
      action: "oauth_login_completed",
      targetType: "oauth_identity",
      targetId: identity.id,
      details: {
        provider: provider.id,
        userId: createdSession.user.id,
        email: normalizedProfile.email,
        subjectHash: hashOAuthSecret(normalizedProfile.subject)
      },
      createdAt: nowIso
    });
    return {
      ...createdSession,
      identity,
      mappedTeamMemberships
    };
  }

  async listIdentitiesForUser(userId: string, limit = 20): Promise<OAuthIdentityRecord[]> {
    return this.identities.listByUser(userId, limit);
  }

  private assertEnabled(): void {
    if (!this.policy.enabled) {
      throw new OAuthValidationError("OAuth login is not enabled.");
    }
    if (!this.policy.redirectUri.trim()) {
      throw new OAuthValidationError("OAuth redirect URI is required.");
    }
    if (!this.provider) {
      throw new OAuthValidationError("OAuth provider is not configured.");
    }
  }

  private requireProvider(providerId?: string): OAuthLoginProvider {
    if (!this.provider) {
      throw new OAuthValidationError("OAuth provider is not configured.");
    }
    if (providerId && providerId !== this.provider.id) {
      throw new OAuthValidationError(`OAuth provider is not available: ${providerId}`);
    }
    return this.provider;
  }

  private async applyGroupRoleMappings(profile: OAuthProviderProfile, userId: string, createdAt: string): Promise<TeamMemberRecord[] | undefined> {
    const mappings = normalizeGroupRoleMappings(this.policy.groupRoleMappings ?? []);
    if (mappings.length === 0 || !this.teams) {
      return undefined;
    }
    const groups = new Set(normalizeGroups(profile.groups ?? []));
    if (groups.size === 0) {
      return [];
    }
    const memberships: TeamMemberRecord[] = [];
    for (const mapping of mappings) {
      if (!groups.has(normalizeGroupName(mapping.group))) {
        continue;
      }
      const team = await this.teams.getTeam(mapping.teamId);
      if (!team) {
        throw new OAuthValidationError(`OAuth group role mapping target team is not available: ${mapping.teamId}`);
      }
      const existing = await this.teams.getMember(mapping.teamId, userId);
      const role = existing && roleRank[existing.role] >= roleRank[mapping.role]
        ? existing.role
        : mapping.role;
      const member = existing && existing.role === role && !existing.revokedAt
        ? existing
        : await this.teams.upsertMember({
            teamId: mapping.teamId,
            userId,
            role
          });
      memberships.push(member);
      await this.auditService?.record({
        ownerId: mapping.teamId,
        action: "oauth_group_role_mapping_applied",
        targetType: "team_member",
        targetId: member.id,
        details: {
          userId,
          email: profile.email,
          group: mapping.group,
          role: member.role,
          requestedRole: mapping.role
        },
        createdAt
      });
    }
    return memberships;
  }
}

export class MockOAuthLoginProvider implements OAuthLoginProvider {
  readonly id = "mock";

  constructor(private readonly authorizationBaseUrl = "https://auth.local/mock") {}

  createAuthorizationUrl(input: {
    state: string;
    redirectUri: string;
    codeChallenge?: string;
    returnUrl?: string;
  }): string {
    const url = new URL(this.authorizationBaseUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", "mock-novel-game-maker");
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("state", input.state);
    if (input.codeChallenge) {
      url.searchParams.set("code_challenge", input.codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
    }
    if (input.returnUrl) {
      url.searchParams.set("return_url", input.returnUrl);
    }
    return url.toString();
  }

  async exchangeCode(input: { code: string }): Promise<OAuthProviderProfile> {
    const parsed = parseMockCode(input.code);
    return {
      subject: `mock:${parsed.email}`,
      email: parsed.email,
      emailVerified: true,
      name: parsed.name,
      groups: parsed.groups,
      metadata: {
        provider: "mock"
      }
    };
  }
}

export interface OidcOAuthLoginProviderOptions {
  issuer?: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes?: string[];
  groupsClaim?: string;
  requestTimeoutMs?: number;
  fetch?: typeof fetch;
}

export class OidcOAuthLoginProvider implements OAuthLoginProvider {
  readonly id = "oidc";
  private readonly scopes: string[];
  private readonly requestTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OidcOAuthLoginProviderOptions) {
    this.scopes = options.scopes ?? ["openid", "email", "profile"];
    this.requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
    this.fetchImpl = options.fetch ?? fetch;
  }

  createAuthorizationUrl(input: {
    state: string;
    redirectUri: string;
    codeChallenge?: string;
  }): string {
    const url = new URL(this.options.authorizationUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.options.clientId);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("scope", this.scopes.join(" "));
    url.searchParams.set("state", input.state);
    if (input.codeChallenge) {
      url.searchParams.set("code_challenge", input.codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
    }
    return url.toString();
  }

  async exchangeCode(input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<OAuthProviderProfile> {
    const tokenBody = new URLSearchParams();
    tokenBody.set("grant_type", "authorization_code");
    tokenBody.set("code", input.code);
    tokenBody.set("redirect_uri", input.redirectUri);
    tokenBody.set("client_id", this.options.clientId);
    tokenBody.set("client_secret", this.options.clientSecret);
    if (input.codeVerifier) {
      tokenBody.set("code_verifier", input.codeVerifier);
    }
    const tokenResponse = await this.fetchWithTimeout(this.options.tokenUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json"
      },
      body: tokenBody
    });
    const tokenJson = await readJsonResponse(tokenResponse, "OIDC token exchange failed.");
    const accessToken = readStringProperty(tokenJson, "access_token");
    const userInfoResponse = await this.fetchWithTimeout(this.options.userInfoUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`
      }
    });
    const profile = await readJsonResponse(userInfoResponse, "OIDC userinfo request failed.");
    const subject = readStringProperty(profile, "sub");
    const email = readStringProperty(profile, "email");
    const name = readOptionalStringProperty(profile, "name") ??
      readOptionalStringProperty(profile, "preferred_username") ??
      email;
    const groups = readOptionalStringListProperty(profile, this.options.groupsClaim ?? "groups");
    return {
      subject,
      email,
      emailVerified: readOptionalBooleanProperty(profile, "email_verified"),
      name,
      groups,
      metadata: {
        issuer: this.options.issuer,
        provider: "oidc",
        groups
      }
    };
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      return await this.fetchImpl(url, {
        ...init,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeProfile(profile: OAuthProviderProfile, policy: OAuthServicePolicy): OAuthProviderProfile {
  const subject = profile.subject.trim();
  const email = normalizeEmail(profile.email);
  if (!subject) {
    throw new OAuthValidationError("OAuth profile subject is required.");
  }
  if (!email) {
    throw new OAuthValidationError("OAuth profile email is required.");
  }
  if (policy.requireVerifiedEmail !== false && profile.emailVerified !== true) {
    throw new OAuthValidationError("OAuth profile email must be verified.");
  }
  const allowedDomains = new Set((policy.allowedEmailDomains ?? [])
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean));
  if (allowedDomains.size > 0 && !allowedDomains.has(email.split("@").at(-1) ?? "")) {
    throw new OAuthValidationError("OAuth profile email domain is not allowed.");
  }
  return {
    ...profile,
    subject,
    email,
    name: profile.name?.trim() || undefined,
    groups: normalizeGroups(profile.groups ?? [])
  };
}

function normalizeGroupRoleMappings(mappings: OAuthGroupRoleMapping[]): OAuthGroupRoleMapping[] {
  return mappings
    .map((mapping) => ({
      group: normalizeGroupName(mapping.group),
      teamId: mapping.teamId.trim(),
      role: mapping.role
    }))
    .filter((mapping) => mapping.group && mapping.teamId);
}

function normalizeGroups(groups: string[]): string[] {
  return Array.from(new Set(groups
    .map(normalizeGroupName)
    .filter(Boolean)));
}

function normalizeGroupName(group: string): string {
  return group.trim().toLowerCase();
}

function normalizeReturnUrl(value: string | undefined, allowedOrigins: string[] | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  const parsed = new URL(trimmed);
  const allowed = new Set((allowedOrigins ?? []).map((origin) => origin.replace(/\/+$/g, "")));
  if (allowed.size === 0 || allowed.has(parsed.origin)) {
    return parsed.toString();
  }
  throw new OAuthValidationError("OAuth return URL origin is not allowed.");
}

function parseMockCode(code: string): { email: string; name?: string; groups?: string[] } {
  const cleaned = code.trim().replace(/^mock:/, "");
  if (!cleaned) {
    throw new OAuthValidationError("Mock OAuth code is required.");
  }
  const [rawEmailOrSubject, name, rawGroups] = cleaned.split("|");
  const emailOrSubject = rawEmailOrSubject ?? "user";
  const email = emailOrSubject.includes("@")
    ? normalizeEmail(emailOrSubject)
    : `sso.${slugify(emailOrSubject)}@example.com`;
  return {
    email,
    name: name?.trim() || email.split("@")[0],
    groups: rawGroups ? normalizeGroups(rawGroups.split(",")) : undefined
  };
}

async function readJsonResponse(response: Response, errorMessage: string): Promise<Record<string, unknown>> {
  const body = await response.text();
  let parsed: unknown;
  try {
    parsed = body ? JSON.parse(body) : {};
  } catch {
    throw new OAuthValidationError(errorMessage);
  }
  if (!response.ok) {
    throw new OAuthValidationError(errorMessage);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new OAuthValidationError(errorMessage);
  }
  return parsed as Record<string, unknown>;
}

function readStringProperty(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new OAuthValidationError(`OAuth response is missing ${key}.`);
  }
  return value.trim();
}

function readOptionalStringProperty(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readOptionalBooleanProperty(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function readOptionalStringListProperty(record: Record<string, unknown>, key: string): string[] | undefined {
  const value = record[key];
  if (Array.isArray(value)) {
    return normalizeGroups(value.filter((item): item is string => typeof item === "string"));
  }
  if (typeof value === "string" && value.trim()) {
    return normalizeGroups(value.split(","));
  }
  return undefined;
}

function createPlainOAuthState(): string {
  return `vno_${randomBytes(32).toString("base64url")}`;
}

function createPlainCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function createCodeChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

function hashOAuthSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function slugify(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "user";
}

function createRecordId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
