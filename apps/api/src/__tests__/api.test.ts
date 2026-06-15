import { mkdtemp } from "node:fs/promises";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sampleNovelText, type VNProject } from "@novel-game-maker/vn-core";
import { createProjectFromNovel } from "@novel-game-maker/vn-agent";
import { createPlatform, type VNPlatform } from "@novel-game-maker/vn-platform";
import { createApiServer } from "../server";
import { loadConfig, type ApiConfig } from "../config";

const servers: Array<{ close(callback?: (error?: Error) => void): void }> = [];

afterEach(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve, reject) =>
          server.close((error?: Error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          })
        )
    )
  );
  servers.length = 0;
  vi.restoreAllMocks();
});

describe("api server", () => {
  it("reports health", async () => {
    const url = await startTestServer();
    const response = await fetch(`${url}/health`);
    const body = await response.json() as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("propagates request ids and emits structured access logs when enabled", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const url = await startTestServer({ accessLogEnabled: true });
    const response = await fetch(`${url}/health`, {
      headers: {
        "x-request-id": "req_api_test_1234"
      }
    });
    await response.json();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(response.headers.get("x-request-id")).toBe("req_api_test_1234");
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
    const accessLog = logSpy.mock.calls
      .map((call) => String(call[0]))
      .find((line) => line.includes("\"event\":\"http_request\""));
    expect(accessLog).toBeTruthy();
    expect(JSON.parse(accessLog!)).toMatchObject({
      event: "http_request",
      requestId: "req_api_test_1234",
      method: "GET",
      path: "/health",
      statusCode: 200,
      authRole: "public"
    });
  });

  it("serves Prometheus metrics to admin callers without path ids or queries", async () => {
    const url = await startTestServer({ apiAuthToken: "admin-secret" });
    await fetch(`${url}/health`);
    await fetch(`${url}/v1/projects/project_secret_123?ownerId=owner_secret`, {
      headers: { authorization: "Bearer admin-secret" }
    });

    const unauthorized = await fetch(`${url}/metrics`);
    expect(unauthorized.status).toBe(401);

    const response = await fetch(`${url}/metrics`, {
      headers: { authorization: "Bearer admin-secret" }
    });
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(text).toContain("agentic_galgame_api_uptime_seconds");
    expect(text).toContain("agentic_galgame_api_requests_total");
    expect(text).toContain("route=\"/health\"");
    expect(text).toContain("route=\"/v1/projects/:id\"");
    expect(text).toContain("auth_role=\"public\"");
    expect(text).not.toContain("project_secret_123");
    expect(text).not.toContain("owner_secret");
    expect(text).not.toContain("ownerId=");
  });

  it("can expose metrics publicly only when configured", async () => {
    const url = await startTestServer({
      apiAuthToken: "admin-secret",
      metricsPublic: true
    });

    const response = await fetch(`${url}/metrics`);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain("agentic_galgame_api_requests_total");
  });

  it("reports sanitized server errors to a signed webhook", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const webhook = await startRecordingWebhook();
    const dataDir = await mkdtemp(join(tmpdir(), "vn-api-platform-"));
    const platform = createPlatform({ dataDir });
    const fakeSecret = `sk-${"x".repeat(24)}`;
    platform.projects.getProject = async () => {
      throw new Error(`Database unavailable for Bearer secret-token and ${fakeSecret}`);
    };
    const url = await startTestServer({
      apiAuthToken: "admin-secret",
      errorWebhook: {
        url: webhook.url,
        secret: "error-webhook-secret",
        timeoutMs: 1_000
      }
    }, platform);

    const response = await fetch(`${url}/v1/projects/project_secret_123?ownerId=owner_secret`, {
      headers: { authorization: "Bearer admin-secret" }
    });
    expect(response.status).toBe(500);
    await waitFor(() => webhook.calls.length === 1);

    const call = webhook.calls[0]!;
    const payload = JSON.parse(call.body) as {
      event: string;
      route: string;
      requestId: string;
      errorMessage: string;
    };
    const timestamp = String(call.headers["x-novel-game-maker-timestamp"]);
    const expectedSignature = createHmac("sha256", "error-webhook-secret")
      .update(`${timestamp}.${call.body}`)
      .digest("hex");

    expect(call.headers["x-novel-game-maker-event"]).toBe("api_server_error");
    expect(call.headers["x-novel-game-maker-signature"]).toBe(`sha256=${expectedSignature}`);
    expect(payload.event).toBe("api_server_error");
    expect(payload.route).toBe("/v1/projects/:id");
    expect(payload.requestId).toBeTruthy();
    expect(payload.errorMessage).toContain("Bearer [redacted]");
    expect(payload.errorMessage).toContain("[redacted-secret]");
    expect(call.body).not.toContain("project_secret_123");
    expect(call.body).not.toContain("owner_secret");
    expect(call.body).not.toContain("secret-token");
    expect(call.body).not.toContain(fakeSecret);
    const errorLog = errorSpy.mock.calls
      .map((call) => String(call[0]))
      .find((line) => line.includes("\"event\":\"server_error\""));
    expect(errorLog).toContain("\"route\":\"/v1/projects/:id\"");
    expect(errorLog).not.toContain(fakeSecret);
  });

  it("requires bearer auth when configured", async () => {
    const url = await startTestServer({ apiAuthToken: "secret" });

    expect((await fetch(`${url}/health`)).status).toBe(200);
    expect((await fetch(`${url}/v1/projects?ownerId=owner_1`)).status).toBe(401);
    expect((await fetch(`${url}/v1/projects?ownerId=owner_1`, { headers: { authorization: "Bearer secret" } })).status).toBe(200);
  });

  it("enforces owner-scoped bearer tokens", async () => {
    const url = await startTestServer({
      apiAuthToken: "admin-secret",
      ownerAccessTokens: [
        { ownerId: "owner_a", token: "owner-a-token" },
        { ownerId: "owner_b", token: "owner-b-token" }
      ]
    });

    expect((await fetch(`${url}/v1/projects?ownerId=owner_a`, {
      headers: { authorization: "Bearer owner-a-token" }
    })).status).toBe(200);
    expect((await fetch(`${url}/v1/projects?ownerId=owner_b`, {
      headers: { authorization: "Bearer owner-a-token" }
    })).status).toBe(403);
    expect((await fetch(`${url}/v1/jobs/run-next`, {
      method: "POST",
      headers: { authorization: "Bearer owner-a-token" }
    })).status).toBe(403);
    expect((await fetch(`${url}/v1/jobs/run-next`, {
      method: "POST",
      headers: { authorization: "Bearer admin-secret" }
    })).status).toBe(200);
  });

  it("authorizes user-scoped tokens through team roles", async () => {
    const url = await startTestServer({
      apiAuthToken: "admin-secret",
      userAccessTokens: [
        { userId: "user_editor", token: "user-editor-token" },
        { userId: "user_viewer", token: "user-viewer-token" }
      ]
    });
    await postJson(`${url}/v1/teams`, {
      id: "team_alpha",
      name: "Alpha Studio",
      ownerUserId: "user_owner"
    }, { authorization: "Bearer admin-secret" });
    await postJson(`${url}/v1/teams/team_alpha/members`, {
      userId: "user_editor",
      role: "editor"
    }, { authorization: "Bearer admin-secret" });
    await postJson(`${url}/v1/teams/team_alpha/members`, {
      userId: "user_viewer",
      role: "viewer"
    }, { authorization: "Bearer admin-secret" });

    const createdResponse = await fetch(`${url}/v1/projects/from-novel`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer user-editor-token"
      },
      body: JSON.stringify({
        ownerId: "team_alpha",
        title: "团队项目",
        novelText: sampleNovelText
      })
    });
    const viewerList = await fetch(`${url}/v1/projects?ownerId=team_alpha`, {
      headers: { authorization: "Bearer user-viewer-token" }
    });
    const viewerWrite = await fetch(`${url}/v1/jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer user-viewer-token"
      },
      body: JSON.stringify({
        ownerId: "team_alpha",
        kind: "novel_to_project",
        input: {
          title: "禁止写入",
          novelText: sampleNovelText
        }
      })
    });
    const crossTeam = await fetch(`${url}/v1/projects?ownerId=team_beta`, {
      headers: { authorization: "Bearer user-editor-token" }
    });

    expect(createdResponse.status).toBe(201);
    expect(viewerList.status).toBe(200);
    expect(viewerWrite.status).toBe(403);
    expect(crossTeam.status).toBe(403);
  });

  it("supports team invitation lifecycle with one-time hashed invite tokens", async () => {
    const url = await startTestServer({
      apiAuthToken: "admin-secret",
      ownerAccessTokens: [
        { ownerId: "team_alpha", token: "owner-alpha-token" },
        { ownerId: "team_beta", token: "owner-beta-token" }
      ],
      userAccessTokens: [
        { userId: "user_editor", token: "user-editor-token" }
      ]
    });
    await postJson(`${url}/v1/teams`, {
      id: "team_alpha",
      name: "Alpha Studio",
      ownerUserId: "user_owner"
    }, { authorization: "Bearer admin-secret" });
    const createResponse = await fetch(`${url}/v1/teams/team_alpha/invitations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer owner-alpha-token"
      },
      body: JSON.stringify({
        email: "Editor@Example.COM",
        role: "editor",
        invitedUserId: "user_editor"
      })
    });
    const created = await createResponse.json() as {
      invitationToken: string;
      invitation: {
        id: string;
        email: string;
        role: string;
        status: string;
        tokenHash?: string;
        tokenPrefix: string;
      };
    };
    const listResponse = await fetch(`${url}/v1/teams/team_alpha/invitations`, {
      headers: { authorization: "Bearer owner-alpha-token" }
    });
    const listed = await listResponse.json() as {
      invitations: Array<{ id: string; status: string; tokenHash?: string }>;
    };
    const forbiddenCreate = await fetch(`${url}/v1/teams/team_alpha/invitations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer owner-beta-token"
      },
      body: JSON.stringify({
        email: "other@example.com",
        role: "viewer"
      })
    });
    const acceptedResponse = await fetch(`${url}/v1/team-invitations/accept`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer user-editor-token"
      },
      body: JSON.stringify({
        invitationToken: created.invitationToken
      })
    });
    const accepted = await acceptedResponse.json() as {
      invitation: { id: string; status: string; acceptedByUserId?: string; tokenHash?: string };
      member: { teamId: string; userId: string; role: string };
    };
    const createdProject = await fetch(`${url}/v1/projects/from-novel`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer user-editor-token"
      },
      body: JSON.stringify({
        ownerId: "team_alpha",
        title: "邀请后的团队项目",
        novelText: sampleNovelText
      })
    });
    const replayResponse = await fetch(`${url}/v1/team-invitations/accept`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer user-editor-token"
      },
      body: JSON.stringify({
        invitationToken: created.invitationToken
      })
    });

    expect(createResponse.status).toBe(201);
    expect(created.invitationToken).toMatch(/^vni_/);
    expect(created.invitation.email).toBe("editor@example.com");
    expect(created.invitation.status).toBe("pending");
    expect(created.invitation.tokenPrefix).toBe(created.invitationToken.slice(0, 12));
    expect(created.invitation.tokenHash).toBeUndefined();
    expect(listResponse.status).toBe(200);
    expect(listed.invitations[0]?.id).toBe(created.invitation.id);
    expect(listed.invitations[0]?.tokenHash).toBeUndefined();
    expect(forbiddenCreate.status).toBe(403);
    expect(acceptedResponse.status).toBe(200);
    expect(accepted.invitation.status).toBe("accepted");
    expect(accepted.invitation.acceptedByUserId).toBe("user_editor");
    expect(accepted.invitation.tokenHash).toBeUndefined();
    expect(accepted.member).toEqual(expect.objectContaining({
      teamId: "team_alpha",
      userId: "user_editor",
      role: "editor"
    }));
    expect(createdProject.status).toBe(201);
    expect(replayResponse.status).toBe(409);
  });

  it("supports user registration, login, session auth, and invitation acceptance", async () => {
    const url = await startTestServer({
      apiAuthToken: "admin-secret"
    });
    await postJson(`${url}/v1/teams`, {
      id: "team_alpha",
      name: "Alpha Studio",
      ownerUserId: "user_owner"
    }, { authorization: "Bearer admin-secret" });
    const invite = await postJson(`${url}/v1/teams/team_alpha/invitations`, {
      email: "editor@example.com",
      role: "editor"
    }, { authorization: "Bearer admin-secret" }) as {
      invitationToken: string;
      invitation: { tokenHash?: string };
    };

    const registerResponse = await fetch(`${url}/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "Editor@Example.COM",
        password: "correct-password",
        name: "Editor"
      })
    });
    const registered = await registerResponse.json() as {
      sessionToken: string;
      user: { id: string; email: string; passwordHash?: string };
      session: { id: string; tokenHash?: string; tokenPrefix: string };
    };
    const meResponse = await fetch(`${url}/v1/auth/me`, {
      headers: { authorization: `Bearer ${registered.sessionToken}` }
    });
    const me = await meResponse.json() as {
      auth: { role: string; userId: string; email?: string };
      user: { id: string; email: string; passwordHash?: string };
    };
    const acceptedResponse = await fetch(`${url}/v1/team-invitations/accept`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${registered.sessionToken}`
      },
      body: JSON.stringify({
        invitationToken: invite.invitationToken
      })
    });
    const accepted = await acceptedResponse.json() as {
      member: { teamId: string; userId: string; role: string };
    };
    const createdProject = await fetch(`${url}/v1/projects/from-novel`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${registered.sessionToken}`
      },
      body: JSON.stringify({
        ownerId: "team_alpha",
        title: "登录账号项目",
        novelText: sampleNovelText
      })
    });
    const secondLoginResponse = await fetch(`${url}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "editor@example.com",
        password: "correct-password"
      })
    });
    const secondLoggedIn = await secondLoginResponse.json() as {
      sessionToken: string;
      session: { id: string; tokenHash?: string };
    };
    const sessionsResponse = await fetch(`${url}/v1/auth/sessions`, {
      headers: { authorization: `Bearer ${registered.sessionToken}` }
    });
    const sessions = await sessionsResponse.json() as {
      sessions: Array<{ id: string; tokenHash?: string }>;
    };
    const revokeSecondSessionResponse = await fetch(`${url}/v1/auth/sessions/${secondLoggedIn.session.id}/revoke`, {
      method: "POST",
      headers: { authorization: `Bearer ${registered.sessionToken}` }
    });
    const revokedSecondSession = await revokeSecondSessionResponse.json() as {
      session: { id: string; tokenHash?: string; revokedAt?: string };
    };
    const revokedSessionMeResponse = await fetch(`${url}/v1/auth/me`, {
      headers: { authorization: `Bearer ${secondLoggedIn.sessionToken}` }
    });
    const logoutResponse = await fetch(`${url}/v1/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${registered.sessionToken}` }
    });
    const afterLogoutResponse = await fetch(`${url}/v1/auth/me`, {
      headers: { authorization: `Bearer ${registered.sessionToken}` }
    });
    const loginResponse = await fetch(`${url}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "editor@example.com",
        password: "correct-password"
      })
    });
    const loggedIn = await loginResponse.json() as {
      sessionToken: string;
      user: { id: string; email: string; passwordHash?: string };
      session: { tokenHash?: string };
    };

    expect(invite.invitation.tokenHash).toBeUndefined();
    expect(registerResponse.status).toBe(201);
    expect(registered.sessionToken).toMatch(/^vns_/);
    expect(registered.user.email).toBe("editor@example.com");
    expect(registered.user.passwordHash).toBeUndefined();
    expect(registered.session.tokenHash).toBeUndefined();
    expect(registered.session.tokenPrefix).toBe(registered.sessionToken.slice(0, 12));
    expect(meResponse.status).toBe(200);
    expect(me.auth).toEqual(expect.objectContaining({
      role: "user",
      userId: registered.user.id,
      email: "editor@example.com"
    }));
    expect(me.user.passwordHash).toBeUndefined();
    expect(acceptedResponse.status).toBe(200);
    expect(accepted.member).toEqual(expect.objectContaining({
      teamId: "team_alpha",
      userId: registered.user.id,
      role: "editor"
    }));
    expect(createdProject.status).toBe(201);
    expect(secondLoginResponse.status).toBe(200);
    expect(secondLoggedIn.session.tokenHash).toBeUndefined();
    expect(sessionsResponse.status).toBe(200);
    expect(sessions.sessions.every((session) => session.tokenHash === undefined)).toBe(true);
    expect(sessions.sessions.map((session) => session.id)).toContain(secondLoggedIn.session.id);
    expect(revokeSecondSessionResponse.status).toBe(200);
    expect(revokedSecondSession.session.id).toBe(secondLoggedIn.session.id);
    expect(revokedSecondSession.session.tokenHash).toBeUndefined();
    expect(revokedSecondSession.session.revokedAt).toBeTruthy();
    expect(revokedSessionMeResponse.status).toBe(401);
    expect(logoutResponse.status).toBe(200);
    expect(afterLogoutResponse.status).toBe(401);
    expect(loginResponse.status).toBe(200);
    expect(loggedIn.sessionToken).toMatch(/^vns_/);
    expect(loggedIn.user.id).toBe(registered.user.id);
    expect(loggedIn.user.passwordHash).toBeUndefined();
    expect(loggedIn.session.tokenHash).toBeUndefined();
  });

  it("supports OAuth SSO start and callback through user sessions", async () => {
    const url = await startTestServer({
      apiAuthToken: "admin-secret",
      oauth: {
        enabled: true,
        provider: "mock",
        redirectUri: "https://api.example.com/v1/auth/oauth/callback",
        stateTtlMs: 10 * 60_000,
        allowedReturnUrlOrigins: ["https://studio.example.com"],
        requireVerifiedEmail: true,
        allowedEmailDomains: ["example.com"],
        groupRoleMappings: [],
        mockAuthorizationBaseUrl: "https://auth.example.com/mock"
      }
    });
    const startedResponse = await postJsonResponse(`${url}/v1/auth/oauth/start`, {
      returnUrl: "https://studio.example.com/projects"
    });
    const started = await startedResponse.json() as {
      provider: string;
      authorizationUrl: string;
      state: string;
      expiresAt: string;
      returnUrl?: string;
    };
    const completedResponse = await postJsonResponse(`${url}/v1/auth/oauth/callback`, {
      state: started.state,
      code: "sso.editor@example.com|SSO Editor"
    });
    const completed = await completedResponse.json() as {
      sessionToken: string;
      user: { id: string; email: string; emailVerifiedAt?: string };
      identity: { provider: string; userId: string; email: string; subject?: string };
    };
    const meResponse = await fetch(`${url}/v1/auth/me`, {
      headers: { authorization: `Bearer ${completed.sessionToken}` }
    });
    const me = await meResponse.json() as { auth: { role: string; userId: string }; user: { email: string } };
    const replayResponse = await postJsonResponse(`${url}/v1/auth/oauth/callback`, {
      state: started.state,
      code: "sso.editor@example.com|SSO Editor"
    });

    expect(startedResponse.status).toBe(201);
    expect(started.provider).toBe("mock");
    expect(started.authorizationUrl).toContain("https://auth.example.com/mock");
    expect(started.authorizationUrl).toContain("code_challenge=");
    expect(started.returnUrl).toBe("https://studio.example.com/projects");
    expect(completedResponse.status).toBe(200);
    expect(completed.sessionToken).toMatch(/^vns_/);
    expect(completed.user.email).toBe("sso.editor@example.com");
    expect(completed.user.emailVerifiedAt).toBeTruthy();
    expect(completed.identity.provider).toBe("mock");
    expect(completed.identity.userId).toBe(completed.user.id);
    expect(completed.identity.subject).toBeUndefined();
    expect(meResponse.status).toBe(200);
    expect(me.auth).toMatchObject({ role: "user", userId: completed.user.id });
    expect(me.user.email).toBe("sso.editor@example.com");
    expect(replayResponse.status).toBe(400);
  });

  it("requires SSO for configured managed email domains", async () => {
    const url = await startTestServer({
      userAccountAccessPolicy: {
        ssoRequiredEmailDomains: ["example.com"]
      },
      oauth: {
        enabled: true,
        provider: "mock",
        redirectUri: "https://api.example.com/v1/auth/oauth/callback",
        stateTtlMs: 10 * 60_000,
        allowedReturnUrlOrigins: [],
        requireVerifiedEmail: true,
        allowedEmailDomains: ["example.com"],
        groupRoleMappings: [],
        mockAuthorizationBaseUrl: "https://auth.example.com/mock"
      }
    });
    const passwordRegisterResponse = await postJsonResponse(`${url}/v1/auth/register`, {
      email: "managed@example.com",
      password: "correct-password"
    });
    const passwordRegister = await passwordRegisterResponse.json() as {
      error: string;
      ssoRequired?: boolean;
      domain?: string;
    };
    const started = await postJson(`${url}/v1/auth/oauth/start`, {}) as { state: string };
    const completedResponse = await postJsonResponse(`${url}/v1/auth/oauth/callback`, {
      state: started.state,
      code: "managed@example.com|Managed"
    });
    const completed = await completedResponse.json() as { user: { email: string } };
    const passwordLoginResponse = await postJsonResponse(`${url}/v1/auth/login`, {
      email: "managed@example.com",
      password: "correct-password"
    });

    expect(passwordRegisterResponse.status).toBe(403);
    expect(passwordRegister).toMatchObject({
      error: "SSO is required for this email domain.",
      ssoRequired: true,
      domain: "example.com"
    });
    expect(completedResponse.status).toBe(200);
    expect(completed.user.email).toBe("managed@example.com");
    expect(passwordLoginResponse.status).toBe(403);
  });

  it("maps OAuth provider groups to team roles during SSO callback", async () => {
    const url = await startTestServer({
      apiAuthToken: "admin-secret",
      oauth: {
        enabled: true,
        provider: "mock",
        redirectUri: "https://api.example.com/v1/auth/oauth/callback",
        stateTtlMs: 10 * 60_000,
        allowedReturnUrlOrigins: [],
        requireVerifiedEmail: true,
        allowedEmailDomains: ["example.com"],
        groupRoleMappings: [
          { group: "vn-editors", teamId: "team_alpha", role: "editor" }
        ],
        mockAuthorizationBaseUrl: "https://auth.example.com/mock"
      }
    });
    await postJson(`${url}/v1/teams`, {
      id: "team_alpha",
      name: "Alpha Studio"
    }, { authorization: "Bearer admin-secret" });
    const started = await postJson(`${url}/v1/auth/oauth/start`, {}) as { state: string };
    const completedResponse = await postJsonResponse(`${url}/v1/auth/oauth/callback`, {
      state: started.state,
      code: "grouped@example.com|Grouped|vn-editors"
    });
    const completed = await completedResponse.json() as {
      sessionToken: string;
      mappedTeamMemberships?: Array<{ teamId: string; role: string }>;
    };
    const teamProjectsResponse = await fetch(`${url}/v1/projects?ownerId=team_alpha`, {
      headers: { authorization: `Bearer ${completed.sessionToken}` }
    });

    expect(completedResponse.status).toBe(200);
    expect(completed.mappedTeamMemberships?.[0]).toMatchObject({
      teamId: "team_alpha",
      role: "editor"
    });
    expect(teamProjectsResponse.status).toBe(200);
  });

  it("supports SCIM user provisioning and deprovisioning with a dedicated bearer token", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-api-scim-"))
    });
    const registered = await platform.userAccounts.register({
      email: "sessioned@example.com",
      password: "correct-password",
      name: "Sessioned"
    });
    const loggedIn = await platform.userAccounts.login({
      email: "sessioned@example.com",
      password: "correct-password"
    });
    const url = await startTestServer({
      apiAuthToken: "admin-secret",
      scim: {
        enabled: true,
        bearerToken: "scim-token-strong-000000"
      }
    }, platform);
    const scimHeaders = {
      "content-type": "application/scim+json",
      authorization: "Bearer scim-token-strong-000000"
    };

    const unauthorized = await fetch(`${url}/v1/scim/v2/ServiceProviderConfig`);
    const serviceConfig = await fetch(`${url}/v1/scim/v2/ServiceProviderConfig`, {
      headers: { authorization: "Bearer scim-token-strong-000000" }
    });
    const createdResponse = await fetch(`${url}/v1/scim/v2/Users`, {
      method: "POST",
      headers: scimHeaders,
      body: JSON.stringify({
        userName: "Provisioned@Example.COM",
        displayName: "Provisioned Editor",
        active: true,
        emails: [{ value: "provisioned@example.com", primary: true }]
      })
    });
    const created = await createdResponse.json() as {
      id: string;
      userName: string;
      displayName: string;
      active: boolean;
      passwordHash?: string;
    };
    const filteredResponse = await fetch(`${url}/v1/scim/v2/Users?filter=${encodeURIComponent("userName eq \"provisioned@example.com\"")}`, {
      headers: { authorization: "Bearer scim-token-strong-000000" }
    });
    const filtered = await filteredResponse.json() as {
      totalResults: number;
      Resources: Array<{ id: string; userName: string; passwordHash?: string }>;
    };
    const disabledResponse = await fetch(`${url}/v1/scim/v2/Users/${encodeURIComponent(created.id)}`, {
      method: "PATCH",
      headers: scimHeaders,
      body: JSON.stringify({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [
          { op: "replace", path: "active", value: false }
        ]
      })
    });
    const disabled = await disabledResponse.json() as { active: boolean; passwordHash?: string };
    const reenabledResponse = await fetch(`${url}/v1/scim/v2/Users/${encodeURIComponent(created.id)}`, {
      method: "PATCH",
      headers: scimHeaders,
      body: JSON.stringify({
        Operations: [
          { op: "replace", path: "active", value: true },
          { op: "replace", path: "displayName", value: "Renamed Editor" }
        ]
      })
    });
    const reenabled = await reenabledResponse.json() as { active: boolean; displayName: string };
    const deletedResponse = await fetch(`${url}/v1/scim/v2/Users/${encodeURIComponent(registered.user.id)}`, {
      method: "DELETE",
      headers: { authorization: "Bearer scim-token-strong-000000" }
    });
    const deleted = await deletedResponse.json() as { active: boolean; id: string };
    const afterDeleteMe = await fetch(`${url}/v1/auth/me`, {
      headers: { authorization: `Bearer ${loggedIn.sessionToken}` }
    });

    expect(unauthorized.status).toBe(401);
    expect(serviceConfig.status).toBe(200);
    expect(createdResponse.status).toBe(201);
    expect(created.userName).toBe("provisioned@example.com");
    expect(created.displayName).toBe("Provisioned Editor");
    expect(created.active).toBe(true);
    expect(created.passwordHash).toBeUndefined();
    expect(filteredResponse.status).toBe(200);
    expect(filtered.totalResults).toBe(1);
    expect(filtered.Resources[0]).toMatchObject({
      id: created.id,
      userName: "provisioned@example.com"
    });
    expect(filtered.Resources[0]?.passwordHash).toBeUndefined();
    expect(disabledResponse.status).toBe(200);
    expect(disabled.active).toBe(false);
    expect(disabled.passwordHash).toBeUndefined();
    expect(reenabledResponse.status).toBe(200);
    expect(reenabled).toMatchObject({
      active: true,
      displayName: "Renamed Editor"
    });
    expect(deletedResponse.status).toBe(200);
    expect(deleted).toMatchObject({
      id: registered.user.id,
      active: false
    });
    expect(afterDeleteMe.status).toBe(401);
  });

  it("locks account login after repeated failures", async () => {
    const url = await startTestServer({
      userAccountSecurityPolicy: {
        passwordMinLength: 10,
        passwordRequireLetter: true,
        passwordRequireNumber: false,
        passwordRequireSymbol: false,
        blockedPasswordTerms: [],
        maxFailedLoginAttempts: 2,
        failedLoginLockoutMs: 60_000
      }
    });
    const registered = await postJson(`${url}/v1/auth/register`, {
      email: "lockout@example.com",
      password: "correct-password",
      name: "Lockout"
    }) as {
      user: {
        passwordHash?: string;
        failedLoginCount?: number;
        lastFailedLoginAt?: string;
        lockedUntil?: string;
      };
    };

    expect(registered.user.passwordHash).toBeUndefined();
    expect(registered.user.failedLoginCount).toBeUndefined();
    expect(registered.user.lastFailedLoginAt).toBeUndefined();
    expect(registered.user.lockedUntil).toBeUndefined();
    expect((await postJsonResponse(`${url}/v1/auth/login`, {
      email: "lockout@example.com",
      password: "wrong-password"
    })).status).toBe(401);
    expect((await postJsonResponse(`${url}/v1/auth/login`, {
      email: "lockout@example.com",
      password: "wrong-password"
    })).status).toBe(401);

    const lockedResponse = await postJsonResponse(`${url}/v1/auth/login`, {
      email: "lockout@example.com",
      password: "correct-password"
    });
    const locked = await lockedResponse.json() as { error: string; lockedUntil?: string };

    expect(lockedResponse.status).toBe(423);
    expect(locked.error).toContain("temporarily locked");
    expect(locked.lockedUntil).toBeTruthy();
  });

  it("requires TOTP MFA for accounts that enable it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T00:00:00.000Z"));
    try {
      const url = await startTestServer({
        userAccountMfaPolicy: {
          enabled: true,
	          issuer: "NovelGameMaker Test",
	          secretEncryptionKey: "test-mfa-encryption-key-at-least-32-bytes",
	          totpStepSeconds: 30,
	          totpWindowSteps: 1,
	          trustedDeviceTtlMs: 30 * 24 * 60 * 60 * 1000,
	          maxTrustedDevices: 10
	        }
      });
	      const registered = await postJson(`${url}/v1/auth/register`, {
	        email: "mfa@example.com",
	        password: "correct-password",
	        name: "MFA Editor"
	      }) as {
	        sessionToken: string;
	        user: { id: string; mfaTotpEnabledAt?: string; mfaTotpSecretEncrypted?: string; mfaTotpLastUsedCounter?: number; mfaRecoveryCodeHashes?: string[]; mfaTrustedDevices?: unknown[] };
	      };
      const setup = await postJson(`${url}/v1/auth/mfa/totp/setup`, {}, {
        authorization: `Bearer ${registered.sessionToken}`
	      }) as {
	        secret: string;
	        otpauthUrl: string;
	        user: { mfaTotpEnabledAt?: string; mfaTotpSecretEncrypted?: string; mfaTotpLastUsedCounter?: number; mfaRecoveryCodeHashes?: string[]; mfaTrustedDevices?: unknown[] };
	      };
      const code = createCurrentTotpCode(setup.secret);
	      const confirmed = await postJson(`${url}/v1/auth/mfa/totp/confirm`, { code }, {
	        authorization: `Bearer ${registered.sessionToken}`
	      }) as {
	        recoveryCodes: string[];
	        user: { mfaTotpEnabledAt?: string; mfaTotpSecretEncrypted?: string; mfaTotpLastUsedCounter?: number; mfaRecoveryCodeHashes?: string[]; mfaTrustedDevices?: unknown[] };
	      };

      const challengeResponse = await postJsonResponse(`${url}/v1/auth/login`, {
        email: "mfa@example.com",
        password: "correct-password"
      });
      const challenge = await challengeResponse.json() as { mfaRequired?: boolean; method?: string };
      const wrongCodeResponse = await postJsonResponse(`${url}/v1/auth/login`, {
        email: "mfa@example.com",
        password: "correct-password",
        mfaCode: "000000"
      });
	      const loginResponse = await postJsonResponse(`${url}/v1/auth/login`, {
	        email: "mfa@example.com",
	        password: "correct-password",
	        mfaCode: code,
	        rememberMfaDevice: true
	      });
	      const loggedIn = await loginResponse.json() as {
	        sessionToken: string;
	        mfaDeviceToken?: string;
	        user: { mfaTotpEnabledAt?: string; mfaTotpSecretEncrypted?: string; mfaTotpLastUsedCounter?: number; mfaRecoveryCodeHashes?: string[]; mfaTrustedDevices?: unknown[] };
	      };
	      const deviceLoginResponse = await postJsonResponse(`${url}/v1/auth/login`, {
	        email: "mfa@example.com",
	        password: "correct-password",
	        mfaDeviceToken: loggedIn.mfaDeviceToken
	      });
	      const deviceLoggedIn = await deviceLoginResponse.json() as {
	        sessionToken: string;
	        user: { mfaTrustedDevices?: unknown[] };
	      };
	      vi.setSystemTime(new Date("2026-06-08T00:00:30.000Z"));
	      const regenerated = await postJson(`${url}/v1/auth/mfa/recovery-codes/regenerate`, {
	        password: "correct-password",
	        code: createCurrentTotpCode(setup.secret)
	      }, {
	        authorization: `Bearer ${loggedIn.sessionToken}`
	      }) as {
	        recoveryCodes: string[];
	        user: { mfaRecoveryCodeHashes?: string[] };
	      };
	      const recoveryLoginResponse = await postJsonResponse(`${url}/v1/auth/login`, {
	        email: "mfa@example.com",
	        password: "correct-password",
	        mfaCode: regenerated.recoveryCodes[0]
	      });
	      const recoveryLoggedIn = await recoveryLoginResponse.json() as {
	        sessionToken: string;
	        user: { mfaRecoveryCodeHashes?: string[] };
	      };
	      const replayRecoveryResponse = await postJsonResponse(`${url}/v1/auth/login`, {
	        email: "mfa@example.com",
	        password: "correct-password",
	        mfaCode: regenerated.recoveryCodes[0]
	      });
	      vi.setSystemTime(new Date("2026-06-08T00:01:00.000Z"));
	      const revokedDevices = await postJson(`${url}/v1/auth/mfa/trusted-devices/revoke`, {
	        password: "correct-password",
	        code: createCurrentTotpCode(setup.secret)
	      }, {
	        authorization: `Bearer ${deviceLoggedIn.sessionToken}`
	      }) as {
	        user: { mfaTrustedDevices?: unknown[] };
	      };
	      const revokedDeviceLoginResponse = await postJsonResponse(`${url}/v1/auth/login`, {
	        email: "mfa@example.com",
	        password: "correct-password",
	        mfaDeviceToken: loggedIn.mfaDeviceToken
	      });
	      vi.setSystemTime(new Date("2026-06-08T00:01:30.000Z"));
	      const disabled = await postJson(`${url}/v1/auth/mfa/totp/disable`, {
	        password: "correct-password",
	        code: createCurrentTotpCode(setup.secret)
	      }, {
	        authorization: `Bearer ${recoveryLoggedIn.sessionToken}`
	      }) as {
	        user: { mfaTotpEnabledAt?: string; mfaTotpSecretEncrypted?: string; mfaTotpLastUsedCounter?: number; mfaRecoveryCodeHashes?: string[]; mfaTrustedDevices?: unknown[] };
	      };

	      expect(registered.user.mfaTotpEnabledAt).toBeUndefined();
	      expect(registered.user.mfaRecoveryCodeHashes).toBeUndefined();
	      expect(registered.user.mfaTrustedDevices).toBeUndefined();
	      expect(setup.otpauthUrl).toContain("otpauth://totp/");
	      expect(setup.user.mfaTotpSecretEncrypted).toBeUndefined();
	      expect(setup.user.mfaTotpLastUsedCounter).toBeUndefined();
	      expect(setup.user.mfaRecoveryCodeHashes).toBeUndefined();
	      expect(setup.user.mfaTrustedDevices).toBeUndefined();
	      expect(confirmed.user.mfaTotpEnabledAt).toBeTruthy();
	      expect(confirmed.user.mfaTotpSecretEncrypted).toBeUndefined();
	      expect(confirmed.user.mfaRecoveryCodeHashes).toBeUndefined();
	      expect(confirmed.user.mfaTrustedDevices).toBeUndefined();
	      expect(confirmed.recoveryCodes).toHaveLength(10);
	      expect(challengeResponse.status).toBe(202);
	      expect(challenge).toEqual(expect.objectContaining({ mfaRequired: true, method: "totp" }));
	      expect(wrongCodeResponse.status).toBe(401);
	      expect(loginResponse.status).toBe(200);
	      expect(loggedIn.sessionToken).toMatch(/^vns_/);
	      expect(loggedIn.mfaDeviceToken).toMatch(/^vnd_/);
	      expect(loggedIn.user.mfaTotpSecretEncrypted).toBeUndefined();
	      expect(loggedIn.user.mfaTotpLastUsedCounter).toBeUndefined();
	      expect(loggedIn.user.mfaRecoveryCodeHashes).toBeUndefined();
	      expect(loggedIn.user.mfaTrustedDevices).toBeUndefined();
	      expect(deviceLoginResponse.status).toBe(200);
	      expect(deviceLoggedIn.sessionToken).toMatch(/^vns_/);
	      expect(deviceLoggedIn.user.mfaTrustedDevices).toBeUndefined();
	      expect(regenerated.recoveryCodes).toHaveLength(10);
	      expect(regenerated.user.mfaRecoveryCodeHashes).toBeUndefined();
	      expect(recoveryLoginResponse.status).toBe(200);
	      expect(recoveryLoggedIn.sessionToken).toMatch(/^vns_/);
	      expect(recoveryLoggedIn.user.mfaRecoveryCodeHashes).toBeUndefined();
	      expect(replayRecoveryResponse.status).toBe(401);
	      expect(revokedDevices.user.mfaTrustedDevices).toBeUndefined();
	      expect(revokedDeviceLoginResponse.status).toBe(202);
	      expect(disabled.user.mfaTotpEnabledAt).toBeUndefined();
	      expect(disabled.user.mfaRecoveryCodeHashes).toBeUndefined();
	      expect(disabled.user.mfaTrustedDevices).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("verifies email and resets passwords through account webhooks", async () => {
    const webhook = await startRecordingWebhook();
    const url = await startTestServer({
      apiAuthToken: "admin-secret",
      userAccountWebhook: {
        url: webhook.url,
        secret: "account-webhook-secret",
        timeoutMs: 1_000,
        emailVerificationBaseUrl: "https://studio.example.com/auth/verify-email",
        passwordResetBaseUrl: "https://studio.example.com/auth/reset-password"
      }
    });

    const registerResponse = await fetch(`${url}/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "editor@example.com",
        password: "correct-password"
      })
    });
    const registered = await registerResponse.json() as {
      sessionToken: string;
      user: { id: string; emailVerifiedAt?: string; passwordHash?: string };
    };
    const verificationCall = webhook.calls.find((call) => call.headers["x-novel-game-maker-event"] === "user_email_verification_requested")!;
    const verificationPayload = JSON.parse(verificationCall.body) as {
      actionToken?: string;
      actionUrl?: string;
      tokenHash?: string;
    };
    const verifyResponse = await fetch(`${url}/v1/auth/verify-email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        verificationToken: verificationPayload.actionToken
      })
    });
    const verified = await verifyResponse.json() as {
      user: { emailVerifiedAt?: string; passwordHash?: string };
    };
    const resetRequestResponse = await fetch(`${url}/v1/auth/password-reset/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "editor@example.com"
      })
    });
    const resetRequest = await resetRequestResponse.json() as { ok: boolean; resetToken?: string };
    const resetCall = webhook.calls.find((call) => call.headers["x-novel-game-maker-event"] === "user_password_reset_requested")!;
    const resetPayload = JSON.parse(resetCall.body) as {
      actionToken?: string;
      actionUrl?: string;
      tokenHash?: string;
    };
    const resetConfirmResponse = await fetch(`${url}/v1/auth/password-reset/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resetToken: resetPayload.actionToken,
        password: "new-password"
      })
    });
    const resetConfirmed = await resetConfirmResponse.json() as {
      user: { passwordUpdatedAt?: string; passwordHash?: string };
    };
    const oldSessionResponse = await fetch(`${url}/v1/auth/me`, {
      headers: { authorization: `Bearer ${registered.sessionToken}` }
    });
    const oldLoginResponse = await fetch(`${url}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "editor@example.com",
        password: "correct-password"
      })
    });
    const newLoginResponse = await fetch(`${url}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "editor@example.com",
        password: "new-password"
      })
    });

    expect(registerResponse.status).toBe(201);
    expect(registered.user.passwordHash).toBeUndefined();
    expect(verificationPayload.actionToken).toMatch(/^vne_/);
    expect(verificationPayload.actionUrl).toBe(
      `https://studio.example.com/auth/verify-email?verificationToken=${encodeURIComponent(verificationPayload.actionToken!)}`
    );
    expect(verificationPayload.tokenHash).toBeUndefined();
    expect(verifyResponse.status).toBe(200);
    expect(verified.user.emailVerifiedAt).toBeTruthy();
    expect(verified.user.passwordHash).toBeUndefined();
    expect(resetRequestResponse.status).toBe(200);
    expect(resetRequest.ok).toBe(true);
    expect(resetRequest.resetToken).toBeUndefined();
    expect(resetPayload.actionToken).toMatch(/^vnr_/);
    expect(resetPayload.actionUrl).toBe(
      `https://studio.example.com/auth/reset-password?resetToken=${encodeURIComponent(resetPayload.actionToken!)}`
    );
    expect(resetPayload.tokenHash).toBeUndefined();
    expect(resetConfirmResponse.status).toBe(200);
    expect(resetConfirmed.user.passwordUpdatedAt).toBeTruthy();
    expect(resetConfirmed.user.passwordHash).toBeUndefined();
    expect(oldSessionResponse.status).toBe(401);
    expect(oldLoginResponse.status).toBe(401);
    expect(newLoginResponse.status).toBe(200);
  });

  it("delivers signed team invitation webhooks with one-time tokens", async () => {
    const webhook = await startRecordingWebhook();
    const url = await startTestServer({
      apiAuthToken: "admin-secret",
      ownerAccessTokens: [
        { ownerId: "team_alpha", token: "owner-alpha-token" }
      ],
      teamInvitationWebhook: {
        url: webhook.url,
        secret: "team-webhook-secret",
        timeoutMs: 1_000,
        acceptBaseUrl: "https://studio.example.com/invitations/accept"
      }
    });
    await postJson(`${url}/v1/teams`, {
      id: "team_alpha",
      name: "Alpha Studio",
      ownerUserId: "user_owner"
    }, { authorization: "Bearer admin-secret" });

    const createResponse = await fetch(`${url}/v1/teams/team_alpha/invitations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer owner-alpha-token"
      },
      body: JSON.stringify({
        email: "editor@example.com",
        role: "viewer"
      })
    });
    const created = await createResponse.json() as {
      invitationToken: string;
      invitation: { id: string; tokenHash?: string };
    };
    const call = webhook.calls[0]!;
    const parsed = JSON.parse(call.body) as {
      event: string;
      invitationId: string;
      invitationToken?: string;
      invitationAcceptUrl?: string;
      tokenHash?: string;
    };
    const timestamp = String(call.headers["x-novel-game-maker-timestamp"]);
    const expectedSignature = createHmac("sha256", "team-webhook-secret")
      .update(`${timestamp}.${call.body}`)
      .digest("hex");

    expect(createResponse.status).toBe(201);
    expect(created.invitation.tokenHash).toBeUndefined();
    expect(webhook.calls).toHaveLength(1);
    expect(parsed.event).toBe("team_invitation_created");
    expect(parsed.invitationId).toBe(created.invitation.id);
    expect(parsed.invitationToken).toBe(created.invitationToken);
    expect(parsed.invitationAcceptUrl).toBe(
      `https://studio.example.com/invitations/accept?invitationToken=${encodeURIComponent(created.invitationToken)}`
    );
    expect(parsed.tokenHash).toBeUndefined();
    expect(call.headers["x-novel-game-maker-event"]).toBe("team_invitation_created");
    expect(call.headers["x-novel-game-maker-signature"]).toBe(`sha256=${expectedSignature}`);
  });

  it("creates, uses, lists, and revokes hashed access tokens", async () => {
    const url = await startTestServer({
      apiAuthToken: "admin-secret"
    });
    const createdResponse = await fetch(`${url}/v1/access-tokens`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer admin-secret"
      },
      body: JSON.stringify({
        role: "owner",
        ownerId: "owner_dynamic",
        label: "Studio dynamic token"
      })
    });
    const created = await createdResponse.json() as {
      token: string;
      accessToken: { id: string; tokenPrefix: string; tokenHash?: string; role: string; ownerId: string };
    };
    const allowed = await fetch(`${url}/v1/projects?ownerId=owner_dynamic`, {
      headers: { authorization: `Bearer ${created.token}` }
    });
    const forbidden = await fetch(`${url}/v1/projects?ownerId=other_owner`, {
      headers: { authorization: `Bearer ${created.token}` }
    });
    const listedResponse = await fetch(`${url}/v1/access-tokens?ownerId=owner_dynamic`, {
      headers: { authorization: `Bearer ${created.token}` }
    });
    const listed = await listedResponse.json() as {
      accessTokens: Array<{ id: string; tokenPrefix: string; tokenHash?: string; token?: string }>;
    };
    const childCreatedResponse = await fetch(`${url}/v1/access-tokens`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${created.token}`
      },
      body: JSON.stringify({
        role: "owner",
        ownerId: "owner_dynamic",
        label: "Studio child token"
      })
    });
    const childCreated = await childCreatedResponse.json() as {
      token: string;
      accessToken: { id: string; tokenPrefix: string; tokenHash?: string; role: string; ownerId: string };
    };
    const childRevokedResponse = await fetch(`${url}/v1/access-tokens/${childCreated.accessToken.id}/revoke`, {
      method: "POST",
      headers: { authorization: `Bearer ${created.token}` }
    });
    const revokedResponse = await fetch(`${url}/v1/access-tokens/${created.accessToken.id}/revoke`, {
      method: "POST",
      headers: { authorization: "Bearer admin-secret" }
    });
    const afterRevoke = await fetch(`${url}/v1/projects?ownerId=owner_dynamic`, {
      headers: { authorization: `Bearer ${created.token}` }
    });

    expect(createdResponse.status).toBe(201);
    expect(created.token).toMatch(/^vn_/);
    expect(created.accessToken.tokenHash).toBeUndefined();
    expect(created.accessToken.tokenPrefix).toBe(created.token.slice(0, 12));
    expect(allowed.status).toBe(200);
    expect(forbidden.status).toBe(403);
    expect(listedResponse.status).toBe(200);
    expect(listed.accessTokens[0]?.id).toBe(created.accessToken.id);
    expect(listed.accessTokens[0]?.tokenHash).toBeUndefined();
    expect(listed.accessTokens[0]?.token).toBeUndefined();
    expect(childCreatedResponse.status).toBe(201);
    expect(childCreated.token).toMatch(/^vn_/);
    expect(childCreated.accessToken.ownerId).toBe("owner_dynamic");
    expect(childCreated.accessToken.tokenHash).toBeUndefined();
    expect(childRevokedResponse.status).toBe(200);
    expect(revokedResponse.status).toBe(200);
    expect(afterRevoke.status).toBe(401);
  });

  it("rejects unsafe production config", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        API_AUTH_TOKEN: "short",
        CORS_ORIGIN: "https://studio.example.com"
      })
    ).toThrow("NODE_ENV=production requires API_AUTH_TOKEN");
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        API_AUTH_TOKEN: "a-secure-production-token",
        CORS_ORIGIN: "*"
      })
    ).toThrow("NODE_ENV=production does not allow CORS_ORIGIN=*");
  });

  it("parses OpenAI-compatible image provider config without exposing secrets", () => {
    const config = loadConfig({
      AI_PROVIDER_ENABLED: "true",
      AI_IMAGE_PROVIDER: "openai-compatible",
      OPENAI_API_KEY: "test-secret-value",
      OPENAI_BASE_URL: "https://api.example.com",
      OPENAI_IMAGE_MODEL: "gpt-image-1"
    });

    expect(config.aiEnabled).toBe(true);
    expect(config.aiImageProvider).toBe("openai-compatible");
    expect(config.openAIImage?.OPENAI_API_KEY).toBe("test-secret-value");
    expect(config.openAIImage?.OPENAI_BASE_URL).toBe("https://api.example.com");
  });

  it("parses OpenAI-compatible text provider config without exposing secrets", () => {
    const config = loadConfig({
      AI_PROVIDER_ENABLED: "true",
      AI_TEXT_PROVIDER: "openai-compatible",
      OPENAI_TEXT_API_KEY: "text-secret-value",
      OPENAI_BASE_URL: "https://api.example.com",
      OPENAI_TEXT_MODEL: "custom-chat-model"
    });

    expect(config.aiEnabled).toBe(true);
    expect(config.aiTextProvider).toBe("openai-compatible");
    expect(config.openAIText?.OPENAI_TEXT_API_KEY).toBe("text-secret-value");
    expect(config.openAIText?.OPENAI_TEXT_MODEL).toBe("custom-chat-model");
  });

  it("parses owner-scoped access tokens", () => {
    const config = loadConfig({
      API_OWNER_TOKENS: "owner_a:token-a,owner_b:token-b"
    });

    expect(config.ownerAccessTokens).toEqual([
      { ownerId: "owner_a", token: "token-a" },
      { ownerId: "owner_b", token: "token-b" }
    ]);
  });

  it("parses user-scoped access tokens", () => {
    const config = loadConfig({
      API_USER_TOKENS: "user_a:token-a,user_b:token-b"
    });

    expect(config.userAccessTokens).toEqual([
      { userId: "user_a", token: "token-a" },
      { userId: "user_b", token: "token-b" }
    ]);
  });

  it("parses public API and player base URLs for publishing", () => {
    const config = loadConfig({
      API_PUBLIC_BASE_URL: "https://api.example.com/",
      PLAYER_BASE_URL: "https://play.example.com/"
    });

    expect(config.apiPublicBaseUrl).toBe("https://api.example.com");
    expect(config.playerBaseUrl).toBe("https://play.example.com");
  });

  it("parses release approval webhook config", () => {
    const config = loadConfig({
      RELEASE_APPROVAL_WEBHOOK_URL: "https://hooks.example.com/release-approvals",
      RELEASE_APPROVAL_WEBHOOK_SECRET: "webhook-secret",
      RELEASE_APPROVAL_WEBHOOK_TIMEOUT_MS: "2500"
    });

    expect(config.releaseApprovalWebhook).toEqual({
      url: "https://hooks.example.com/release-approvals",
      secret: "webhook-secret",
      timeoutMs: 2500
    });
  });

  it("parses API error webhook config", () => {
    const config = loadConfig({
      API_ERROR_WEBHOOK_URL: "https://hooks.example.com/api-errors",
      API_ERROR_WEBHOOK_SECRET: "error-webhook-secret",
      API_ERROR_WEBHOOK_TIMEOUT_MS: "2400"
    });

    expect(config.errorWebhook).toEqual({
      url: "https://hooks.example.com/api-errors",
      secret: "error-webhook-secret",
      timeoutMs: 2400
    });
  });

  it("parses Stripe billing checkout config", () => {
    const config = loadConfig({
      BILLING_CHECKOUT_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: "stripe-secret-value",
      STRIPE_WEBHOOK_SECRET: "stripe-webhook-secret-value",
      STRIPE_PRICE_PRO: "price_pro",
      STRIPE_PRICE_STUDIO: "price_studio",
      STRIPE_API_BASE_URL: "https://stripe.example.com/",
      STRIPE_REQUEST_TIMEOUT_MS: "3500",
      STRIPE_WEBHOOK_TOLERANCE_SECONDS: "120",
      BILLING_PAST_DUE_GRACE_DAYS: "5"
    });

    expect(config.billingCheckoutProvider).toBe("stripe");
    expect(config.stripeBilling).toEqual({
      secretKey: "stripe-secret-value",
      webhookSecret: "stripe-webhook-secret-value",
      priceIds: {
        pro: "price_pro",
        studio: "price_studio"
      },
      apiBaseUrl: "https://stripe.example.com",
      requestTimeoutMs: 3_500,
      webhookToleranceSeconds: 120
    });
    expect(config.billingEntitlementPolicy).toEqual({
      blockPastDue: true,
      pastDueGracePeriodMs: 5 * 24 * 60 * 60 * 1000
    });
  });

  it("parses team invitation webhook config", () => {
    const config = loadConfig({
      TEAM_INVITATION_WEBHOOK_URL: "https://hooks.example.com/team-invitations",
      TEAM_INVITATION_WEBHOOK_SECRET: "team-webhook-secret",
      TEAM_INVITATION_WEBHOOK_TIMEOUT_MS: "2600",
      TEAM_INVITATION_ACCEPT_BASE_URL: "https://studio.example.com/invitations/accept/"
    });

    expect(config.teamInvitationWebhook).toEqual({
      url: "https://hooks.example.com/team-invitations",
      secret: "team-webhook-secret",
      timeoutMs: 2600,
      acceptBaseUrl: "https://studio.example.com/invitations/accept"
    });
  });

  it("parses user account webhook config", () => {
    const config = loadConfig({
      USER_ACCOUNT_WEBHOOK_URL: "https://hooks.example.com/user-accounts",
      USER_ACCOUNT_WEBHOOK_SECRET: "account-webhook-secret",
      USER_ACCOUNT_WEBHOOK_TIMEOUT_MS: "2700",
      EMAIL_VERIFICATION_BASE_URL: "https://studio.example.com/auth/verify-email/",
      PASSWORD_RESET_BASE_URL: "https://studio.example.com/auth/reset-password/"
    });

    expect(config.userAccountWebhook).toEqual({
      url: "https://hooks.example.com/user-accounts",
      secret: "account-webhook-secret",
      timeoutMs: 2700,
      emailVerificationBaseUrl: "https://studio.example.com/auth/verify-email",
      passwordResetBaseUrl: "https://studio.example.com/auth/reset-password"
    });
  });

  it("parses quota, cost, and retry policy config", () => {
    const config = loadConfig({
      API_DAILY_JOB_LIMIT: "10",
      API_DAILY_TEXT_JOB_LIMIT: "4",
      API_DAILY_IMAGE_JOB_LIMIT: "2",
      AI_TEXT_JOB_COST_CENTS: "5",
      AI_IMAGE_JOB_COST_CENTS: "20",
      JOB_MAX_ATTEMPTS: "5",
      JOB_RETRY_DELAY_MS: "1000",
      NOTIFICATION_MAX_ATTEMPTS: "4",
      NOTIFICATION_RETRY_DELAY_MS: "2000"
    });

    expect(config.quotaPolicy).toEqual({
      dailyJobLimit: 10,
      dailyTextJobLimit: 4,
      dailyImageJobLimit: 2
    });
    expect(config.costPolicy).toEqual({
      textJobCostCents: 5,
      imageJobCostCents: 20
    });
    expect(config.retryPolicy).toEqual({
      maxAttempts: 5,
      retryDelayMs: 1000
    });
    expect(config.notificationRetryPolicy).toEqual({
      maxAttempts: 4,
      retryDelayMs: 2000
    });
  });

  it("parses content safety policy config", () => {
    const config = loadConfig({
      CONTENT_SAFETY_ENABLED: "false",
      CONTENT_SAFETY_BLOCK_REVIEW: "true",
      CONTENT_SAFETY_BLOCKED_TERMS: "term_a,term_b",
      CONTENT_SAFETY_REVIEW_TERMS: "term_c"
    });

    expect(config.contentSafetyPolicy).toEqual({
      enabled: false,
      blockOnReview: true,
      blockedTerms: ["term_a", "term_b"],
      reviewTerms: ["term_c"]
    });
  });

  it("parses account security policy config", () => {
    const config = loadConfig({
      AUTH_PASSWORD_MIN_LENGTH: "12",
      AUTH_PASSWORD_REQUIRE_LETTER: "false",
      AUTH_PASSWORD_REQUIRE_NUMBER: "true",
      AUTH_PASSWORD_REQUIRE_SYMBOL: "true",
      AUTH_PASSWORD_BLOCKED_TERMS: "password,qwerty",
      AUTH_MAX_FAILED_LOGIN_ATTEMPTS: "3",
      AUTH_LOGIN_LOCKOUT_MS: "120000"
    });

    expect(config.userAccountSecurityPolicy).toEqual({
      passwordMinLength: 12,
      passwordRequireLetter: false,
      passwordRequireNumber: true,
      passwordRequireSymbol: true,
      blockedPasswordTerms: ["password", "qwerty"],
      maxFailedLoginAttempts: 3,
      failedLoginLockoutMs: 120_000
    });
  });

  it("parses account access policy config", () => {
    const config = loadConfig({
      AUTH_SSO_REQUIRED_EMAIL_DOMAINS: "example.com,@example.org"
    });

    expect(config.userAccountAccessPolicy).toEqual({
      ssoRequiredEmailDomains: ["example.com", "example.org"]
    });
  });

  it("parses MFA policy config and enforces production encryption key", () => {
    const config = loadConfig({
      AUTH_MFA_ENABLED: "true",
	      AUTH_MFA_ISSUER: "Commercial Studio",
	      AUTH_MFA_ENCRYPTION_KEY: "mfa-encryption-key-with-at-least-32-chars",
	      AUTH_MFA_TOTP_STEP_SECONDS: "45",
	      AUTH_MFA_TOTP_WINDOW_STEPS: "2",
	      AUTH_MFA_TRUSTED_DEVICE_TTL_DAYS: "14",
	      AUTH_MFA_MAX_TRUSTED_DEVICES: "6"
	    });

    expect(config.userAccountMfaPolicy).toEqual({
      enabled: true,
      issuer: "Commercial Studio",
	      secretEncryptionKey: "mfa-encryption-key-with-at-least-32-chars",
	      totpStepSeconds: 45,
	      totpWindowSteps: 2,
	      trustedDeviceTtlMs: 14 * 24 * 60 * 60 * 1000,
	      maxTrustedDevices: 6
	    });
    expect(() => loadConfig({
      NODE_ENV: "production",
      API_AUTH_TOKEN: "strong-admin-token-0000000000",
      CORS_ORIGIN: "https://studio.example.com",
      AUTH_MFA_ENABLED: "true",
      AUTH_MFA_ENCRYPTION_KEY: "short"
    })).toThrow("AUTH_MFA_ENCRYPTION_KEY");
  });

  it("parses OAuth SSO config and enforces production OIDC safety", () => {
    const config = loadConfig({
      API_PUBLIC_BASE_URL: "https://api.example.com",
      AUTH_OAUTH_ENABLED: "true",
      AUTH_OAUTH_PROVIDER: "oidc",
      AUTH_OAUTH_REDIRECT_URI: "https://api.example.com/v1/auth/oauth/callback",
      AUTH_OAUTH_ISSUER: "https://idp.example.com",
      AUTH_OAUTH_CLIENT_ID: "novel-game-maker",
      AUTH_OAUTH_CLIENT_SECRET: "oauth-client-secret-000000",
      AUTH_OAUTH_AUTHORIZATION_URL: "https://idp.example.com/oauth2/v1/authorize",
      AUTH_OAUTH_TOKEN_URL: "https://idp.example.com/oauth2/v1/token",
      AUTH_OAUTH_USERINFO_URL: "https://idp.example.com/oauth2/v1/userinfo",
      AUTH_OAUTH_SCOPES: "openid,email,profile",
      AUTH_OAUTH_STATE_TTL_MS: "300000",
      AUTH_OAUTH_ALLOWED_RETURN_ORIGINS: "https://studio.example.com",
      AUTH_OAUTH_ALLOWED_EMAIL_DOMAINS: "example.com,example.org",
      AUTH_OAUTH_REQUIRE_VERIFIED_EMAIL: "true",
      AUTH_OAUTH_GROUP_CLAIM: "groups",
      AUTH_OAUTH_GROUP_ROLE_MAPPINGS: "vn-editors:team_alpha:editor,vn-admins:team_alpha:admin"
    });

    expect(config.oauth).toEqual({
      enabled: true,
      provider: "oidc",
      redirectUri: "https://api.example.com/v1/auth/oauth/callback",
      stateTtlMs: 300_000,
      allowedReturnUrlOrigins: ["https://studio.example.com"],
      requireVerifiedEmail: true,
      allowedEmailDomains: ["example.com", "example.org"],
      groupRoleMappings: [
        { group: "vn-editors", teamId: "team_alpha", role: "editor" },
        { group: "vn-admins", teamId: "team_alpha", role: "admin" }
      ],
      mockAuthorizationBaseUrl: undefined,
      oidc: {
        issuer: "https://idp.example.com",
        clientId: "novel-game-maker",
        clientSecret: "oauth-client-secret-000000",
        authorizationUrl: "https://idp.example.com/oauth2/v1/authorize",
        tokenUrl: "https://idp.example.com/oauth2/v1/token",
        userInfoUrl: "https://idp.example.com/oauth2/v1/userinfo",
        scopes: ["openid", "email", "profile"],
        groupsClaim: "groups",
        requestTimeoutMs: 10_000
      }
    });
    expect(() => loadConfig({
      NODE_ENV: "production",
      API_AUTH_TOKEN: "strong-admin-token-0000000000",
      CORS_ORIGIN: "https://studio.example.com",
      AUTH_OAUTH_ENABLED: "true",
      AUTH_OAUTH_PROVIDER: "mock",
      AUTH_OAUTH_REDIRECT_URI: "http://api.example.com/v1/auth/oauth/callback"
    })).toThrow("AUTH_OAUTH_REDIRECT_URI");
    expect(() => loadConfig({
      NODE_ENV: "production",
      API_AUTH_TOKEN: "strong-admin-token-0000000000",
      CORS_ORIGIN: "https://studio.example.com",
      AUTH_OAUTH_ENABLED: "true",
      AUTH_OAUTH_PROVIDER: "oidc",
      AUTH_OAUTH_REDIRECT_URI: "https://api.example.com/v1/auth/oauth/callback",
      AUTH_OAUTH_CLIENT_ID: "novel-game-maker",
      AUTH_OAUTH_CLIENT_SECRET: "short",
      AUTH_OAUTH_AUTHORIZATION_URL: "https://idp.example.com/authorize",
      AUTH_OAUTH_TOKEN_URL: "https://idp.example.com/token",
      AUTH_OAUTH_USERINFO_URL: "https://idp.example.com/userinfo"
    })).toThrow("AUTH_OAUTH_CLIENT_SECRET");
    expect(() => loadConfig({
      NODE_ENV: "production",
      API_AUTH_TOKEN: "strong-admin-token-0000000000",
      CORS_ORIGIN: "https://studio.example.com",
      AUTH_SSO_REQUIRED_EMAIL_DOMAINS: "example.com"
    })).toThrow("AUTH_SSO_REQUIRED_EMAIL_DOMAINS");
  });

  it("parses SCIM config and enforces production token safety", () => {
    const config = loadConfig({
      SCIM_ENABLED: "true",
      SCIM_BEARER_TOKEN: "scim-token-strong-000000",
      SCIM_BASE_URL: "https://api.example.com/v1/scim/v2/"
    });

    expect(config.scim).toEqual({
      enabled: true,
      bearerToken: "scim-token-strong-000000",
      baseUrl: "https://api.example.com/v1/scim/v2"
    });
    expect(loadConfig({}).scim).toEqual({
      enabled: false,
      bearerToken: undefined,
      baseUrl: undefined
    });
    expect(() => loadConfig({
      NODE_ENV: "production",
      API_AUTH_TOKEN: "strong-admin-token-0000000000",
      CORS_ORIGIN: "https://studio.example.com",
      SCIM_ENABLED: "true",
      SCIM_BEARER_TOKEN: "short"
    })).toThrow("SCIM_BEARER_TOKEN");
    expect(() => loadConfig({
      NODE_ENV: "production",
      API_AUTH_TOKEN: "strong-admin-token-0000000000",
      CORS_ORIGIN: "https://studio.example.com",
      SCIM_ENABLED: "true",
      SCIM_BEARER_TOKEN: "scim-token-strong-000000",
      SCIM_BASE_URL: "http://api.example.com/v1/scim/v2"
    })).toThrow("SCIM_BASE_URL");
  });

  it("keeps metrics private unless explicitly configured public", () => {
    expect(loadConfig({}).metricsPublic).toBe(false);
    expect(loadConfig({ API_METRICS_PUBLIC: "true" }).metricsPublic).toBe(true);
  });

  it("rate limits repeated requests by client key", async () => {
    const url = await startTestServer({
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 1
    });

    expect((await fetch(`${url}/health`, { headers: { "x-forwarded-for": "203.0.113.10" } })).status).toBe(200);
    expect((await fetch(`${url}/health`, { headers: { "x-forwarded-for": "203.0.113.10" } })).status).toBe(429);
    expect((await fetch(`${url}/health`, { headers: { "x-forwarded-for": "203.0.113.11" } })).status).toBe(200);
  });

  it("creates and reads a project from novel text", async () => {
    const url = await startTestServer();
    const created = await postJson(`${url}/v1/projects/from-novel`, {
      ownerId: "owner_test",
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    }) as { project: { id: string; title: string; vnProject: { chapters: unknown[] } } };
    const fetched = await (await fetch(`${url}/v1/projects/${created.project.id}`)).json() as {
      project: { id: string; title: string };
    };

    expect(created.project.title).toBe("实验室里的蓝光");
    expect(created.project.vnProject.chapters.length).toBeGreaterThan(0);
    expect(fetched.project.id).toBe(created.project.id);
  });

  it("persists an edited VNProject through the project save endpoint", async () => {
    const url = await startTestServer();
    const created = await postJson(`${url}/v1/projects/from-novel`, {
      ownerId: "owner_test",
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    }) as { project: { id: string; vnProject: { title: string } } };
    created.project.vnProject.title = "云端保存后的标题";

    const saved = await postJson(`${url}/v1/projects`, {
      id: created.project.id,
      ownerId: "owner_test",
      title: "云端保存后的标题",
      vnProject: created.project.vnProject
    }) as { project: { id: string; title: string; vnProject: { title: string } } };

    expect(saved.project.id).toBe(created.project.id);
    expect(saved.project.title).toBe("云端保存后的标题");
    expect(saved.project.vnProject.title).toBe("云端保存后的标题");
  });

  it("publishes a project JSON for the standalone Player", async () => {
    const url = await startTestServer({
      apiAuthToken: "admin-secret",
      apiPublicBaseUrl: "https://api.example.com",
      playerBaseUrl: "https://play.example.com"
    });
    const created = await postJson(`${url}/v1/projects/from-novel`, {
      ownerId: "owner_test",
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    }, { authorization: "Bearer admin-secret" }) as { project: { id: string } };
    const publishedResponse = await fetch(`${url}/v1/projects/${created.project.id}/publish`, {
      method: "POST",
      headers: { authorization: "Bearer admin-secret" }
    });
    const published = await publishedResponse.json() as {
      projectUrl: string;
      playableUrl?: string;
      currentProjectUrl?: string;
      currentPlayableUrl?: string;
      project: { publishedAt?: string; currentReleaseId?: string };
      release: { id: string; version: number };
      deploymentInvalidation?: { status: string; provider: string; urls: string[] };
      projectJsonAsset: { assetId: string; publicUrl: string };
      publishedProject: { assets: { items: Array<{ src: string }> } };
    };
    const secondPublished = await (await fetch(`${url}/v1/projects/${created.project.id}/publish`, {
      method: "POST",
      headers: { authorization: "Bearer admin-secret" }
    })).json() as {
      release: { id: string; version: number };
    };
    const releasesResponse = await fetch(`${url}/v1/projects/${created.project.id}/releases`, {
      headers: { authorization: "Bearer admin-secret" }
    });
    const releases = await releasesResponse.json() as { releases: Array<{ id: string; version: number }> };
    const invalidationsResponse = await fetch(`${url}/v1/projects/${created.project.id}/deployment-invalidations`, {
      headers: { authorization: "Bearer admin-secret" }
    });
    const invalidations = await invalidationsResponse.json() as {
      invalidations: Array<{ status: string; reason: string; urls: string[] }>;
    };
    const rollbackResponse = await fetch(`${url}/v1/projects/${created.project.id}/rollback`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer admin-secret"
      },
      body: JSON.stringify({ releaseId: published.release.id })
    });
    const rollback = await rollbackResponse.json() as {
      project: { currentReleaseId?: string };
      release: { id: string; version: number };
    };
    const expectedCurrentProjectUrl = `https://api.example.com/v1/public/projects/${encodeURIComponent(created.project.id)}/project.vn.json`;

    expect(publishedResponse.status).toBe(200);
    expect(published.projectUrl).toContain("https://api.example.com/assets/");
    expect(published.playableUrl).toBe(`https://play.example.com/?projectUrl=${encodeURIComponent(published.projectUrl)}`);
    expect(published.currentProjectUrl).toBe(expectedCurrentProjectUrl);
    expect(published.currentPlayableUrl).toBe(`https://play.example.com/?projectUrl=${encodeURIComponent(expectedCurrentProjectUrl)}`);
    expect(published.deploymentInvalidation?.status).toBe("skipped");
    expect(published.deploymentInvalidation?.urls).toContain(expectedCurrentProjectUrl);
    expect(published.project.publishedAt).toBeTruthy();
    expect(published.release.version).toBe(1);
    expect(secondPublished.release.version).toBe(2);
    expect(releasesResponse.status).toBe(200);
    expect(releases.releases.map((release) => release.version)).toEqual([2, 1]);
    expect(invalidationsResponse.status).toBe(200);
    expect(invalidations.invalidations.map((record) => record.reason)).toContain("publish");
    expect(rollbackResponse.status).toBe(200);
    expect(rollback.project.currentReleaseId).toBe(published.release.id);
    expect(rollback.release.version).toBe(1);
    expect(published.projectJsonAsset.assetId).toBe("published_project_json");
    expect(published.publishedProject.assets.items.every((asset) => asset.src.startsWith("https://api.example.com/assets/"))).toBe(true);
  });

  it("serves the current published project JSON through a stable public route", async () => {
    const url = await startTestServer({
      apiAuthToken: "admin-secret"
    });
    const created = await postJson(`${url}/v1/projects/from-novel`, {
      ownerId: "owner_test",
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    }, { authorization: "Bearer admin-secret" }) as { project: { id: string } };
    await fetch(`${url}/v1/projects/${created.project.id}/publish`, {
      method: "POST",
      headers: { authorization: "Bearer admin-secret" }
    });

    const publicResponse = await fetch(`${url}/v1/public/projects/${created.project.id}/project.vn.json`);
    const publicProject = await publicResponse.json() as { title: string };

    expect(publicResponse.status).toBe(200);
    expect(publicProject.title).toBe("实验室里的蓝光");
  });

  it("requires approval before publishing when release approval is enabled", async () => {
    const url = await startTestServer({
      apiAuthToken: "admin-secret",
      userAccessTokens: [
        { userId: "user_editor", token: "editor-token" }
      ],
      releaseApprovalRequired: true,
      releaseApprovalWebhook: {
        url: "http://127.0.0.1:1/release-approval-webhook",
        timeoutMs: 200
      },
      notificationRetryPolicy: {
        maxAttempts: 1,
        retryDelayMs: 1
      },
      apiPublicBaseUrl: "https://api.example.com",
      playerBaseUrl: "https://play.example.com"
    });
    await postJson(`${url}/v1/teams`, {
      id: "team_alpha",
      name: "Alpha Studio",
      ownerUserId: "user_owner"
    }, { authorization: "Bearer admin-secret" });
    await postJson(`${url}/v1/teams/team_alpha/members`, {
      userId: "user_editor",
      role: "editor"
    }, { authorization: "Bearer admin-secret" });
    const created = await postJson(`${url}/v1/projects/from-novel`, {
      ownerId: "team_alpha",
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    }, { authorization: "Bearer editor-token" }) as { project: { id: string } };

    const directPublish = await fetch(`${url}/v1/projects/${created.project.id}/publish`, {
      method: "POST",
      headers: { authorization: "Bearer editor-token" }
    });
    const requestedResponse = await fetch(`${url}/v1/projects/${created.project.id}/release-approvals`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer editor-token"
      },
      body: JSON.stringify({ notes: "Ready for review" })
    });
    const requested = await requestedResponse.json() as {
      approval: { id: string; status: string; requestedBy: string; notes?: string };
    };
    const listedResponse = await fetch(`${url}/v1/projects/${created.project.id}/release-approvals`, {
      headers: { authorization: "Bearer editor-token" }
    });
    const listed = await listedResponse.json() as { approvals: Array<{ id: string; status: string }> };
    const commentResponse = await fetch(`${url}/v1/release-approvals/${requested.approval.id}/comments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer editor-token"
      },
      body: JSON.stringify({ body: "请确认第一幕 CG。" })
    });
    const comment = await commentResponse.json() as {
      comment: { id: string; approvalId: string; author: string; body: string };
    };
    const blankCommentResponse = await fetch(`${url}/v1/release-approvals/${requested.approval.id}/comments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer editor-token"
      },
      body: JSON.stringify({ body: "   " })
    });
    const commentsResponse = await fetch(`${url}/v1/release-approvals/${requested.approval.id}/comments`, {
      headers: { authorization: "Bearer editor-token" }
    });
    const comments = await commentsResponse.json() as {
      comments: Array<{ id: string; body: string }>;
    };
    const approvedResponse = await fetch(`${url}/v1/release-approvals/${requested.approval.id}/approve`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer admin-secret"
      },
      body: JSON.stringify({ reviewNotes: "Approved" })
    });
    const approved = await approvedResponse.json() as {
      approval: { status: string; publishedReleaseId?: string };
      published: { release: { id: string; version: number }; currentPlayableUrl?: string };
    };
    const deliveriesResponse = await fetch(`${url}/v1/notification-deliveries?ownerId=team_alpha`, {
      headers: { authorization: "Bearer admin-secret" }
    });
    const deliveries = await deliveriesResponse.json() as {
      deliveries: Array<{ id: string; event: string; status: string; attempts: number }>;
    };
    const runDeliveryResponse = await fetch(`${url}/v1/notification-deliveries/run-next`, {
      method: "POST",
      headers: { authorization: "Bearer admin-secret" }
    });
    const runDelivery = await runDeliveryResponse.json() as {
      delivery?: { id: string; status: string; attempts: number; error?: string };
    };

    expect(directPublish.status).toBe(403);
    expect(requestedResponse.status).toBe(201);
    expect(requested.approval.status).toBe("pending");
    expect(requested.approval.requestedBy).toBe("user:user_editor");
    expect(requested.approval.notes).toBe("Ready for review");
    expect(listedResponse.status).toBe(200);
    expect(listed.approvals[0]?.id).toBe(requested.approval.id);
    expect(commentResponse.status).toBe(201);
    expect(comment.comment.approvalId).toBe(requested.approval.id);
    expect(comment.comment.author).toBe("user:user_editor");
    expect(comment.comment.body).toBe("请确认第一幕 CG。");
    expect(blankCommentResponse.status).toBe(400);
    expect(commentsResponse.status).toBe(200);
    expect(comments.comments.map((item) => item.id)).toContain(comment.comment.id);
    expect(approvedResponse.status).toBe(200);
    expect(approved.approval.status).toBe("published");
    expect(approved.approval.publishedReleaseId).toBe(approved.published.release.id);
    expect(approved.published.release.version).toBe(1);
    expect(approved.published.currentPlayableUrl).toContain("https://play.example.com/?projectUrl=");
    expect(deliveriesResponse.status).toBe(200);
    expect(deliveries.deliveries.map((delivery) => delivery.event)).toEqual(expect.arrayContaining([
      "release_approval_requested",
      "release_approval_commented",
      "release_approval_published"
    ]));
    expect(runDeliveryResponse.status).toBe(200);
    expect(runDelivery.delivery?.status).toBe("failed");
    expect(runDelivery.delivery?.attempts).toBe(1);
  });

  it("returns release diffs and rejects stale release approvals", async () => {
    const url = await startTestServer({
      apiPublicBaseUrl: "https://api.example.com",
      playerBaseUrl: "https://play.example.com"
    });
    const created = await postJson(`${url}/v1/projects/from-novel`, {
      ownerId: "owner_test",
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    }) as {
      project: {
        id: string;
        ownerId: string;
        title: string;
        vnProject: VNProject;
      };
    };
    const publishedResponse = await fetch(`${url}/v1/projects/${created.project.id}/publish`, {
      method: "POST"
    });
    const unchangedDiffResponse = await fetch(`${url}/v1/projects/${created.project.id}/release-diff`);
    const unchangedDiff = await unchangedDiffResponse.json() as {
      diff: { changed: boolean; baseRelease?: { version: number }; totals: { changedBeats: number } };
    };
    const editedProject = updateFirstBeat(created.project.vnProject, "实验室里的蓝光变得刺眼。");
    await postJson(`${url}/v1/projects`, {
      id: created.project.id,
      ownerId: created.project.ownerId,
      title: created.project.title,
      vnProject: editedProject
    });
    const changedDiffResponse = await fetch(`${url}/v1/projects/${created.project.id}/release-diff`);
    const changedDiff = await changedDiffResponse.json() as {
      diff: { changed: boolean; totals: { changedBeats: number }; beatChanges: Array<{ current?: string }> };
    };
    const requested = await postJson(`${url}/v1/projects/${created.project.id}/release-approvals`, {
      notes: "Review changed text"
    }) as { approval: { id: string } };
    await postJson(`${url}/v1/projects`, {
      id: created.project.id,
      ownerId: created.project.ownerId,
      title: created.project.title,
      vnProject: updateFirstBeat(editedProject, "实验室里只剩下陌生的红光。")
    });
    const staleApproveResponse = await fetch(`${url}/v1/release-approvals/${requested.approval.id}/approve`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ reviewNotes: "Approve stale" })
    });
    await postJson(`${url}/v1/projects/${created.project.id}/release-approvals`, {
      notes: "Review latest text"
    });
    const approvedResponse = await fetch(`${url}/v1/release-approvals/${requested.approval.id}/approve`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ reviewNotes: "Approve latest" })
    });
    const approved = await approvedResponse.json() as { published: { release: { version: number } } };

    expect(publishedResponse.status).toBe(200);
    expect(unchangedDiffResponse.status).toBe(200);
    expect(unchangedDiff.diff.changed).toBe(false);
    expect(unchangedDiff.diff.baseRelease?.version).toBe(1);
    expect(unchangedDiff.diff.totals.changedBeats).toBe(0);
    expect(changedDiffResponse.status).toBe(200);
    expect(changedDiff.diff.changed).toBe(true);
    expect(changedDiff.diff.totals.changedBeats).toBe(1);
    expect(changedDiff.diff.beatChanges[0]?.current).toContain("刺眼");
    expect(staleApproveResponse.status).toBe(409);
    expect(approvedResponse.status).toBe(200);
    expect(approved.published.release.version).toBe(2);
  });

  it("queues and runs a novel generation job", async () => {
    const url = await startTestServer();
    const created = await postJson(`${url}/v1/jobs`, {
      ownerId: "owner_test",
      kind: "novel_to_project",
      input: {
        title: "实验室里的蓝光",
        novelText: sampleNovelText
      }
    }) as { job: { id: string; status: string } };
    const completed = await postJson(`${url}/v1/jobs/${created.job.id}/run`, {}) as {
      job: { status: string; output?: { projectId?: string } };
    };

    expect(created.job.status).toBe("queued");
    expect(completed.job.status).toBe("succeeded");
    expect(completed.job.output?.projectId).toMatch(/^project_/);
  });

  it("returns usage and audit data for the scoped owner", async () => {
    const url = await startTestServer({
      apiAuthToken: "admin-secret",
      ownerAccessTokens: [
        { ownerId: "owner_test", token: "owner-token" },
        { ownerId: "other_owner", token: "other-token" }
      ],
      costPolicy: {
        textJobCostCents: 6,
        imageJobCostCents: 18
      }
    });
    const created = await postJson(`${url}/v1/jobs`, {
      ownerId: "owner_test",
      kind: "novel_to_project",
      input: {
        title: "实验室里的蓝光",
        novelText: sampleNovelText
      }
    }, { authorization: "Bearer owner-token" }) as { job: { id: string } };
    await postJson(`${url}/v1/jobs/${created.job.id}/run`, {}, { authorization: "Bearer owner-token" });

    const usageResponse = await fetch(`${url}/v1/usage?ownerId=owner_test`, {
      headers: { authorization: "Bearer owner-token" }
    });
    const usage = await usageResponse.json() as {
      usage: { jobEnqueued: number; textJobEnqueued: number; jobSucceeded: number; estimatedCostCents: number };
      events: Array<{ metric: string }>;
    };
    const auditResponse = await fetch(`${url}/v1/audit?ownerId=owner_test&limit=10`, {
      headers: { authorization: "Bearer owner-token" }
    });
    const audit = await auditResponse.json() as { events: Array<{ action: string }> };
    const forbidden = await fetch(`${url}/v1/usage?ownerId=other_owner`, {
      headers: { authorization: "Bearer owner-token" }
    });

    expect(usageResponse.status).toBe(200);
    expect(usage.usage.jobEnqueued).toBe(1);
    expect(usage.usage.textJobEnqueued).toBe(1);
    expect(usage.usage.jobSucceeded).toBe(1);
    expect(usage.usage.estimatedCostCents).toBe(6);
    expect(usage.events.map((event) => event.metric)).toContain("estimated_cost_cents");
    expect(auditResponse.status).toBe(200);
    expect(audit.events.map((event) => event.action)).toContain("job_succeeded");
    expect(forbidden.status).toBe(403);
  });

  it("returns owner operations summary for production monitoring", async () => {
    const url = await startTestServer({
      apiAuthToken: "admin-secret",
      ownerAccessTokens: [
        { ownerId: "owner_test", token: "owner-token" },
        { ownerId: "other_owner", token: "other-token" }
      ]
    });
    await postJson(`${url}/v1/jobs`, {
      ownerId: "owner_test",
      kind: "novel_to_project",
      input: {
        title: "Queued operations job",
        novelText: sampleNovelText
      }
    }, { authorization: "Bearer owner-token" });
    const blockedResponse = await fetch(`${url}/v1/jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer owner-token"
      },
      body: JSON.stringify({
        ownerId: "owner_test",
        kind: "novel_to_project",
        input: {
          title: "Blocked operations job",
          novelText: "BLOCKED_CONTENT"
        }
      })
    });
    const summaryResponse = await fetch(`${url}/v1/ops/summary?ownerId=owner_test`, {
      headers: { authorization: "Bearer owner-token" }
    });
    const summaryBody = await summaryResponse.json() as {
      summary: {
        status: string;
        counts: {
          jobs: { queued: number };
          contentSafety: { blocked: number };
        };
        incidents: Array<{ source: string; severity: string }>;
      };
    };
    const forbidden = await fetch(`${url}/v1/ops/summary?ownerId=other_owner`, {
      headers: { authorization: "Bearer owner-token" }
    });

    expect(blockedResponse.status).toBe(422);
    expect(summaryResponse.status).toBe(200);
    expect(summaryBody.summary.status).toBe("critical");
    expect(summaryBody.summary.counts.jobs.queued).toBe(1);
    expect(summaryBody.summary.counts.contentSafety.blocked).toBe(1);
    expect(summaryBody.summary.incidents).toContainEqual(expect.objectContaining({
      source: "content_safety",
      severity: "critical"
    }));
    expect(forbidden.status).toBe(403);
  });

  it("returns 429 when the daily generation quota is exceeded", async () => {
    const url = await startTestServer({
      quotaPolicy: {
        dailyJobLimit: 1,
        dailyTextJobLimit: 0,
        dailyImageJobLimit: 0
      }
    });
    expect((await postJson(`${url}/v1/jobs`, {
      ownerId: "owner_test",
      kind: "novel_to_project",
      input: {
        title: "第一次",
        novelText: sampleNovelText
      }
    }) as { job: { status: string } }).job.status).toBe("queued");

    const response = await fetch(`${url}/v1/jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ownerId: "owner_test",
        kind: "novel_to_project",
        input: {
          title: "第二次",
          novelText: sampleNovelText
        }
      })
    });
    const body = await response.json() as { error: string };

    expect(response.status).toBe(429);
    expect(body.error).toBe("Daily job quota exceeded.");
  });

  it("blocks unsafe imported novel text and exposes content safety reviews", async () => {
    const url = await startTestServer();
    const response = await fetch(`${url}/v1/projects/from-novel`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ownerId: "owner_test",
        title: "内容审核测试",
        novelText: "BLOCKED_CONTENT"
      })
    });
    const body = await response.json() as {
      error: string;
      review?: { id: string; decision: string; matchedRules: string[] };
    };
    const reviewsResponse = await fetch(`${url}/v1/content-safety?ownerId=owner_test`);
    const reviews = await reviewsResponse.json() as {
      reviews: Array<{ id: string; source: string; decision: string; matchedRules: string[]; inputHash: string }>;
    };

    expect(response.status).toBe(422);
    expect(body.error).toBe("Content safety review blocked this request.");
    expect(body.review?.decision).toBe("blocked");
    expect(body.review?.matchedRules).toEqual(["blocked:BLOCKED_CONTENT"]);
    expect(reviewsResponse.status).toBe(200);
    expect(reviews.reviews[0]?.id).toBe(body.review?.id);
    expect(reviews.reviews[0]?.source).toBe("novel_text");
    expect(reviews.reviews[0]?.inputHash).toMatch(/^[a-f0-9]{64}$/);

    const manualReviewResponse = await fetch(`${url}/v1/content-safety/review`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ownerId: "owner_test",
        source: "project_json",
        text: JSON.stringify({ title: "REVIEW_CONTENT" }),
        targetType: "project",
        targetId: "project_safety_1",
        metadata: {
          title: "内容复核测试"
        }
      })
    });
    const manualReview = await manualReviewResponse.json() as {
      review: { id: string; source: string; decision: string; matchedRules: string[]; inputHash: string };
    };
    const reviewsAfterManualResponse = await fetch(`${url}/v1/content-safety?ownerId=owner_test`);
    const reviewsAfterManual = await reviewsAfterManualResponse.json() as {
      reviews: Array<{ id: string; source: string; decision: string; matchedRules: string[]; inputHash: string }>;
    };

    expect(manualReviewResponse.status).toBe(201);
    expect(manualReview.review.source).toBe("project_json");
    expect(manualReview.review.decision).toBe("review_required");
    expect(manualReview.review.matchedRules).toEqual(["review:REVIEW_CONTENT"]);
    expect(manualReview.review.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(reviewsAfterManualResponse.status).toBe(200);
    expect(reviewsAfterManual.reviews.some((review) => review.id === manualReview.review.id)).toBe(true);
  });

  it("runs an OpenAI-compatible text generation job and saves the generated VNProject", async () => {
    const generatedProject = createProjectFromNovel({
      title: "AI 生成视觉小说",
      novelText: sampleNovelText
    });
    generatedProject.title = "AI 生成视觉小说";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://api.example.com/v1/chat/completions") {
        const body = JSON.parse(String(init?.body)) as { response_format?: { type?: string }; messages?: Array<{ content?: string }> };
        expect(body.response_format?.type).toBe("json_object");
        expect(body.messages?.[1]?.content).toContain("Baseline valid VNProject JSON");
        return new Response(JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify(generatedProject)
              }
            }
          ]
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const url = await startTestServer({
        aiEnabled: true,
        aiTextProvider: "openai-compatible",
        openAIText: {
          OPENAI_TEXT_API_KEY: "text-secret",
          OPENAI_BASE_URL: "https://api.example.com",
          OPENAI_TEXT_MODEL: "custom-chat-model"
        }
      });
      const created = await postJson(`${url}/v1/jobs`, {
        ownerId: "owner_test",
        kind: "novel_to_project",
        input: {
          title: "实验室里的蓝光",
          novelText: sampleNovelText
        }
      }) as { job: { id: string; status: string } };
      const completed = await postJson(`${url}/v1/jobs/${created.job.id}/run`, {}) as {
        job: { status: string; output?: { projectId?: string; title?: string } };
      };
      const fetched = await (await fetch(`${url}/v1/projects/${completed.job.output?.projectId}`)).json() as {
        project: { title: string; vnProject: { title: string } };
      };

      expect(completed.job.status).toBe("succeeded");
      expect(completed.job.output?.title).toBe("AI 生成视觉小说");
      expect(fetched.project.title).toBe("AI 生成视觉小说");
      expect(fetched.project.vnProject.title).toBe("AI 生成视觉小说");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("runs an OpenAI-compatible image generation job and stores the asset", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://api.example.com/v1/images/generations") {
        const body = JSON.parse(String(init?.body)) as { prompt?: string };
        expect(body.prompt).toBe("phone screen close-up");
        return new Response(JSON.stringify({
          data: [
            {
              b64_json: Buffer.from("generated-image").toString("base64"),
              revised_prompt: "revised phone prompt"
            }
          ]
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const url = await startTestServer({
        aiEnabled: true,
        aiImageProvider: "openai-compatible",
        openAIImage: {
          OPENAI_API_KEY: "test-secret",
          OPENAI_BASE_URL: "https://api.example.com",
          OPENAI_IMAGE_RESPONSE_FORMAT: "b64_json"
        }
      });
      const createdProject = await postJson(`${url}/v1/projects/from-novel`, {
        ownerId: "owner_test",
        title: "实验室里的蓝光",
        novelText: sampleNovelText
      }) as { project: { id: string } };
      const job = await postJson(`${url}/v1/jobs`, {
        ownerId: "owner_test",
        projectId: createdProject.project.id,
        kind: "asset_generation",
        input: {
          assetId: "cg_phone_screen",
          kind: "cg",
          title: "手机屏幕亮起",
          prompt: "phone screen close-up"
        }
      }) as { job: { id: string } };
      const completed = await postJson(`${url}/v1/jobs/${job.job.id}/run`, {}) as {
        job: { status: string; output?: { provider?: string; publicUrl?: string; revisedPrompt?: string } };
      };
      const listed = await (await fetch(`${url}/v1/projects/${createdProject.project.id}/assets`)).json() as {
        assets: Array<{ assetId: string; byteLength: number }>;
      };

      expect(completed.job.status).toBe("succeeded");
      expect(completed.job.output?.provider).toBe("openai-compatible-images");
      expect(completed.job.output?.publicUrl).toContain("cg_phone_screen");
      expect(completed.job.output?.revisedPrompt).toBe("revised phone prompt");
      expect(listed.assets[0]?.assetId).toBe("cg_phone_screen");
      expect(listed.assets[0]?.byteLength).toBe("generated-image".length);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("stores and lists project assets through the API", async () => {
    const url = await startTestServer();
    const created = await postJson(`${url}/v1/projects/from-novel`, {
      ownerId: "owner_test",
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    }) as { project: { id: string } };
    const uploaded = await postJson(`${url}/v1/assets`, {
      ownerId: "owner_test",
      projectId: created.project.id,
      assetId: "cg_phone_screen",
      fileName: "phone.svg",
      contentType: "image/svg+xml",
      base64: Buffer.from("<svg />").toString("base64")
    }) as { asset: { id: string; publicUrl?: string } };
    const listed = await (await fetch(`${url}/v1/projects/${created.project.id}/assets`)).json() as {
      assets: Array<{ id: string; assetId: string }>;
    };

    expect(uploaded.asset.id).toMatch(/^asset_/);
    expect(uploaded.asset.publicUrl).toContain("cg_phone_screen");
    expect(listed.assets[0]?.assetId).toBe("cg_phone_screen");
  });

  it("serves local stored assets by public URL", async () => {
    const url = await startTestServer({ apiAuthToken: "secret" });
    const project = await postJson(`${url}/v1/projects/from-novel`, {
      ownerId: "owner_test",
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    }, { authorization: "Bearer secret" }) as { project: { id: string } };
    const uploaded = await postJson(`${url}/v1/assets`, {
      ownerId: "owner_test",
      projectId: project.project.id,
      assetId: "cg_phone_screen",
      fileName: "phone.svg",
      contentType: "image/svg+xml",
      base64: Buffer.from("<svg />").toString("base64")
    }, { authorization: "Bearer secret" }) as { asset: { publicUrl: string } };

    const response = await fetch(`${url}${uploaded.asset.publicUrl}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(await response.text()).toBe("<svg />");
  });

  it("rejects invalid base64 asset uploads as a client error", async () => {
    const url = await startTestServer();
    const project = await postJson(`${url}/v1/projects/from-novel`, {
      ownerId: "owner_test",
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    }) as { project: { id: string } };
    const response = await fetch(`${url}/v1/assets`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ownerId: "owner_test",
        projectId: project.project.id,
        assetId: "cg_phone_screen",
        fileName: "phone.svg",
        contentType: "image/svg+xml",
        base64: "not-base64!"
      })
    });
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid base64 payload.");
  });

  it("supports billing plans, checkout, subscription activation, and cancellation", async () => {
    const url = await startTestServer({
      apiAuthToken: "admin-secret",
      ownerAccessTokens: [
        { ownerId: "owner_test", token: "owner-token" }
      ]
    });

    const plansResponse = await fetch(`${url}/v1/billing/plans`, {
      headers: { authorization: "Bearer owner-token" }
    });
    const plansBody = await plansResponse.json() as { plans: Array<{ id: string }> };
    const checkoutBody = await postJson(`${url}/v1/billing/checkout`, {
      ownerId: "owner_test",
      planId: "pro",
      successUrl: "https://studio.example.com/billing/success",
      cancelUrl: "https://studio.example.com/billing/cancel"
    }, { authorization: "Bearer owner-token" }) as {
      checkoutSession: { id: string; status: string; checkoutUrl: string };
    };
    const ownerComplete = await postJsonResponse(
      `${url}/v1/billing/checkout-sessions/${checkoutBody.checkoutSession.id}/complete`,
      {},
      { authorization: "Bearer owner-token" }
    );
    const completed = await postJson(
      `${url}/v1/billing/checkout-sessions/${checkoutBody.checkoutSession.id}/complete`,
      {},
      { authorization: "Bearer admin-secret" }
    ) as {
      session: { status: string };
      subscription: { planId: string; status: string };
    };
    const subscriptionResponse = await fetch(`${url}/v1/billing/subscription?ownerId=owner_test`, {
      headers: { authorization: "Bearer owner-token" }
    });
    const subscriptionBody = await subscriptionResponse.json() as {
      subscription: { planId: string; status: string };
    };
    const sessionsResponse = await fetch(`${url}/v1/billing/checkout-sessions?ownerId=owner_test`, {
      headers: { authorization: "Bearer owner-token" }
    });
    const sessionsBody = await sessionsResponse.json() as { checkoutSessions: Array<{ id: string }> };
    const cancelled = await postJson(`${url}/v1/billing/subscription/cancel`, {
      ownerId: "owner_test"
    }, { authorization: "Bearer owner-token" }) as {
      subscription: { status: string };
    };

    expect(plansResponse.status).toBe(200);
    expect(plansBody.plans.map((plan) => plan.id)).toEqual(["free", "pro", "studio"]);
    expect(checkoutBody.checkoutSession.status).toBe("created");
    expect(checkoutBody.checkoutSession.checkoutUrl).toContain("https://billing.local/checkout/");
    expect(ownerComplete.status).toBe(403);
    expect(completed.session.status).toBe("completed");
    expect(completed.subscription.planId).toBe("pro");
    expect(subscriptionResponse.status).toBe(200);
    expect(subscriptionBody.subscription.status).toBe("active");
    expect(sessionsResponse.status).toBe(200);
    expect(sessionsBody.checkoutSessions[0]?.id).toBe(checkoutBody.checkoutSession.id);
    expect(cancelled.subscription.status).toBe("cancelled");
  });

  it("activates and cancels billing subscriptions from signed Stripe webhooks", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "vn-api-stripe-platform-"));
    const platform = createPlatform({
      dataDir,
      billingEntitlementPolicy: {
        blockPastDue: true,
        pastDueGracePeriodMs: 0
      },
      billingCheckoutProvider: {
        id: "stripe",
        async createCheckoutSession() {
          return {
            checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
            externalSessionId: "cs_test_123",
            expiresAt: "2027-01-15T08:00:00.000Z",
        metadata: {
          provider: "stripe"
        }
      };
    },
    async createCustomerPortalSession() {
      return {
        portalUrl: "https://billing.stripe.com/p/session/bps_test_123",
        externalSessionId: "bps_test_123",
        metadata: {
          provider: "stripe"
        }
      };
    }
  }
});
    const url = await startTestServer({
      apiAuthToken: "admin-secret",
      billingCheckoutProvider: "stripe",
      stripeBilling: {
        secretKey: "stripe-secret-value",
        webhookSecret: "stripe-webhook-secret-value",
        priceIds: {
          pro: "price_pro",
          studio: "price_studio"
        },
        requestTimeoutMs: 10_000,
        webhookToleranceSeconds: 300
      }
    }, platform);

    const checkoutBody = await postJson(`${url}/v1/billing/checkout`, {
      ownerId: "owner_test",
      planId: "pro",
      successUrl: "https://studio.example.com/billing/success",
      cancelUrl: "https://studio.example.com/billing/cancel"
    }, { authorization: "Bearer admin-secret" }) as {
      checkoutSession: { id: string; externalSessionId?: string; checkoutUrl: string };
    };
    const unsigned = await fetch(`${url}/v1/billing/stripe/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1800000000,v1=bad"
      },
      body: JSON.stringify({ id: "evt_bad", type: "checkout.session.completed" })
    });
    const completed = await postStripeWebhook(`${url}/v1/billing/stripe/webhook`, {
      id: "evt_checkout_completed",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          object: "checkout.session",
          customer: "cus_test_123",
          subscription: "sub_test_123",
          payment_status: "paid"
        }
      }
    }, "stripe-webhook-secret-value") as { handled: boolean; targetId?: string };
    const subscriptionResponse = await fetch(`${url}/v1/billing/subscription?ownerId=owner_test`, {
      headers: { authorization: "Bearer admin-secret" }
    });
    const subscriptionBody = await subscriptionResponse.json() as {
      subscription: { status: string; externalSubscriptionId?: string; externalCustomerId?: string };
    };
    const invoiceFailed = await postStripeWebhook(`${url}/v1/billing/stripe/webhook`, {
      id: "evt_invoice_failed",
      object: "event",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_test_123",
          object: "invoice",
          customer: "cus_test_123",
          subscription: "sub_test_123",
          amount_due: 1900,
          amount_paid: 0,
          currency: "usd",
          status: "open",
          hosted_invoice_url: "https://invoice.stripe.test/in_test_123",
          invoice_pdf: "https://invoice.stripe.test/in_test_123.pdf",
          created: 1_800_000_000,
          period_start: 1_800_000_000,
          period_end: 1_802_592_000,
          billing_reason: "subscription_cycle"
        }
      }
    }, "stripe-webhook-secret-value") as { handled: boolean; targetId?: string };
    const pastDueResponse = await fetch(`${url}/v1/billing/subscription?ownerId=owner_test`, {
      headers: { authorization: "Bearer admin-secret" }
    });
    const pastDueBody = await pastDueResponse.json() as {
      subscription: { status: string };
    };
    const portalResponse = await postJsonResponse(`${url}/v1/billing/payment-method-session`, {
      ownerId: "owner_test",
      returnUrl: "https://studio.example.com/billing/payment-method"
    }, { authorization: "Bearer admin-secret" });
    const portalBody = await portalResponse.json() as {
      portalSession?: { portalUrl: string; externalSessionId?: string; provider: string };
    };
    const blockedJobResponse = await postJsonResponse(`${url}/v1/jobs`, {
      ownerId: "owner_test",
      kind: "novel_to_project",
      input: {
        title: "欠费阻断",
        novelText: sampleNovelText
      }
    }, { authorization: "Bearer admin-secret" });
    const blockedJobBody = await blockedJobResponse.json() as {
      error: string;
      billingEntitlement?: { status: string; subscriptionId?: string };
    };
    const invoicePaid = await postStripeWebhook(`${url}/v1/billing/stripe/webhook`, {
      id: "evt_invoice_paid",
      object: "event",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_test_124",
          object: "invoice",
          customer: "cus_test_123",
          subscription: "sub_test_123",
          amount_due: 1900,
          amount_paid: 1900,
          currency: "usd",
          status: "paid",
          hosted_invoice_url: "https://invoice.stripe.test/in_test_124",
          created: 1_800_000_600,
          period_start: 1_800_000_000,
          period_end: 1_802_592_000
        }
      }
    }, "stripe-webhook-secret-value") as { handled: boolean; targetId?: string };
    const refundCreated = await postStripeWebhook(`${url}/v1/billing/stripe/webhook`, {
      id: "evt_charge_refunded",
      object: "event",
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_test_123",
          object: "charge",
          customer: "cus_test_123",
          amount_refunded: 900,
          currency: "usd",
          status: "succeeded",
          created: 1_800_001_000
        }
      }
    }, "stripe-webhook-secret-value") as { handled: boolean; targetId?: string };
    const disputeCreated = await postStripeWebhook(`${url}/v1/billing/stripe/webhook`, {
      id: "evt_dispute_created",
      object: "event",
      type: "charge.dispute.created",
      data: {
        object: {
          id: "dp_test_123",
          object: "dispute",
          charge: {
            id: "ch_test_123",
            object: "charge",
            customer: "cus_test_123"
          },
          amount: 500,
          currency: "usd",
          status: "needs_response",
          reason: "fraudulent",
          created: 1_800_001_100
        }
      }
    }, "stripe-webhook-secret-value") as { handled: boolean; targetId?: string };
    const disputeClosed = await postStripeWebhook(`${url}/v1/billing/stripe/webhook`, {
      id: "evt_dispute_closed",
      object: "event",
      type: "charge.dispute.closed",
      data: {
        object: {
          id: "dp_test_123",
          object: "dispute",
          charge: {
            id: "ch_test_123",
            object: "charge",
            customer: "cus_test_123"
          },
          amount: 500,
          currency: "usd",
          status: "won",
          reason: "fraudulent",
          created: 1_800_001_200
        }
      }
    }, "stripe-webhook-secret-value") as { handled: boolean; targetId?: string };
    const eventsResponse = await fetch(`${url}/v1/billing/events?ownerId=owner_test`, {
      headers: { authorization: "Bearer admin-secret" }
    });
    const eventsBody = await eventsResponse.json() as {
      events: Array<{
        eventType: string;
        externalInvoiceId?: string;
        externalChargeId?: string;
        amountDueCents?: number;
        amountPaidCents?: number;
        amountRefundedCents?: number;
        amountDisputedCents?: number;
        metadata?: Record<string, unknown>;
      }>;
    };
    const recoveredResponse = await fetch(`${url}/v1/billing/subscription?ownerId=owner_test`, {
      headers: { authorization: "Bearer admin-secret" }
    });
    const recoveredBody = await recoveredResponse.json() as {
      subscription: { status: string };
    };
    const recoveredJobResponse = await postJsonResponse(`${url}/v1/jobs`, {
      ownerId: "owner_test",
      kind: "novel_to_project",
      input: {
        title: "支付恢复",
        novelText: sampleNovelText
      }
    }, { authorization: "Bearer admin-secret" });
    const recoveredJobBody = await recoveredJobResponse.json() as {
      job?: { status: string; kind: string };
    };
    const deleted = await postStripeWebhook(`${url}/v1/billing/stripe/webhook`, {
      id: "evt_subscription_deleted",
      object: "event",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_test_123",
          object: "subscription",
          customer: "cus_test_123",
          status: "canceled",
          cancel_at_period_end: false
        }
      }
    }, "stripe-webhook-secret-value") as { handled: boolean };
    const cancelledResponse = await fetch(`${url}/v1/billing/subscription?ownerId=owner_test`, {
      headers: { authorization: "Bearer admin-secret" }
    });
    const cancelledBody = await cancelledResponse.json() as {
      subscription: { status: string };
    };

    expect(checkoutBody.checkoutSession.externalSessionId).toBe("cs_test_123");
    expect(checkoutBody.checkoutSession.checkoutUrl).toBe("https://checkout.stripe.com/c/pay/cs_test_123");
    expect(unsigned.status).toBe(400);
    expect(completed.handled).toBe(true);
    expect(completed.targetId).toBeTruthy();
    expect(subscriptionBody.subscription.status).toBe("active");
    expect(subscriptionBody.subscription.externalSubscriptionId).toBe("sub_test_123");
    expect(subscriptionBody.subscription.externalCustomerId).toBe("cus_test_123");
    expect(invoiceFailed.handled).toBe(true);
    expect(invoiceFailed.targetId).toBeTruthy();
    expect(pastDueBody.subscription.status).toBe("past_due");
    expect(portalResponse.status).toBe(201);
    expect(portalBody.portalSession?.portalUrl).toBe("https://billing.stripe.com/p/session/bps_test_123");
    expect(portalBody.portalSession?.externalSessionId).toBe("bps_test_123");
    expect(blockedJobResponse.status).toBe(402);
    expect(blockedJobBody.billingEntitlement?.status).toBe("past_due");
    expect(blockedJobBody.error).toContain("past due");
    expect(invoicePaid.handled).toBe(true);
    expect(refundCreated.handled).toBe(true);
    expect(disputeCreated.handled).toBe(true);
    expect(disputeClosed.handled).toBe(true);
    expect(eventsResponse.status).toBe(200);
    expect(eventsBody.events.map((event) => event.eventType)).toEqual([
      "dispute_closed",
      "dispute_created",
      "refund_created",
      "invoice_paid",
      "invoice_payment_failed"
    ]);
    expect(eventsBody.events[4]?.externalInvoiceId).toBe("in_test_123");
    expect(eventsBody.events[4]?.amountDueCents).toBe(1900);
    expect(eventsBody.events[3]?.amountPaidCents).toBe(1900);
    expect(eventsBody.events[2]?.externalChargeId).toBe("ch_test_123");
    expect(eventsBody.events[2]?.amountRefundedCents).toBe(900);
    expect(eventsBody.events[1]?.amountDisputedCents).toBe(500);
    expect(eventsBody.events[1]?.metadata?.disputeReason).toBe("fraudulent");
    expect(recoveredBody.subscription.status).toBe("active");
    expect(recoveredJobResponse.status).toBe(201);
    expect(recoveredJobBody.job?.kind).toBe("novel_to_project");
    expect(deleted.handled).toBe(true);
    expect(cancelledBody.subscription.status).toBe("cancelled");
  });
});

