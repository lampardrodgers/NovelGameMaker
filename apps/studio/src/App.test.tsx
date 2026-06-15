// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "./App";

describe("Studio App", () => {
  beforeEach(() => {
    const storage = createMemoryStorage();
    Object.defineProperty(window, "localStorage", {
      value: storage,
      configurable: true
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: storage,
      configurable: true
    });
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:studio-test"),
      configurable: true
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: vi.fn(),
      configurable: true
    });
    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      value: vi.fn(),
      configurable: true
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("loads the sample, navigates preview beats, and renders dialogue brackets", () => {
    render(<App />);

    expect(screen.getByRole("textbox", { name: "项目标题" })).toHaveValue("实验室里的蓝光");
    expect(document.querySelector(".vn-line")?.textContent).toBe("实验室里只剩下显示器的蓝光。");
    expect(screen.getByText("1 / 9")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("3 / 9")).toBeInTheDocument();
    expect(document.querySelector(".vn-speaker")?.textContent).toBe("林雪");
    expect(document.querySelector(".vn-line")?.textContent).toBe("「你听见了吗？」");
    expect(document.querySelector(".vn-character.focus-active")).not.toBeNull();
  });

  it("generates a VNProject from custom novel text and lets the user edit a beat", () => {
    render(<App />);

    fireEvent.change(screen.getByRole("textbox", { name: "小说文本" }), {
      target: {
        value: "第一章 天台测试\n\n天台上风很大。\n林雪：“我们走吧。”"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate VN Project" }));

    expect(screen.getByText("Generated 2 beats")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(document.querySelector(".vn-line")?.textContent).toBe("天台上风很大。");

    fireEvent.change(screen.getByDisplayValue("天台上风很大。"), {
      target: { value: "天台上的风像要把夜色吹散。" }
    });

    expect(document.querySelector(".vn-line")?.textContent).toBe("天台上的风像要把夜色吹散。");
  });

  it("saves and loads projects from localStorage", () => {
    render(<App />);

    expect(screen.getByRole("textbox", { name: "Owner ID" })).toHaveValue("local-user");
    expect(screen.getByRole("button", { name: "Save API" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Load API" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Generate Placeholder Assets" })).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox", { name: "项目标题" }), {
      target: { value: "本地存档测试" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Local" }));

    fireEvent.change(screen.getByRole("textbox", { name: "项目标题" }), {
      target: { value: "未保存标题" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Load Local" }));

    expect(screen.getByRole("textbox", { name: "项目标题" })).toHaveValue("本地存档测试");
    expect(screen.getByText("Loaded local save")).toBeInTheDocument();
  });

  it("saves and loads runtime preview progress", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("3 / 9")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("2 / 9")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Load Preview" }));
    expect(screen.getByText("3 / 9")).toBeInTheDocument();
    expect(screen.getByText("Loaded preview at beat 3")).toBeInTheDocument();
  });

  it("manages account registration, email verification, password reset, and MFA through the production API", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const auth = (init?.headers as Record<string, string> | undefined)?.authorization;
      if (url.pathname === "/v1/auth/register" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { email: string; name?: string };
        return jsonResponse({
          sessionToken: "vns_session",
          user: createUserAccount({ email: body.email, name: body.name }),
          session: createUserSession()
        }, 201);
      }
      if (url.pathname === "/v1/auth/me" && init?.method === "GET") {
        expect(auth).toBe("Bearer vns_session");
        return jsonResponse({
          auth: { role: "user", userId: "user_editor", email: "editor@example.com", sessionId: "session_1" },
          user: createUserAccount()
        });
      }
      if (url.pathname === "/v1/auth/email-verification/request" && init?.method === "POST") {
        expect(auth).toBe("Bearer vns_session");
        return jsonResponse({ requested: true });
      }
      if (url.pathname === "/v1/auth/verify-email" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { verificationToken: string };
        expect(body.verificationToken).toBe("vne_token");
        return jsonResponse({
          user: createUserAccount({ emailVerifiedAt: "2026-06-08T00:00:00.000Z" })
        });
      }
      if (url.pathname === "/v1/auth/password-reset/request" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { email: string };
        expect(body.email).toBe("editor@example.com");
        return jsonResponse({ ok: true });
      }
      if (url.pathname === "/v1/auth/password-reset/confirm" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { resetToken: string; password: string };
        expect(body).toEqual({ resetToken: "vnr_token", password: "new-correct-password" });
        return jsonResponse({
          user: createUserAccount({
            emailVerifiedAt: "2026-06-08T00:00:00.000Z",
            passwordUpdatedAt: "2026-06-08T00:01:00.000Z",
            mfaTotpEnabledAt: "2026-06-08T00:02:00.000Z"
          })
        });
      }
      if (url.pathname === "/v1/auth/mfa/totp/setup" && init?.method === "POST") {
        expect(auth).toBe("Bearer vns_session");
        return jsonResponse({
          secret: "JBSWY3DPEHPK3PXP",
          otpauthUrl: "otpauth://totp/Agentic%20Galgame%20Studio:editor%40example.com?secret=JBSWY3DPEHPK3PXP",
          user: createUserAccount()
        });
      }
	      if (url.pathname === "/v1/auth/mfa/totp/confirm" && init?.method === "POST") {
	        const body = JSON.parse(String(init.body)) as { code: string };
	        expect(auth).toBe("Bearer vns_session");
	        expect(body.code).toBe("123456");
	        return jsonResponse({
	          recoveryCodes: ["ABCDE-FGHIJ-KLMNO", "PQRST-UVWXY-Z2345"],
	          user: createUserAccount({ mfaTotpEnabledAt: "2026-06-08T00:02:00.000Z" })
	        });
	      }
	      if (url.pathname === "/v1/auth/mfa/recovery-codes/regenerate" && init?.method === "POST") {
	        const body = JSON.parse(String(init.body)) as { password: string; code?: string };
	        expect(auth).toBe("Bearer vns_session");
	        expect(body).toEqual({ password: "correct-password", code: "123456" });
	        return jsonResponse({
	          recoveryCodes: ["ZXCVB-NMASD-FGHJK", "QWERT-YUIOP-23456"],
	          user: createUserAccount({ mfaTotpEnabledAt: "2026-06-08T00:03:00.000Z" })
	        });
	      }
	      if (url.pathname === "/v1/auth/login" && init?.method === "POST") {
	        const body = JSON.parse(String(init.body)) as {
	          email: string;
	          password: string;
	          mfaCode?: string;
	          rememberMfaDevice?: boolean;
	          mfaDeviceToken?: string;
	        };
	        expect(body.email).toBe("editor@example.com");
	        expect(body.password).toBe("new-correct-password");
	        if (!body.mfaCode) {
	          return jsonResponse({ error: "MFA code is required.", mfaRequired: true, method: "totp" }, 202);
	        }
	        expect(body.mfaCode).toBe("654321");
	        expect(body.rememberMfaDevice).toBe(true);
	        return jsonResponse({
	          sessionToken: "vns_mfa_session",
	          mfaDeviceToken: "vnd_device",
	          user: createUserAccount({ mfaTotpEnabledAt: "2026-06-08T00:02:00.000Z" }),
	          session: createUserSession({ id: "session_mfa", tokenPrefix: "vns_mfa_sess" })
	        });
	      }
	      if (url.pathname === "/v1/auth/mfa/trusted-devices/revoke" && init?.method === "POST") {
	        const body = JSON.parse(String(init.body)) as { password: string; code?: string };
	        expect(auth).toBe("Bearer vns_mfa_session");
	        expect(body).toEqual({ password: "new-correct-password", code: "654321" });
	        return jsonResponse({
	          user: createUserAccount({ mfaTotpEnabledAt: "2026-06-08T00:02:00.000Z" })
	        });
	      }
      if (url.pathname === "/v1/auth/mfa/totp/disable" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { password: string; code?: string };
        expect(auth).toBe("Bearer vns_mfa_session");
        expect(body).toEqual({ password: "new-correct-password", code: "654321" });
        return jsonResponse({
          user: createUserAccount({ passwordUpdatedAt: "2026-06-08T00:01:00.000Z" })
        });
      }
      if (url.pathname === "/v1/auth/sessions" && init?.method === "GET") {
        expect(auth).toBe("Bearer vns_mfa_session");
        return jsonResponse({
          sessions: [
            createUserSession({
              id: "session_mfa",
              tokenPrefix: "vns_mfa_sess",
              lastUsedAt: "2026-06-08T00:04:00.000Z"
            }),
            createUserSession({
              id: "session_old",
              tokenPrefix: "vns_old_sess",
              revokedAt: "2026-06-08T00:03:00.000Z"
            })
          ]
        });
      }
      if (url.pathname === "/v1/auth/sessions/session_mfa/revoke" && init?.method === "POST") {
        expect(auth).toBe("Bearer vns_mfa_session");
        return jsonResponse({
          session: createUserSession({
            id: "session_mfa",
            tokenPrefix: "vns_mfa_sess",
            revokedAt: "2026-06-08T00:05:00.000Z"
          })
        });
      }
      return jsonResponse({ error: `unexpected request ${url.pathname}` }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const account = screen.getByRole("region", { name: "Account" });
    fireEvent.change(within(account).getByPlaceholderText("editor@example.com"), {
      target: { value: "editor@example.com" }
    });
    fireEvent.change(within(account).getByPlaceholderText("Editor"), {
      target: { value: "Editor" }
    });
    fireEvent.change(within(account).getByPlaceholderText("at least 8 characters"), {
      target: { value: "correct-password" }
    });
    fireEvent.click(within(account).getByRole("button", { name: "Register" }));

    await waitFor(() => expect(screen.getByText("Registered account: editor@example.com")).toBeInTheDocument());
    expect(localStorage.getItem("novel-game-maker:account-session")).toBe("vns_session");

    fireEvent.click(within(account).getByRole("button", { name: "Refresh Account" }));
    await waitFor(() => expect(screen.getByText("Loaded account: editor@example.com")).toBeInTheDocument());

    fireEvent.click(within(account).getByRole("button", { name: "Send Verification" }));
    await waitFor(() => expect(screen.getByText("Requested email verification")).toBeInTheDocument());

    fireEvent.change(within(account).getByLabelText("Verification token"), {
      target: { value: "vne_token" }
    });
    fireEvent.click(within(account).getByRole("button", { name: "Verify Email" }));
    await waitFor(() => expect(screen.getByText("Verified email: editor@example.com")).toBeInTheDocument());

    fireEvent.click(within(account).getByRole("button", { name: "Setup MFA" }));
    await waitFor(() => expect(screen.getByText("MFA setup secret generated")).toBeInTheDocument());
    expect(within(account).getByLabelText("MFA setup secret")).toHaveValue("JBSWY3DPEHPK3PXP");
    fireEvent.change(within(account).getByLabelText("MFA setup code"), {
      target: { value: "123456" }
    });
	    fireEvent.click(within(account).getByRole("button", { name: "Confirm MFA" }));
	    await waitFor(() => expect(screen.getByText(/MFA enabled: editor@example.com/)).toBeInTheDocument());
	    expect(within(account).getByLabelText("MFA recovery codes")).toHaveValue("ABCDE-FGHIJ-KLMNO\nPQRST-UVWXY-Z2345");
	    fireEvent.change(within(account).getByLabelText("MFA recovery code password"), {
	      target: { value: "correct-password" }
	    });
	    fireEvent.change(within(account).getByLabelText("MFA recovery code regeneration code"), {
	      target: { value: "123456" }
	    });
	    fireEvent.click(within(account).getByRole("button", { name: "Regenerate Codes" }));
	    await waitFor(() => expect(screen.getByText("MFA recovery codes regenerated: editor@example.com")).toBeInTheDocument());
	    expect(within(account).getByLabelText("MFA recovery codes")).toHaveValue("ZXCVB-NMASD-FGHJK\nQWERT-YUIOP-23456");

    fireEvent.click(within(account).getByRole("button", { name: "Request Reset" }));
    await waitFor(() => expect(screen.getByText("Password reset requested")).toBeInTheDocument());

    fireEvent.change(within(account).getByLabelText("Password reset token"), {
      target: { value: "vnr_token" }
    });
    fireEvent.change(within(account).getByLabelText("New password"), {
      target: { value: "new-correct-password" }
    });
    fireEvent.click(within(account).getByRole("button", { name: "Confirm Reset" }));

    await waitFor(() => expect(screen.getByText("Password reset completed: editor@example.com")).toBeInTheDocument());
    expect(localStorage.getItem("novel-game-maker:account-session")).toBeNull();

    fireEvent.change(within(account).getByPlaceholderText("at least 8 characters"), {
      target: { value: "new-correct-password" }
    });
    fireEvent.click(within(account).getByRole("button", { name: "Login" }));
    await waitFor(() => expect(screen.getByText("MFA code required")).toBeInTheDocument());
    expect(localStorage.getItem("novel-game-maker:account-session")).toBeNull();

	    fireEvent.change(within(account).getByLabelText("MFA login code"), {
	      target: { value: "654321" }
	    });
	    fireEvent.click(within(account).getByLabelText("Remember MFA device"));
	    fireEvent.click(within(account).getByRole("button", { name: "Login" }));
	    await waitFor(() => expect(screen.getByText("Logged in: editor@example.com")).toBeInTheDocument());
	    expect(localStorage.getItem("novel-game-maker:account-session")).toBe("vns_mfa_session");
	    expect(localStorage.getItem("novel-game-maker:mfa-device-token")).toBe("vnd_device");
	    expect(within(account).getByText(/device remembered/)).toBeInTheDocument();

	    fireEvent.change(within(account).getByLabelText("MFA trusted devices password"), {
	      target: { value: "new-correct-password" }
	    });
	    fireEvent.change(within(account).getByLabelText("MFA trusted devices code"), {
	      target: { value: "654321" }
	    });
	    fireEvent.click(within(account).getByRole("button", { name: "Forget Devices" }));
	    await waitFor(() => expect(screen.getByText("MFA trusted devices revoked: editor@example.com")).toBeInTheDocument());
	    expect(localStorage.getItem("novel-game-maker:mfa-device-token")).toBeNull();

    fireEvent.change(within(account).getByLabelText("MFA disable password"), {
      target: { value: "new-correct-password" }
    });
    fireEvent.change(within(account).getByLabelText("MFA disable code"), {
      target: { value: "654321" }
    });
    fireEvent.click(within(account).getByRole("button", { name: "Disable MFA" }));
    await waitFor(() => expect(screen.getByText("MFA disabled: editor@example.com")).toBeInTheDocument());

    fireEvent.click(within(account).getByRole("button", { name: "Refresh Sessions" }));
    await waitFor(() => expect(screen.getByText("Loaded 2 account sessions")).toBeInTheDocument());
    expect(screen.getByText("1 active / 2 total")).toBeInTheDocument();
    expect(screen.getByText("vns_mfa_sess")).toBeInTheDocument();
    expect(screen.getByText("vns_old_sess")).toBeInTheDocument();

    const revokeSessionButton = within(account).getAllByRole("button", { name: "Revoke Session" }).find((button) => !button.hasAttribute("disabled"));
    expect(revokeSessionButton).toBeTruthy();
    fireEvent.click(revokeSessionButton!);
    await waitFor(() => expect(screen.getByText("Revoked account session: session_mfa")).toBeInTheDocument());
    expect(localStorage.getItem("novel-game-maker:account-session")).toBeNull();
    expect(within(account).getByText("No account session")).toBeInTheDocument();
  });

  it("starts and completes SSO login from the account panel", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/auth/oauth/start" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { returnUrl?: string };
        expect(body.returnUrl).toBe("/studio");
        return jsonResponse({
          provider: "mock",
          authorizationUrl: "https://auth.example.com/mock?state=vno_state",
          state: "vno_state",
          expiresAt: "2026-06-08T00:10:00.000Z",
          returnUrl: "/studio"
        }, 201);
      }
      if (url.pathname === "/v1/auth/oauth/callback" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { state: string; code: string };
        expect(body).toEqual({ state: "vno_state", code: "sso.editor@example.com|SSO Editor" });
        return jsonResponse({
          sessionToken: "vns_sso_session",
          user: createUserAccount({ email: "sso.editor@example.com", name: "SSO Editor" }),
          session: createUserSession({ id: "session_sso", tokenPrefix: "vns_sso_sess" }),
          identity: {
            id: "oauth_identity_1",
            provider: "mock",
            userId: "user_editor",
            email: "sso.editor@example.com",
            name: "SSO Editor",
            createdAt: "2026-06-08T00:00:00.000Z",
            updatedAt: "2026-06-08T00:00:00.000Z"
          }
        });
      }
      return jsonResponse({ error: `unexpected request ${url.pathname}` }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const account = screen.getByRole("region", { name: "Account" });
    fireEvent.click(within(account).getByRole("button", { name: "Start SSO" }));
    await waitFor(() => expect(screen.getByText("SSO authorization started: mock")).toBeInTheDocument());
    expect(within(account).getByLabelText("SSO authorization URL")).toHaveValue("https://auth.example.com/mock?state=vno_state");
    expect(within(account).getByLabelText("SSO state")).toHaveValue("vno_state");

    fireEvent.change(within(account).getByLabelText("SSO authorization code"), {
      target: { value: "sso.editor@example.com|SSO Editor" }
    });
    fireEvent.click(within(account).getByRole("button", { name: "Complete SSO" }));

    await waitFor(() => expect(screen.getByText("SSO logged in: sso.editor@example.com")).toBeInTheDocument());
    expect(localStorage.getItem("novel-game-maker:account-session")).toBe("vns_sso_session");
  });

  it("shows non-stage characters as not visible in the inspector", () => {
    render(<App />);

    const unknownEditor = Array.from(document.querySelectorAll(".character-editor")).find((editor) =>
      editor.textContent?.includes("未知说话人")
    );
    const visibleCheckbox = unknownEditor?.querySelector<HTMLInputElement>('input[type="checkbox"]');

    expect(unknownEditor?.textContent).toContain("Focus: not visible");
    expect(visibleCheckbox).not.toBeChecked();
  });

  it("triggers project JSON and static playable downloads", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Export Project JSON" }));
    expect(screen.getByText("Exported project JSON")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Export Static Playable" }));
    expect(screen.getByText("Exported static playable")).toBeInTheDocument();

    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(2);
  });

  it("publishes the current project through the production API", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    let savedProject: unknown;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/projects" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { title: string; ownerId: string; vnProject: unknown };
        savedProject = body.vnProject;
        return jsonResponse({
          project: {
            id: "project_remote",
            title: body.title,
            ownerId: body.ownerId,
            vnProject: body.vnProject,
            createdAt: "2026-06-07T00:00:00.000Z",
            updatedAt: "2026-06-07T00:00:00.000Z"
          }
        });
      }
      if (url.pathname === "/v1/projects/project_remote/publish" && init?.method === "POST") {
        return jsonResponse({
          project: {
            id: "project_remote",
            title: "实验室里的蓝光",
            ownerId: "local-user",
            vnProject: savedProject,
            createdAt: "2026-06-07T00:00:00.000Z",
            updatedAt: "2026-06-07T00:00:00.000Z",
            publishedAt: "2026-06-07T00:00:01.000Z",
            currentReleaseId: "release_1"
          },
          projectUrl: "http://api.test/assets/project_remote/project.vn.json",
          playableUrl: "http://player.test/?projectUrl=release",
          currentProjectUrl: "http://api.test/v1/public/projects/project_remote/project.vn.json",
          currentPlayableUrl: "http://player.test/?projectUrl=current",
          release: {
            id: "release_1",
            version: 1
          },
          deploymentInvalidation: {
            status: "skipped",
            provider: "none",
            urls: ["http://api.test/v1/public/projects/project_remote/project.vn.json"]
          }
        });
      }
      return jsonResponse({ error: `unexpected request ${url.pathname}` }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Publish Player" }));

    await waitFor(() => expect(screen.getByText("Published release v1: http://player.test/?projectUrl=current")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/v1/projects/project_remote/publish", expect.objectContaining({ method: "POST" }));
  });

  it("requests release approval through the production API", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/projects" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { title: string; ownerId: string; vnProject: unknown };
        return jsonResponse({
          project: {
            id: "project_remote",
            title: body.title,
            ownerId: body.ownerId,
            vnProject: body.vnProject,
            createdAt: "2026-06-07T00:00:00.000Z",
            updatedAt: "2026-06-07T00:00:00.000Z"
          }
        });
      }
      if (url.pathname === "/v1/projects/project_remote/release-approvals" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { notes?: string };
        expect(body.notes).toContain("实验室里的蓝光");
        return jsonResponse({
          approval: {
            id: "release_approval_1",
            projectId: "project_remote",
            ownerId: "local-user",
            status: "pending",
            requestedBy: "user:editor",
            requestedAt: "2026-06-07T00:00:00.000Z",
            updatedAt: "2026-06-07T00:00:00.000Z"
          }
        }, 201);
      }
      if (url.pathname === "/v1/notification-deliveries" && init?.method === "GET") {
        return jsonResponse({ deliveries: [] });
      }
      return jsonResponse({ error: `unexpected request ${url.pathname}` }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Request Approval" }));

    await waitFor(() => expect(screen.getByText("Release approval pending: release_approval_1")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/v1/projects/project_remote/release-approvals", expect.objectContaining({ method: "POST" }));
  });

  it("reviews release approvals through the production API", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    let savedProject: unknown;
    const reviewBodies: Array<{ path: string; body: { reviewNotes?: string } }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/projects" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { title: string; ownerId: string; vnProject: unknown };
        savedProject = body.vnProject;
        return jsonResponse({
          project: {
            id: "project_remote",
            title: body.title,
            ownerId: body.ownerId,
            vnProject: body.vnProject,
            createdAt: "2026-06-07T00:00:00.000Z",
            updatedAt: "2026-06-07T00:00:00.000Z"
          }
        });
      }
      if (url.pathname === "/v1/projects/project_remote/release-approvals" && init?.method === "GET") {
        return jsonResponse({
          approvals: [
            createApproval("release_approval_1", "pending"),
            createApproval("release_approval_2", "pending")
          ]
        });
      }
      if (url.pathname === "/v1/release-approvals/release_approval_1/comments" && init?.method === "GET") {
        return jsonResponse({
          comments: [
            createApprovalComment("release_approval_comment_1", "release_approval_1", "请确认第一幕 CG。")
          ]
        });
      }
      if (url.pathname === "/v1/release-approvals/release_approval_1/comments" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { body: string };
        return jsonResponse({
          comment: createApprovalComment("release_approval_comment_2", "release_approval_1", body.body)
        }, 201);
      }
      if (url.pathname === "/v1/release-approvals/release_approval_1/approve" && init?.method === "POST") {
        reviewBodies.push({ path: url.pathname, body: JSON.parse(String(init.body)) as { reviewNotes?: string } });
        return jsonResponse({
          approval: {
            ...createApproval("release_approval_1", "published"),
            reviewedBy: "user:owner",
            reviewedAt: "2026-06-07T00:01:00.000Z",
            reviewNotes: "Approved for launch",
            publishedReleaseId: "release_2"
          },
          published: {
            project: {
              id: "project_remote",
              title: "实验室里的蓝光",
              ownerId: "local-user",
              vnProject: savedProject,
              createdAt: "2026-06-07T00:00:00.000Z",
              updatedAt: "2026-06-07T00:01:00.000Z",
              currentReleaseId: "release_2"
            },
            projectUrl: "http://api.test/assets/project_remote/project.vn.json",
            currentProjectUrl: "http://api.test/v1/public/projects/project_remote/project.vn.json",
            currentPlayableUrl: "http://player.test/?projectUrl=current",
            release: {
              id: "release_2",
              version: 2
            }
          }
        });
      }
      if (url.pathname === "/v1/release-approvals/release_approval_2/reject" && init?.method === "POST") {
        reviewBodies.push({ path: url.pathname, body: JSON.parse(String(init.body)) as { reviewNotes?: string } });
        return jsonResponse({
          approval: {
            ...createApproval("release_approval_2", "rejected"),
            reviewedBy: "user:owner",
            reviewedAt: "2026-06-07T00:02:00.000Z",
            reviewNotes: "Needs text QA"
          }
        });
      }
      return jsonResponse({ error: `unexpected request ${url.pathname}` }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Save API" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Approve release_approval_1" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Load Comments release_approval_1" }));
    await waitFor(() => expect(screen.getByText("请确认第一幕 CG。")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("textbox", { name: "Comment release_approval_1" }), {
      target: { value: "第二幕台词已检查。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Comment release_approval_1" }));
    await waitFor(() => expect(screen.getByText("Added approval comment: release_approval_comment_2")).toBeInTheDocument());
    expect(screen.getByText("第二幕台词已检查。")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Review notes" }), {
      target: { value: "Approved for launch" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve release_approval_1" }));

    await waitFor(() => expect(screen.getByText("Approved release approval release_approval_1: release v2")).toBeInTheDocument());
    expect(screen.getByText("Release: release_2")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Review notes" }), {
      target: { value: "Needs text QA" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Reject release_approval_2" }));

    await waitFor(() => expect(screen.getByText("Rejected release approval: release_approval_2")).toBeInTheDocument());
    expect(reviewBodies).toEqual([
      { path: "/v1/release-approvals/release_approval_1/approve", body: { reviewNotes: "Approved for launch" } },
      { path: "/v1/release-approvals/release_approval_2/reject", body: { reviewNotes: "Needs text QA" } }
    ]);
  });

  it("loads release diffs through the production API", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/projects" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { title: string; ownerId: string; vnProject: unknown };
        return jsonResponse({
          project: {
            id: "project_remote",
            title: body.title,
            ownerId: body.ownerId,
            vnProject: body.vnProject,
            createdAt: "2026-06-07T00:00:00.000Z",
            updatedAt: "2026-06-07T00:00:00.000Z",
            currentReleaseId: "release_1"
          }
        });
      }
      if (url.pathname === "/v1/projects/project_remote/release-diff" && init?.method === "GET") {
        return jsonResponse({
          diff: createReleaseDiff()
        });
      }
      return jsonResponse({ error: `unexpected request ${url.pathname}` }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Save API" }));
    await waitFor(() => expect(screen.getByText("Saved to API: project_remote")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Refresh Release Diff" }));

    await waitFor(() => expect(screen.getByText("Diff vs release v1")).toBeInTheDocument());
    expect(screen.getByText("1 beat changed")).toBeInTheDocument();
    expect(screen.getByText("After: 实验室里的蓝光变得刺眼。")).toBeInTheDocument();
  });

  it("monitors notification delivery outbox through the production API", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    let savedProject: unknown;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/projects" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { title: string; ownerId: string; vnProject: unknown };
        savedProject = body.vnProject;
        return jsonResponse({
          project: {
            id: "project_remote",
            title: body.title,
            ownerId: body.ownerId,
            vnProject: body.vnProject,
            createdAt: "2026-06-07T00:00:00.000Z",
            updatedAt: "2026-06-07T00:00:00.000Z"
          }
        });
      }
      if (url.pathname === "/v1/projects/project_remote/release-approvals" && init?.method === "GET") {
        return jsonResponse({ approvals: [] });
      }
      if (url.pathname === "/v1/notification-deliveries" && init?.method === "GET") {
        expect(url.searchParams.get("ownerId")).toBe("local-user");
        return jsonResponse({
          deliveries: [
            createNotificationDelivery("notification_delivery_1", "approval_requested", "pending"),
            {
              ...createNotificationDelivery("notification_delivery_2", "approval_comment_added", "failed"),
              attempts: 3,
              error: "webhook outage"
            }
          ]
        });
      }
      if (url.pathname === "/v1/notification-deliveries/run-next" && init?.method === "POST") {
        return jsonResponse({
          delivery: {
            ...createNotificationDelivery("notification_delivery_1", "approval_requested", "succeeded"),
            attempts: 1,
            deliveredAt: "2026-06-07T00:01:00.000Z"
          }
        });
      }
      return jsonResponse({ error: `unexpected request ${url.pathname}` }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Save API" }));
    await waitFor(() => expect(savedProject).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Refresh Notifications" }));

    await waitFor(() => expect(screen.getByText("approval_requested")).toBeInTheDocument());
    expect(screen.getByText("webhook outage")).toBeInTheDocument();
    expect(screen.getByText("1 pending / 1 failed / 2 total")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Run Next Notification" }));

    await waitFor(() => expect(screen.getByText("Ran notification delivery: notification_delivery_1 (succeeded)")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/v1/notification-deliveries/run-next", expect.objectContaining({ method: "POST" }));
  });

  it("loads operations summary through the production API", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/ops/summary" && init?.method === "GET") {
        expect(url.searchParams.get("ownerId")).toBe("local-user");
        return jsonResponse({
          summary: createOperationsSummary()
        });
      }
      return jsonResponse({ error: `unexpected request ${url.pathname}` }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh Operations" }));

    await waitFor(() => expect(screen.getByText("Loaded operations summary: critical")).toBeInTheDocument());
    expect(screen.getByText("critical / 2 incidents")).toBeInTheDocument();
    expect(screen.getByText("2 queued jobs")).toBeInTheDocument();
    expect(screen.getByText("1 failed notifications")).toBeInTheDocument();
    expect(screen.getByText("Notification delivery failed: release_approval_requested.")).toBeInTheDocument();
  });

  it("loads usage and estimated billing through the production API", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/usage" && init?.method === "GET") {
        expect(url.searchParams.get("ownerId")).toBe("local-user");
        expect(url.searchParams.get("limit")).toBe("20");
        return jsonResponse({
          usage: createUsageSummary(),
          events: [
            createUsageEvent("usage_cost", "estimated_cost_cents", 18),
            createUsageEvent("usage_asset", "asset_bytes", 2048)
          ]
        });
      }
      return jsonResponse({ error: `unexpected request ${url.pathname}` }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const panel = screen.getByRole("region", { name: "Usage and Billing" });
    fireEvent.click(within(panel).getByRole("button", { name: "Refresh Usage" }));

    await waitFor(() => expect(screen.getByText("Loaded usage: 3 jobs / 18 cents")).toBeInTheDocument());
    expect(within(panel).getByText("3 jobs / $0.18 estimated")).toBeInTheDocument();
    expect(within(panel).getByText("1 text jobs")).toBeInTheDocument();
    expect(within(panel).getByText("2 image jobs")).toBeInTheDocument();
    expect(within(panel).getByText("2.0 KB assets")).toBeInTheDocument();
    expect(within(panel).getByText("estimated_cost_cents")).toBeInTheDocument();
    expect(within(panel).getByText("18")).toBeInTheDocument();
  });

  it("loads billing plans and starts checkout through the production API", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/billing/plans" && init?.method === "GET") {
        return jsonResponse({ plans: createBillingPlans() });
      }
      if (url.pathname === "/v1/billing/subscription" && init?.method === "GET") {
        expect(url.searchParams.get("ownerId")).toBe("local-user");
        return jsonResponse({ subscription: createBillingSubscription({ planId: "pro", status: "active" }) });
      }
      if (url.pathname === "/v1/billing/checkout-sessions" && init?.method === "GET") {
        expect(url.searchParams.get("ownerId")).toBe("local-user");
        return jsonResponse({ checkoutSessions: [createBillingCheckoutSession({ status: "completed" })] });
      }
      if (url.pathname === "/v1/billing/events" && init?.method === "GET") {
        expect(url.searchParams.get("ownerId")).toBe("local-user");
        return jsonResponse({ events: [createBillingEvent(), createRefundBillingEvent()] });
      }
      if (url.pathname === "/v1/billing/checkout" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { ownerId: string; planId: string };
        expect(body.ownerId).toBe("local-user");
        expect(body.planId).toBe("studio");
        return jsonResponse({
          checkoutSession: createBillingCheckoutSession({
            id: "checkout_studio",
            planId: "studio",
            status: "created",
            checkoutUrl: "https://billing.local/checkout/checkout_studio"
          })
        }, 201);
      }
      if (url.pathname === "/v1/billing/payment-method-session" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { ownerId: string; returnUrl?: string };
        expect(body.ownerId).toBe("local-user");
        expect(body.returnUrl).toBe("http://localhost:3000/billing/payment-method");
        return jsonResponse({
          portalSession: {
            id: "portal_1",
            ownerId: "local-user",
            subscriptionId: "subscription_1",
            provider: "mock",
            portalUrl: "https://billing.local/portal/portal_1",
            createdAt: "2026-06-08T00:00:00.000Z"
          }
        }, 201);
      }
      if (url.pathname === "/v1/billing/subscription/cancel" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { ownerId: string };
        expect(body.ownerId).toBe("local-user");
        return jsonResponse({
          subscription: createBillingSubscription({ planId: "pro", status: "cancelled" })
        });
      }
      return jsonResponse({ error: `unexpected request ${url.pathname}` }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const panel = screen.getByRole("region", { name: "Billing" });
    fireEvent.click(within(panel).getByRole("button", { name: "Refresh Billing" }));

    await waitFor(() => expect(screen.getByText("Loaded billing: pro / active")).toBeInTheDocument());
    expect(within(panel).getByText("Pro / active")).toBeInTheDocument();
    expect(within(panel).getByText("1000 jobs/day · 100 image jobs/day")).toBeInTheDocument();
    expect(within(panel).getByText("invoice paid")).toBeInTheDocument();
    expect(within(panel).getByText("in_test_123")).toBeInTheDocument();
    expect(within(panel).getByText("refund created")).toBeInTheDocument();
    expect(within(panel).getByText("ch_test_123")).toBeInTheDocument();
    expect(within(panel).getByText("$9.00 refunded")).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole("button", { name: "Update Payment Method" }));
    await waitFor(() => expect(screen.getByText("Payment method update link ready: mock")).toBeInTheDocument());
    expect(within(panel).getByText("https://billing.local/portal/portal_1")).toBeInTheDocument();

    fireEvent.change(within(panel).getByLabelText("Plan"), {
      target: { value: "studio" }
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Start Checkout" }));

    await waitFor(() => expect(screen.getByText("Started billing checkout: created")).toBeInTheDocument());
    expect(within(panel).getByText("https://billing.local/checkout/checkout_studio")).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole("button", { name: "Cancel Subscription" }));
    await waitFor(() => expect(screen.getByText("Cancelled billing subscription: pro")).toBeInTheDocument());
  });

  it("loads audit events through the production API", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/audit" && init?.method === "GET") {
        expect(url.searchParams.get("ownerId")).toBe("local-user");
        expect(url.searchParams.get("limit")).toBe("20");
        return jsonResponse({
          events: [
            createAuditEvent("audit_security", "user_mfa_trusted_device_used", "user_account", "succeeded", {
              trustedDevicePrefix: "vnd_"
            }),
            createAuditEvent("audit_release", "project_published", "project", "succeeded", {
              releaseVersion: 2
            })
          ]
        });
      }
      return jsonResponse({ error: `unexpected request ${url.pathname}` }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh Audit" }));

    await waitFor(() => expect(screen.getByText("Loaded 2 audit events")).toBeInTheDocument());
    expect(screen.getByText("2 events / 1 security")).toBeInTheDocument();
    expect(screen.getByText("user_mfa_trusted_device_used")).toBeInTheDocument();
    expect(screen.getByText("project_published")).toBeInTheDocument();
    expect(screen.getByText("security")).toBeInTheDocument();
    expect(screen.getByText("release")).toBeInTheDocument();
    expect(screen.getByText("trustedDevicePrefix=vnd_")).toBeInTheDocument();
  });

  it("reviews content safety records through the production API", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    let reviewedBody: { source?: string; text?: string; targetType?: string; targetId?: string } | undefined;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/content-safety" && init?.method === "GET") {
        expect(url.searchParams.get("ownerId")).toBe("local-user");
        expect(url.searchParams.get("limit")).toBe("20");
        return jsonResponse({
          reviews: [
            createContentSafetyReview("safety_blocked", "novel_text", "blocked", ["blocked:BLOCKED_CONTENT"]),
            createContentSafetyReview("safety_review", "asset_prompt", "review_required", ["review:REVIEW_CONTENT"])
          ]
        });
      }
      if (url.pathname === "/v1/projects" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { title: string; ownerId: string; vnProject: unknown };
        return jsonResponse({
          project: {
            id: "project_remote",
            title: body.title,
            ownerId: body.ownerId,
            vnProject: body.vnProject,
            createdAt: "2026-06-07T00:00:00.000Z",
            updatedAt: "2026-06-07T00:00:00.000Z"
          }
        });
      }
      if (url.pathname === "/v1/content-safety/review" && init?.method === "POST") {
        reviewedBody = JSON.parse(String(init.body)) as typeof reviewedBody;
        return jsonResponse({
          review: createContentSafetyReview("safety_project", "project_json", "approved", [])
        }, 201);
      }
      if (url.pathname === "/v1/ops/summary" && init?.method === "GET") {
        return jsonResponse({ summary: createOperationsSummary() });
      }
      return jsonResponse({ error: `unexpected request ${url.pathname}` }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh Safety" }));
    await waitFor(() => expect(screen.getByText("Loaded 2 content safety reviews")).toBeInTheDocument());
    expect(screen.getByText("2 reviews / 1 blocked / 1 review")).toBeInTheDocument();
    expect(screen.getByText("blocked:BLOCKED_CONTENT")).toBeInTheDocument();
    expect(screen.getByText("review:REVIEW_CONTENT")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Review Project" }));

    await waitFor(() => expect(screen.getByText("Project safety review: approved")).toBeInTheDocument());
    expect(reviewedBody?.source).toBe("project_json");
    expect(reviewedBody?.targetType).toBe("project");
    expect(reviewedBody?.targetId).toBe("project_remote");
    expect(reviewedBody?.text).toContain("\"title\":\"实验室里的蓝光\"");
    expect(screen.getByText("project_json")).toBeInTheDocument();
    expect(screen.getByText("f".repeat(16))).toBeInTheDocument();
  });

  it("manages owner access tokens through the production API", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    let tokens = [
      createAccessToken("token_existing", "Existing deploy token")
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/access-tokens" && init?.method === "GET") {
        expect(url.searchParams.get("ownerId")).toBe("local-user");
        expect(url.searchParams.get("limit")).toBe("20");
        return jsonResponse({ accessTokens: tokens });
      }
      if (url.pathname === "/v1/access-tokens" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { role: string; ownerId: string; label?: string; expiresAt?: string };
        expect(body.role).toBe("owner");
        expect(body.ownerId).toBe("local-user");
        expect(body.label).toBe("Deploy token");
        const accessToken = createAccessToken("token_created", body.label);
        tokens = [accessToken, ...tokens];
        return jsonResponse({
          token: "vn_new_owner_secret",
          accessToken
        }, 201);
      }
      if (url.pathname === "/v1/access-tokens/token_created/revoke" && init?.method === "POST") {
        tokens = tokens.map((token) => token.id === "token_created"
          ? { ...token, revokedAt: "2026-06-08T00:02:00.000Z" }
          : token);
        return jsonResponse({ accessToken: tokens[0] });
      }
      if (url.pathname === "/v1/audit" && init?.method === "GET") {
        return jsonResponse({ events: [] });
      }
      return jsonResponse({ error: `unexpected request ${url.pathname}` }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const panel = screen.getByRole("region", { name: "Access Tokens" });
    fireEvent.click(within(panel).getByRole("button", { name: "Refresh Tokens" }));
    await waitFor(() => expect(screen.getByText("Loaded 1 access tokens")).toBeInTheDocument());
    expect(within(panel).getByText("1 active / 1 total")).toBeInTheDocument();
    expect(within(panel).getByText("Existing deploy token")).toBeInTheDocument();

    fireEvent.change(within(panel).getByLabelText("Label"), { target: { value: "Deploy token" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Create Owner Token" }));

    await waitFor(() => expect(screen.getByText("Created owner access token: vn_new_owne")).toBeInTheDocument());
    expect(within(panel).getByText("vn_new_owner_secret")).toBeInTheDocument();
    expect(within(panel).getByText("Deploy token")).toBeInTheDocument();

    fireEvent.click(within(panel).getAllByRole("button", { name: "Revoke Token" })[0]!);
    await waitFor(() => expect(screen.getByText("Revoked access token: vn_new_owne")).toBeInTheDocument());
    expect(within(panel).getByText("revoked")).toBeInTheDocument();
  });

  it("manages team invitations through the production API", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    let invitations = [
      createTeamInvitation("team_invitation_existing", "viewer@example.com", "viewer", "pending")
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/teams/local-user/invitations" && init?.method === "GET") {
        return jsonResponse({ invitations });
      }
      if (url.pathname === "/v1/teams/local-user/invitations" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { email: string; role: "editor"; invitedUserId?: string };
        const invitation = createTeamInvitation("team_invitation_1", body.email.toLowerCase(), body.role, "pending");
        invitations = [invitation, ...invitations];
        return jsonResponse({
          invitationToken: "vni_plain_invitation_token",
          invitation
        }, 201);
      }
      if (url.pathname === "/v1/team-invitations/accept" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { invitationToken: string; userId?: string };
        expect(body.invitationToken).toBe("vni_plain_invitation_token");
        const invitation = {
          ...createTeamInvitation("team_invitation_1", "editor@example.com", "editor", "accepted"),
          acceptedByUserId: body.userId
        };
        invitations = invitations.map((item) => item.id === invitation.id ? invitation : item);
        return jsonResponse({
          invitation,
          member: {
            teamId: "local-user",
            userId: body.userId,
            role: "editor"
          }
        });
      }
      if (url.pathname === "/v1/team-invitations/team_invitation_existing/revoke" && init?.method === "POST") {
        const invitation = createTeamInvitation("team_invitation_existing", "viewer@example.com", "viewer", "revoked");
        invitations = invitations.map((item) => item.id === invitation.id ? invitation : item);
        return jsonResponse({ invitation });
      }
      if (url.pathname === "/v1/ops/summary" && init?.method === "GET") {
        return jsonResponse({ summary: createOperationsSummary() });
      }
      return jsonResponse({ error: `unexpected request ${url.pathname}` }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const invitationsPanel = screen.getByRole("region", { name: "Team Invitations" });
    fireEvent.click(screen.getByRole("button", { name: "Refresh Invitations" }));
    await waitFor(() => expect(screen.getByText("Loaded 1 team invitations")).toBeInTheDocument());
    expect(screen.getByText("viewer@example.com")).toBeInTheDocument();

    fireEvent.change(within(invitationsPanel).getByPlaceholderText("editor@example.com"), {
      target: { value: "Editor@Example.COM" }
    });
    fireEvent.change(within(invitationsPanel).getByPlaceholderText("optional known user id"), {
      target: { value: "user_editor" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Invite" }));

    await waitFor(() => expect(screen.getByText("Created team invitation: editor@example.com")).toBeInTheDocument());
    expect(screen.getByText("vni_plain_invitation_token")).toBeInTheDocument();
    expect(screen.queryByText(/tokenHash/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Invitation token"), {
      target: { value: "vni_plain_invitation_token" }
    });
    fireEvent.change(screen.getByLabelText("Invitation accept user id"), {
      target: { value: "user_editor" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Accept Invite" }));

    await waitFor(() => expect(screen.getByText("Accepted invite for user_editor as editor")).toBeInTheDocument());
    expect(screen.getByText("editor / accepted")).toBeInTheDocument();

    const revokeButton = screen.getAllByRole("button", { name: "Revoke" }).find((button) => !button.hasAttribute("disabled"));
    expect(revokeButton).toBeTruthy();
    fireEvent.click(revokeButton!);
    await waitFor(() => expect(screen.getByText("Revoked team invitation: viewer@example.com")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/v1/teams/local-user/invitations",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("generates placeholder assets through the production API and saves generated URLs", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const savedProjectTitles: string[] = [];
    const finalAssetSources: string[][] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/projects" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { title: string; vnProject: { assets?: { items?: Array<{ src: string }> } } };
        savedProjectTitles.push(body.title);
        finalAssetSources.push(body.vnProject.assets?.items?.map((asset) => asset.src) ?? []);
        return jsonResponse({
          project: {
            id: "project_remote",
            title: body.title,
            ownerId: "local-user",
            vnProject: body.vnProject,
            createdAt: "2026-06-07T00:00:00.000Z",
            updatedAt: "2026-06-07T00:00:00.000Z"
          }
        });
      }
      if (url.pathname === "/v1/jobs" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { input: { assetId: string } };
        return jsonResponse({
          job: {
            id: `job_${body.input.assetId}`,
            kind: "asset_generation",
            status: "queued",
            ownerId: "local-user",
            projectId: "project_remote",
            input: body.input,
            attempts: 0,
            createdAt: "2026-06-07T00:00:00.000Z",
            updatedAt: "2026-06-07T00:00:00.000Z"
          }
        });
      }
      const runMatch = url.pathname.match(/^\/v1\/jobs\/job_(.+)\/run$/);
      if (runMatch && init?.method === "POST") {
        const assetId = decodeURIComponent(runMatch[1] ?? "");
        return jsonResponse({
          job: {
            id: `job_${assetId}`,
            kind: "asset_generation",
            status: "succeeded",
            ownerId: "local-user",
            projectId: "project_remote",
            input: { assetId },
            output: {
              assetId,
              publicUrl: `/assets/project_remote/${assetId}.png`,
              provider: "openai-compatible-images"
            },
            attempts: 1,
            createdAt: "2026-06-07T00:00:00.000Z",
            updatedAt: "2026-06-07T00:00:00.000Z"
          }
        });
      }
      return jsonResponse({ error: `unexpected request ${url.pathname}` }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(screen.getByRole("button", { name: "Generate Placeholder Assets" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Generate Placeholder Assets" }));

    await waitFor(() => expect(screen.getByText(/Generated \d+ assets and saved API project/)).toBeInTheDocument());
    expect(savedProjectTitles.length).toBeGreaterThanOrEqual(2);
    expect(finalAssetSources.at(-1)?.some((src) => src.startsWith("http://api.test/assets/project_remote/"))).toBe(true);
  });

  it("can enqueue asset generation and wait for a worker without running jobs from the browser", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    vi.stubEnv("VITE_ASSET_JOB_RUN_MODE", "worker");
    vi.stubEnv("VITE_ASSET_JOB_POLL_INTERVAL_MS", "1");
    vi.stubEnv("VITE_ASSET_JOB_POLL_ATTEMPTS", "3");
    const finalAssetSources: string[][] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/projects" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { title: string; vnProject: { assets?: { items?: Array<{ src: string }> } } };
        finalAssetSources.push(body.vnProject.assets?.items?.map((asset) => asset.src) ?? []);
        return jsonResponse({
          project: {
            id: "project_remote",
            title: body.title,
            ownerId: "local-user",
            vnProject: body.vnProject,
            createdAt: "2026-06-07T00:00:00.000Z",
            updatedAt: "2026-06-07T00:00:00.000Z"
          }
        });
      }
      if (url.pathname === "/v1/jobs" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { input: { assetId: string } };
        return jsonResponse({
          job: {
            id: `job_${body.input.assetId}`,
            kind: "asset_generation",
            status: "queued",
            ownerId: "local-user",
            projectId: "project_remote",
            input: body.input,
            attempts: 0,
            maxAttempts: 3,
            createdAt: "2026-06-07T00:00:00.000Z",
            updatedAt: "2026-06-07T00:00:00.000Z"
          }
        });
      }
      const jobMatch = url.pathname.match(/^\/v1\/jobs\/job_(.+)$/);
      if (jobMatch && init?.method === "GET") {
        const assetId = decodeURIComponent(jobMatch[1] ?? "");
        return jsonResponse({
          job: {
            id: `job_${assetId}`,
            kind: "asset_generation",
            status: "succeeded",
            ownerId: "local-user",
            projectId: "project_remote",
            input: { assetId },
            output: {
              assetId,
              publicUrl: `/assets/project_remote/${assetId}.png`,
              provider: "openai-compatible-images"
            },
            attempts: 1,
            maxAttempts: 3,
            createdAt: "2026-06-07T00:00:00.000Z",
            updatedAt: "2026-06-07T00:00:01.000Z"
          }
        });
      }
      return jsonResponse({ error: `unexpected request ${url.pathname}` }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Generate Placeholder Assets" }));

    await waitFor(() => expect(screen.getByText(/Generated \d+ assets and saved API project/)).toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/\/v1\/jobs\/.+\/run$/),
      expect.objectContaining({ method: "POST" })
    );
    expect(finalAssetSources.at(-1)?.some((src) => src.startsWith("http://api.test/assets/project_remote/"))).toBe(true);
  });
});

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    }
  };
}

function createApproval(
  id: string,
  status: "pending" | "published" | "rejected" | "cancelled"
) {
  return {
    id,
    projectId: "project_remote",
    ownerId: "local-user",
    status,
    requestedBy: "user:editor",
    requestedAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
    notes: "Ready for review"
  };
}

function createApprovalComment(id: string, approvalId: string, body: string) {
  return {
    id,
    approvalId,
    projectId: "project_remote",
    ownerId: "local-user",
    author: "user:editor",
    body,
    createdAt: "2026-06-07T00:00:00.000Z"
  };
}

function createNotificationDelivery(
  id: string,
  event: string,
  status: "pending" | "running" | "succeeded" | "failed"
) {
  return {
    id,
    ownerId: "local-user",
    projectId: "project_remote",
    approvalId: "release_approval_1",
    event,
    provider: "release_approval_webhook",
    status,
    attempts: 0,
    maxAttempts: 3,
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
    nextRunAt: status === "pending" ? "2026-06-07T00:02:00.000Z" : undefined
  };
}

function createAuditEvent(
  id: string,
  action: string,
  targetType: string,
  outcome: "succeeded" | "failed" | "blocked",
  details?: Record<string, unknown>
) {
  return {
    id,
    ownerId: "local-user",
    action,
    targetType,
    targetId: `${targetType}_1`,
    outcome,
    details,
    createdAt: "2026-06-08T00:00:00.000Z"
  };
}

function createContentSafetyReview(
  id: string,
  source: "novel_text" | "project_json" | "asset_prompt",
  decision: "approved" | "review_required" | "blocked",
  matchedRules: string[]
) {
  return {
    id,
    ownerId: "local-user",
    source,
    decision,
    targetType: source === "project_json" ? "project" : source,
    targetId: source === "project_json" ? "project_remote" : `${source}_1`,
    inputHash: "f".repeat(64),
    inputLength: 42,
    matchedRules,
    metadata: {
      title: "审核测试"
    },
    createdAt: "2026-06-08T00:00:00.000Z"
  };
}

function createAccessToken(id: string, label = "Studio owner token") {
  return {
    id,
    tokenPrefix: id === "token_created" ? "vn_new_owne" : "vn_existing",
    role: "owner",
    ownerId: "local-user",
    label,
    createdAt: "2026-06-08T00:00:00.000Z",
    lastUsedAt: id === "token_existing" ? "2026-06-08T00:01:00.000Z" : undefined
  };
}

function createTeamInvitation(
  id: string,
  email: string,
  role: "owner" | "admin" | "editor" | "viewer",
  status: "pending" | "accepted" | "revoked" | "expired"
) {
  return {
    id,
    teamId: "local-user",
    email,
    role,
    tokenPrefix: "vni_prefix_",
    status,
    invitedBy: "owner:local-user",
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
    expiresAt: "2026-06-14T00:00:00.000Z"
  };
}

function createOperationsSummary() {
  return {
    ownerId: "local-user",
    generatedAt: "2026-06-08T00:00:00.000Z",
    status: "critical",
    usage: {
      jobEnqueued: 3,
      textJobEnqueued: 1,
      imageJobEnqueued: 2,
      jobSucceeded: 1,
      jobFailed: 1,
      jobBlocked: 0,
      assetBytes: 2048,
      estimatedCostCents: 18
    },
    counts: {
      projects: 1,
      jobs: {
        total: 4,
        queued: 2,
        running: 0,
        succeeded: 1,
        failed: 1,
        blocked: 0,
        waitingForCredentials: 0,
        retryScheduled: 1
      },
      releaseApprovals: {
        pending: 1,
        published: 0,
        rejected: 0,
        cancelled: 0
      },
      notificationDeliveries: {
        pending: 1,
        running: 0,
        succeeded: 2,
        failed: 1
      },
      contentSafety: {
        approved: 4,
        reviewRequired: 0,
        blocked: 1
      },
      deploymentInvalidations: {
        skipped: 1,
        succeeded: 0,
        failed: 0
      }
    },
    incidents: [
      {
        id: "job:job_1",
        severity: "critical",
        source: "job",
        message: "Generation job failed: novel_to_project.",
        targetId: "job_1",
        createdAt: "2026-06-08T00:00:00.000Z"
      },
      {
        id: "notification:notification_delivery_1",
        severity: "warning",
        source: "notification",
        message: "Notification delivery failed: release_approval_requested.",
        targetId: "notification_delivery_1",
        createdAt: "2026-06-08T00:00:00.000Z"
      }
    ]
  };
}

function createUsageSummary() {
  return {
    ownerId: "local-user",
    windowStart: "2026-06-08T00:00:00.000Z",
    windowEnd: "2026-06-08T00:10:00.000Z",
    jobEnqueued: 3,
    textJobEnqueued: 1,
    imageJobEnqueued: 2,
    jobSucceeded: 2,
    jobFailed: 1,
    jobBlocked: 0,
    assetBytes: 2048,
    estimatedCostCents: 18
  };
}

function createUsageEvent(
  id: string,
  metric: "job_enqueued" | "text_job_enqueued" | "image_job_enqueued" | "job_succeeded" | "job_failed" | "job_blocked" | "asset_bytes" | "estimated_cost_cents",
  quantity: number
) {
  return {
    id,
    ownerId: "local-user",
    metric,
    quantity,
    projectId: "project_remote",
    jobId: "job_usage",
    createdAt: "2026-06-08T00:05:00.000Z"
  };
}

function createBillingPlans() {
  return [
    createBillingPlan({ id: "free", name: "Free", priceCents: 0, dailyJobLimit: 20, dailyImageJobLimit: 2 }),
    createBillingPlan({ id: "pro", name: "Pro", priceCents: 1900, dailyJobLimit: 1000, dailyImageJobLimit: 100 }),
    createBillingPlan({ id: "studio", name: "Studio", priceCents: 9900, dailyJobLimit: 10000, dailyImageJobLimit: 1000 })
  ];
}

function createBillingPlan(input: {
  id: string;
  name: string;
  priceCents: number;
  dailyJobLimit: number;
  dailyImageJobLimit: number;
}) {
  return {
    id: input.id,
    name: input.name,
    description: `${input.name} production plan`,
    priceCents: input.priceCents,
    currency: "USD",
    interval: "month",
    dailyJobLimit: input.dailyJobLimit,
    dailyTextJobLimit: Math.max(1, Math.floor(input.dailyJobLimit / 2)),
    dailyImageJobLimit: input.dailyImageJobLimit,
    active: true,
    createdAt: "2026-06-08T00:00:00.000Z",
    updatedAt: "2026-06-08T00:00:00.000Z"
  };
}

function createBillingSubscription(input: { planId: string; status: "active" | "cancelled" }) {
  return {
    id: "subscription_1",
    ownerId: "local-user",
    planId: input.planId,
    status: input.status,
    currentPeriodStart: "2026-06-08T00:00:00.000Z",
    currentPeriodEnd: "2026-07-08T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    createdAt: "2026-06-08T00:00:00.000Z",
    updatedAt: "2026-06-08T00:05:00.000Z",
    cancelledAt: input.status === "cancelled" ? "2026-06-08T00:06:00.000Z" : undefined
  };
}

function createBillingCheckoutSession(input: {
  id?: string;
  planId?: string;
  status: "created" | "completed";
  checkoutUrl?: string;
}) {
  return {
    id: input.id ?? "checkout_1",
    ownerId: "local-user",
    planId: input.planId ?? "pro",
    status: input.status,
    checkoutUrl: input.checkoutUrl ?? "https://billing.local/checkout/checkout_1",
    successUrl: "https://studio.example.com/billing/success",
    cancelUrl: "https://studio.example.com/billing/cancel",
    externalSessionId: `mock_${input.id ?? "checkout_1"}`,
    createdAt: "2026-06-08T00:00:00.000Z",
    updatedAt: "2026-06-08T00:05:00.000Z",
    completedAt: input.status === "completed" ? "2026-06-08T00:05:00.000Z" : undefined,
    expiresAt: "2026-06-08T00:30:00.000Z"
  };
}

function createBillingEvent() {
  return {
    id: "billing_event_1",
    ownerId: "local-user",
    provider: "stripe",
    eventType: "invoice_paid",
    externalEventId: "evt_invoice_paid",
    subscriptionId: "subscription_1",
    externalCustomerId: "cus_test_123",
    externalSubscriptionId: "sub_test_123",
    externalInvoiceId: "in_test_123",
    amountDueCents: 1900,
    amountPaidCents: 1900,
    currency: "USD",
    status: "paid",
    hostedInvoiceUrl: "https://invoice.stripe.test/in_test_123",
    occurredAt: "2026-06-08T00:10:00.000Z",
    createdAt: "2026-06-08T00:11:00.000Z"
  };
}

function createRefundBillingEvent() {
  return {
    id: "billing_event_2",
    ownerId: "local-user",
    provider: "stripe",
    eventType: "refund_created",
    externalEventId: "evt_refund_created",
    subscriptionId: "subscription_1",
    externalCustomerId: "cus_test_123",
    externalSubscriptionId: "sub_test_123",
    externalChargeId: "ch_test_123",
    amountRefundedCents: 900,
    currency: "USD",
    status: "succeeded",
    occurredAt: "2026-06-08T00:12:00.000Z",
    createdAt: "2026-06-08T00:13:00.000Z"
  };
}

function createReleaseDiff() {
  return {
    projectId: "project_remote",
    baseRelease: {
      id: "release_1",
      version: 1,
      createdAt: "2026-06-07T00:00:00.000Z"
    },
    baseUnavailable: false,
    changed: true,
    current: {
      fingerprint: "current",
      title: "实验室里的蓝光",
      chapterCount: 1,
      sceneCount: 1,
      shotCount: 1,
      beatCount: 9,
      characterCount: 3,
      assetCount: 8,
      cgBeatCount: 1
    },
    published: {
      fingerprint: "published",
      title: "实验室里的蓝光",
      chapterCount: 1,
      sceneCount: 1,
      shotCount: 1,
      beatCount: 9,
      characterCount: 3,
      assetCount: 8,
      cgBeatCount: 1
    },
    totals: {
      addedBeats: 0,
      removedBeats: 0,
      changedBeats: 1,
      addedAssets: 0,
      removedAssets: 0,
      changedAssets: 0,
      addedCharacters: 0,
      removedCharacters: 0,
      changedCharacters: 0
    },
    beatChanges: [
      {
        id: "beat_1",
        kind: "changed",
        label: "第一章 实验室里的蓝光 / 实验室 / shot_1",
        previous: "实验室里只剩下显示器的蓝光。",
        current: "实验室里的蓝光变得刺眼。"
      }
    ],
    assetChanges: [],
    characterChanges: []
  };
}

function createUserAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "user_editor",
    email: "editor@example.com",
    name: "Editor",
    createdAt: "2026-06-08T00:00:00.000Z",
    updatedAt: "2026-06-08T00:00:00.000Z",
    ...overrides
  };
}

function createUserSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session_1",
    userId: "user_editor",
    tokenPrefix: "vns_",
    createdAt: "2026-06-08T00:00:00.000Z",
    updatedAt: "2026-06-08T00:00:00.000Z",
    ...overrides
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}