async function startTestServer(overrides: Partial<ApiConfig> = {}, platform?: VNPlatform): Promise<string> {
  const dataDir = await mkdtemp(join(tmpdir(), "vn-api-"));
  const baseConfig: ApiConfig = {
    host: "127.0.0.1",
    port: 0,
    dataDir,
    apiPublicBaseUrl: undefined,
    playerBaseUrl: undefined,
    postgresSsl: false,
    ownerAccessTokens: [],
    userAccessTokens: [],
    corsOrigin: "http://127.0.0.1:5173",
    requestBodyLimitBytes: 1_000_000,
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 300,
    accessLogEnabled: false,
    metricsPublic: false,
    billingCheckoutProvider: "mock",
    billingEntitlementPolicy: {
      blockPastDue: true,
      pastDueGracePeriodMs: 3 * 24 * 60 * 60 * 1000
    },
    releaseApprovalRequired: false,
    quotaPolicy: {
      dailyJobLimit: 1_000,
      dailyTextJobLimit: 500,
      dailyImageJobLimit: 100
    },
    costPolicy: {
      textJobCostCents: 2,
      imageJobCostCents: 8
    },
    retryPolicy: {
      maxAttempts: 3,
      retryDelayMs: 30_000
    },
    notificationRetryPolicy: {
      maxAttempts: 3,
      retryDelayMs: 30_000
    },
    contentSafetyPolicy: {
      enabled: true,
      blockOnReview: false,
      blockedTerms: ["BLOCKED_CONTENT"],
      reviewTerms: ["REVIEW_CONTENT"]
    },
    userAccountSecurityPolicy: {
      passwordMinLength: 8,
      passwordRequireLetter: true,
      passwordRequireNumber: false,
      passwordRequireSymbol: false,
      blockedPasswordTerms: [],
      maxFailedLoginAttempts: 5,
      failedLoginLockoutMs: 15 * 60_000
    },
    userAccountMfaPolicy: {
      enabled: false,
      issuer: "NovelGameMaker",
	      secretEncryptionKey: undefined,
	      totpStepSeconds: 30,
	      totpWindowSteps: 1,
	      trustedDeviceTtlMs: 30 * 24 * 60 * 60 * 1000,
	      maxTrustedDevices: 10
	    },
    userAccountAccessPolicy: {
      ssoRequiredEmailDomains: []
    },
    oauth: {
      enabled: false,
      provider: "mock",
      redirectUri: "http://127.0.0.1:8787/v1/auth/oauth/callback",
      stateTtlMs: 10 * 60_000,
      allowedReturnUrlOrigins: [],
      requireVerifiedEmail: true,
      allowedEmailDomains: [],
      groupRoleMappings: []
    },
    scim: {
      enabled: false
    },
    aiEnabled: false,
    aiTextProvider: "none",
    openAIText: {},
    aiImageProvider: "none",
    openAIImage: {},
    assetStorageProvider: "local",
    deploymentCacheProvider: "none"
  };
  const config: ApiConfig = {
    ...baseConfig,
    ...overrides,
    quotaPolicy: overrides.quotaPolicy ?? baseConfig.quotaPolicy,
    costPolicy: overrides.costPolicy ?? baseConfig.costPolicy,
    retryPolicy: overrides.retryPolicy ?? baseConfig.retryPolicy,
    billingEntitlementPolicy: overrides.billingEntitlementPolicy ?? baseConfig.billingEntitlementPolicy,
    notificationRetryPolicy: overrides.notificationRetryPolicy ?? baseConfig.notificationRetryPolicy,
    contentSafetyPolicy: overrides.contentSafetyPolicy ?? baseConfig.contentSafetyPolicy,
    userAccountSecurityPolicy: overrides.userAccountSecurityPolicy ?? baseConfig.userAccountSecurityPolicy,
    userAccountMfaPolicy: overrides.userAccountMfaPolicy ?? baseConfig.userAccountMfaPolicy
  };
  const server = createApiServer({
    config,
    platform
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unexpected server address.");
  }
  return `http://127.0.0.1:${address.port}`;
}

async function startRecordingWebhook(): Promise<{
  url: string;
  calls: Array<{
    method: string;
    url: string;
    headers: Record<string, string | string[] | undefined>;
    body: string;
  }>;
}> {
  const calls: Array<{
    method: string;
    url: string;
    headers: Record<string, string | string[] | undefined>;
    body: string;
  }> = [];
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      calls.push({
        method: request.method ?? "",
        url: request.url ?? "",
        headers: request.headers,
        body
      });
      response.writeHead(204);
      response.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unexpected webhook server address.");
  }
  return {
    url: `http://127.0.0.1:${address.port}/team-invitations`,
    calls
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for condition.");
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}): Promise<unknown> {
  const response = await postJsonResponse(url, body, headers);
  return response.json();
}

async function postJsonResponse(url: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
  return response;
}

async function postStripeWebhook(url: string, event: unknown, secret: string): Promise<unknown> {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": `t=${timestamp},v1=${signature}`
    },
    body
  });
  return response.json();
}

function updateFirstBeat(project: VNProject, text: string): VNProject {
  const next = JSON.parse(JSON.stringify(project)) as VNProject;
  next.chapters[0]!.scenes[0]!.shots[0]!.beats[0]!.line.text = text;
  next.updatedAt = new Date().toISOString();
  return next;
}

function createCurrentTotpCode(secret: string): string {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(counterBytes).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const value = ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;
  return String(value % 1_000_000).padStart(6, "0");
}

function base32Decode(value: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let current = 0;
  const bytes: number[] = [];
  for (const char of value.replace(/=+$/g, "").toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid base32 test secret.");
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
