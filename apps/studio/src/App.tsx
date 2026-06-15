import { useEffect, useMemo, useRef, useState } from "react";
import {
  resolveBeats,
  sampleNovelText,
  type VNAsset,
  type VNProject
} from "@agentic-galgame/vn-core";
import { createProjectFromNovel } from "@agentic-galgame/vn-agent";
import { loadProjectFromJson } from "@agentic-galgame/vn-runtime";
import { BeatTree } from "./components/BeatTree";
import { Inspector } from "./components/Inspector";
import { NovelImportPanel } from "./components/NovelImportPanel";
import { StudioToolbar } from "./components/StudioToolbar";
import { AssetGenerationPanel } from "./components/AssetGenerationPanel";
import { ReleaseDiffPanel } from "./components/ReleaseDiffPanel";
import { ReleaseApprovalPanel } from "./components/ReleaseApprovalPanel";
import { NotificationDeliveryPanel } from "./components/NotificationDeliveryPanel";
import { OperationsSummaryPanel } from "./components/OperationsSummaryPanel";
import { AuditLogPanel } from "./components/AuditLogPanel";
import { ContentSafetyPanel } from "./components/ContentSafetyPanel";
import { AccessTokenPanel } from "./components/AccessTokenPanel";
import { UsageBillingPanel } from "./components/UsageBillingPanel";
import { BillingPanel } from "./components/BillingPanel";
import { TeamInvitationPanel } from "./components/TeamInvitationPanel";
import { AccountPanel } from "./components/AccountPanel";
import { RuntimePreview, type RuntimePreviewHandle } from "./runtime-preview/RuntimePreview";
import {
  createBeatTree,
  findBeat,
  updateProjectTitle
} from "./studio/projectEditing";
import { downloadJson, downloadStaticPlayable } from "./studio/exportUtils";
import {
  createProductionApiClient,
  readStudioAssetJobConfig,
  type ProductionJobRecord,
  type ProductionAuditEventRecord,
  type ProductionAccessTokenRecord,
  type ProductionBillingCheckoutSessionRecord,
  type ProductionBillingEventRecord,
  type ProductionBillingPlanRecord,
  type ProductionBillingSubscriptionRecord,
  type ProductionContentSafetyReviewRecord,
  type ProductionMfaTotpSetup,
  type ProductionNotificationDeliveryRecord,
  type ProductionOperationsSummary,
  type ProductionOAuthStartResult,
  type ProductionReleaseApprovalCommentRecord,
  type ProductionReleaseDiff,
  type ProductionReleaseApprovalRecord,
  type ProductionTeamInvitationRecord,
  type ProductionUsageEventRecord,
  type ProductionUsageSummary,
  type ProductionUserAccountRecord,
  type ProductionUserSessionRecord
} from "./studio/productionApi";

const LOCAL_PROJECT_KEY = "agentic-galgame-studio:project";
const LOCAL_NOVEL_KEY = "agentic-galgame-studio:novel";
const LOCAL_OWNER_KEY = "agentic-galgame-studio:owner";
const LOCAL_ACCOUNT_SESSION_KEY = "agentic-galgame-studio:account-session";
const LOCAL_MFA_DEVICE_KEY = "agentic-galgame-studio:mfa-device-token";

export function App() {
  const previewRef = useRef<RuntimePreviewHandle | null>(null);
  const [accountSessionToken, setAccountSessionToken] = useState<string | undefined>(() =>
    localStorage.getItem(LOCAL_ACCOUNT_SESSION_KEY) ?? undefined
  );
  const apiClient = useMemo(() => createProductionApiClient(accountSessionToken), [accountSessionToken]);
  const assetJobConfig = useMemo(() => readStudioAssetJobConfig(), []);
  const [novelText, setNovelText] = useState(sampleNovelText);
  const [project, setProject] = useState<VNProject>(() =>
    createProjectFromNovel({
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    })
  );
  const [ownerId, setOwnerId] = useState(() => localStorage.getItem(LOCAL_OWNER_KEY) ?? "local-user");
  const [remoteProjectId, setRemoteProjectId] = useState<string | undefined>();
  const [releaseApprovals, setReleaseApprovals] = useState<ProductionReleaseApprovalRecord[]>([]);
  const [approvalComments, setApprovalComments] = useState<Record<string, ProductionReleaseApprovalCommentRecord[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(false);
  const [loadingCommentsApprovalId, setLoadingCommentsApprovalId] = useState<string | undefined>();
  const [releaseDiff, setReleaseDiff] = useState<ProductionReleaseDiff | undefined>();
  const [isLoadingReleaseDiff, setIsLoadingReleaseDiff] = useState(false);
  const [notificationDeliveries, setNotificationDeliveries] = useState<ProductionNotificationDeliveryRecord[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [isRunningNotification, setIsRunningNotification] = useState(false);
  const [operationsSummary, setOperationsSummary] = useState<ProductionOperationsSummary | undefined>();
  const [isLoadingOperations, setIsLoadingOperations] = useState(false);
  const [auditEvents, setAuditEvents] = useState<ProductionAuditEventRecord[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [contentSafetyReviews, setContentSafetyReviews] = useState<ProductionContentSafetyReviewRecord[]>([]);
  const [isLoadingContentSafety, setIsLoadingContentSafety] = useState(false);
  const [isReviewingProjectSafety, setIsReviewingProjectSafety] = useState(false);
  const [accessTokens, setAccessTokens] = useState<ProductionAccessTokenRecord[]>([]);
  const [isLoadingAccessTokens, setIsLoadingAccessTokens] = useState(false);
  const [isCreatingAccessToken, setIsCreatingAccessToken] = useState(false);
  const [accessTokenLabel, setAccessTokenLabel] = useState("Studio owner token");
  const [accessTokenExpiresAt, setAccessTokenExpiresAt] = useState("");
  const [lastCreatedAccessToken, setLastCreatedAccessToken] = useState<string | undefined>();
  const [usageSummary, setUsageSummary] = useState<ProductionUsageSummary | undefined>();
  const [usageEvents, setUsageEvents] = useState<ProductionUsageEventRecord[]>([]);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [billingPlans, setBillingPlans] = useState<ProductionBillingPlanRecord[]>([]);
  const [billingSubscription, setBillingSubscription] = useState<ProductionBillingSubscriptionRecord | undefined>();
  const [billingCheckoutSessions, setBillingCheckoutSessions] = useState<ProductionBillingCheckoutSessionRecord[]>([]);
  const [billingEvents, setBillingEvents] = useState<ProductionBillingEventRecord[]>([]);
  const [selectedBillingPlanId, setSelectedBillingPlanId] = useState("pro");
  const [lastBillingCheckoutUrl, setLastBillingCheckoutUrl] = useState<string | undefined>();
  const [lastBillingPortalUrl, setLastBillingPortalUrl] = useState<string | undefined>();
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);
  const [isStartingBillingCheckout, setIsStartingBillingCheckout] = useState(false);
  const [isStartingBillingPortal, setIsStartingBillingPortal] = useState(false);
  const [isCancellingBilling, setIsCancellingBilling] = useState(false);
  const [teamInvitations, setTeamInvitations] = useState<ProductionTeamInvitationRecord[]>([]);
  const [isLoadingTeamInvitations, setIsLoadingTeamInvitations] = useState(false);
  const [isCreatingTeamInvitation, setIsCreatingTeamInvitation] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ProductionTeamInvitationRecord["role"]>("editor");
  const [inviteUserId, setInviteUserId] = useState("");
  const [acceptInvitationToken, setAcceptInvitationToken] = useState("");
  const [acceptInvitationUserId, setAcceptInvitationUserId] = useState("");
  const [lastInvitationToken, setLastInvitationToken] = useState<string | undefined>();
  const [currentUser, setCurrentUser] = useState<ProductionUserAccountRecord | undefined>();
  const [accountSessions, setAccountSessions] = useState<ProductionUserSessionRecord[]>([]);
  const [isLoadingAccountSessions, setIsLoadingAccountSessions] = useState(false);
  const [mfaTotpSetup, setMfaTotpSetup] = useState<ProductionMfaTotpSetup | undefined>();
  const [mfaRecoveryCodes, setMfaRecoveryCodes] = useState<string[]>([]);
  const [mfaDeviceToken, setMfaDeviceToken] = useState<string | undefined>(() =>
    localStorage.getItem(LOCAL_MFA_DEVICE_KEY) ?? undefined
  );
  const [oauthStart, setOauthStart] = useState<ProductionOAuthStartResult | undefined>();
  const [isAccountLoading, setIsAccountLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState("Sample loaded");
  const [isGeneratingAssets, setIsGeneratingAssets] = useState(false);

  const compiledBeats = useMemo(() => resolveBeats(project), [project]);
  const beatTree = useMemo(() => createBeatTree(compiledBeats), [compiledBeats]);
  const placeholderImageAssets = useMemo(
    () => project.assets.items.filter(isGeneratablePlaceholderAsset),
    [project]
  );
  const activeCompiledBeat = compiledBeats[activeIndex] ?? compiledBeats[0];
  const activeBeat = activeCompiledBeat ? findBeat(project, activeCompiledBeat.beatId) : undefined;

  useEffect(() => {
    if (activeIndex >= compiledBeats.length) {
      setActiveIndex(Math.max(0, compiledBeats.length - 1));
    }
  }, [activeIndex, compiledBeats.length]);

  const loadSample = () => {
    const nextProject = createProjectFromNovel({
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    });
    setNovelText(sampleNovelText);
    setProject(nextProject);
    setRemoteProjectId(undefined);
    setReleaseApprovals([]);
    setApprovalComments({});
    setCommentDrafts({});
    setReleaseDiff(undefined);
    setNotificationDeliveries([]);
    setOperationsSummary(undefined);
    setAuditEvents([]);
    setContentSafetyReviews([]);
    setAccessTokens([]);
    setLastCreatedAccessToken(undefined);
    setUsageSummary(undefined);
    setUsageEvents([]);
    setBillingPlans([]);
    setBillingSubscription(undefined);
    setBillingCheckoutSessions([]);
    setLastBillingCheckoutUrl(undefined);
    setTeamInvitations([]);
    setLastInvitationToken(undefined);
    setReviewNotes("");
    setActiveIndex(0);
    setStatus("Sample loaded");
  };

  const generateProject = () => {
    try {
      const nextProject = createProjectFromNovel({
        title: project.title || "导入小说",
        novelText
      });
      setProject(nextProject);
      setRemoteProjectId(undefined);
      setReleaseApprovals([]);
      setApprovalComments({});
      setCommentDrafts({});
      setReleaseDiff(undefined);
      setNotificationDeliveries([]);
      setOperationsSummary(undefined);
      setAuditEvents([]);
      setContentSafetyReviews([]);
      setAccessTokens([]);
      setLastCreatedAccessToken(undefined);
      setUsageSummary(undefined);
      setUsageEvents([]);
      setBillingPlans([]);
      setBillingSubscription(undefined);
      setBillingCheckoutSessions([]);
      setLastBillingCheckoutUrl(undefined);
      setTeamInvitations([]);
      setLastInvitationToken(undefined);
      setReviewNotes("");
      setActiveIndex(0);
      setStatus(`Generated ${resolveBeats(nextProject).length} beats`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Generate failed");
    }
  };

  const saveLocal = () => {
    localStorage.setItem(LOCAL_PROJECT_KEY, JSON.stringify(project));
    localStorage.setItem(LOCAL_NOVEL_KEY, novelText);
    localStorage.setItem(LOCAL_OWNER_KEY, ownerId);
    setStatus("Saved locally");
  };

  const loadLocal = () => {
    const rawProject = localStorage.getItem(LOCAL_PROJECT_KEY);
    if (!rawProject) {
      setStatus("No local save");
      return;
    }
    try {
      setProject(loadProjectFromJson(rawProject));
      setNovelText(localStorage.getItem(LOCAL_NOVEL_KEY) ?? novelText);
      setOwnerId(localStorage.getItem(LOCAL_OWNER_KEY) ?? ownerId);
      setRemoteProjectId(undefined);
      setReleaseApprovals([]);
      setApprovalComments({});
      setCommentDrafts({});
      setReleaseDiff(undefined);
      setNotificationDeliveries([]);
      setOperationsSummary(undefined);
      setAuditEvents([]);
      setContentSafetyReviews([]);
      setAccessTokens([]);
      setLastCreatedAccessToken(undefined);
      setUsageSummary(undefined);
      setUsageEvents([]);
      setBillingPlans([]);
      setBillingSubscription(undefined);
      setBillingCheckoutSessions([]);
      setLastBillingCheckoutUrl(undefined);
      setTeamInvitations([]);
      setLastInvitationToken(undefined);
      setReviewNotes("");
      setActiveIndex(0);
      setStatus("Loaded local save");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Load failed");
    }
  };

  const refreshReleaseApprovals = async (
    projectId = remoteProjectId,
    options: { silent?: boolean } = {}
  ) => {
    if (!apiClient.enabled) {
      setReleaseApprovals([]);
      if (!options.silent) {
        setStatus("Production API is not configured");
      }
      return;
    }
    if (!projectId) {
      setReleaseApprovals([]);
      if (!options.silent) {
        setStatus("Save API project before loading approvals");
      }
      return;
    }
    setIsLoadingApprovals(true);
    try {
      const approvals = await apiClient.listReleaseApprovals(projectId);
      setReleaseApprovals(approvals);
      setApprovalComments((current) => keepKnownApprovalComments(current, approvals));
      setCommentDrafts((current) => keepKnownApprovalDrafts(current, approvals));
      if (!options.silent) {
        setStatus(`Loaded ${approvals.length} release approvals`);
      }
    } catch (error) {
      if (!options.silent) {
        setStatus(error instanceof Error ? error.message : "Release approval list failed");
      }
    } finally {
      setIsLoadingApprovals(false);
    }
  };

  const refreshApprovalComments = async (
    approvalId: string,
    options: { silent?: boolean } = {}
  ) => {
    if (!apiClient.enabled) {
      if (!options.silent) {
        setStatus("Production API is not configured");
      }
      return;
    }
    setLoadingCommentsApprovalId(approvalId);
    try {
      const comments = await apiClient.listReleaseApprovalComments(approvalId);
      setApprovalComments((current) => ({
        ...current,
        [approvalId]: comments
      }));
      if (!options.silent) {
        setStatus(`Loaded ${comments.length} approval comments`);
      }
    } catch (error) {
      if (!options.silent) {
        setStatus(error instanceof Error ? error.message : "Approval comments load failed");
      }
    } finally {
      setLoadingCommentsApprovalId(undefined);
    }
  };

  const addApprovalComment = async (approvalId: string) => {
    const body = (commentDrafts[approvalId] ?? "").trim();
    if (!body) {
      return;
    }
    try {
      const comment = await apiClient.addReleaseApprovalComment(approvalId, body);
      setApprovalComments((current) => ({
        ...current,
        [approvalId]: [...(current[approvalId] ?? []), comment]
      }));
      setCommentDrafts((current) => ({
        ...current,
        [approvalId]: ""
      }));
      setStatus(`Added approval comment: ${comment.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Approval comment failed");
    }
  };

  const refreshReleaseDiff = async (
    projectId = remoteProjectId,
    options: { silent?: boolean } = {}
  ) => {
    if (!apiClient.enabled) {
      setReleaseDiff(undefined);
      if (!options.silent) {
        setStatus("Production API is not configured");
      }
      return;
    }
    if (!projectId) {
      setReleaseDiff(undefined);
      if (!options.silent) {
        setStatus("Save API project before loading release diff");
      }
      return;
    }
    setIsLoadingReleaseDiff(true);
    try {
      const diff = await apiClient.getReleaseDiff(projectId);
      setReleaseDiff(diff);
      if (!options.silent) {
        const base = diff.baseRelease ? `release v${diff.baseRelease.version}` : "no published release";
        setStatus(diff.changed ? `Loaded release diff vs ${base}` : `No release diff vs ${base}`);
      }
    } catch (error) {
      if (!options.silent) {
        setStatus(error instanceof Error ? error.message : "Release diff load failed");
      }
    } finally {
      setIsLoadingReleaseDiff(false);
    }
  };

  const refreshNotificationDeliveries = async (
    currentOwnerId = ownerId,
    options: { silent?: boolean } = {}
  ) => {
    if (!apiClient.enabled) {
      setNotificationDeliveries([]);
      if (!options.silent) {
        setStatus("Production API is not configured");
      }
      return;
    }
    if (!currentOwnerId.trim()) {
      setNotificationDeliveries([]);
      if (!options.silent) {
        setStatus("Owner ID is required before loading notifications");
      }
      return;
    }
    setIsLoadingNotifications(true);
    try {
      const deliveries = await apiClient.listNotificationDeliveries(currentOwnerId);
      setNotificationDeliveries(deliveries);
      if (!options.silent) {
        setStatus(`Loaded ${deliveries.length} notification deliveries`);
      }
    } catch (error) {
      if (!options.silent) {
        setStatus(error instanceof Error ? error.message : "Notification delivery list failed");
      }
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const refreshOperationsSummary = async (
    currentOwnerId = ownerId,
    options: { silent?: boolean } = {}
  ) => {
    if (!apiClient.enabled) {
      setOperationsSummary(undefined);
      if (!options.silent) {
        setStatus("Production API is not configured");
      }
      return;
    }
    if (!currentOwnerId.trim()) {
      setOperationsSummary(undefined);
      if (!options.silent) {
        setStatus("Owner ID is required before loading operations");
      }
      return;
    }
    setIsLoadingOperations(true);
    try {
      const summary = await apiClient.getOperationsSummary(currentOwnerId);
      setOperationsSummary(summary);
      if (!options.silent) {
        setStatus(`Loaded operations summary: ${summary.status}`);
      }
    } catch (error) {
      if (!options.silent) {
        setStatus(error instanceof Error ? error.message : "Operations summary load failed");
      }
    } finally {
      setIsLoadingOperations(false);
    }
  };

  const refreshUsageSummary = async (
    currentOwnerId = ownerId,
    options: { silent?: boolean } = {}
  ) => {
    if (!apiClient.enabled) {
      setUsageSummary(undefined);
      setUsageEvents([]);
      if (!options.silent) {
        setStatus("Production API is not configured");
      }
      return;
    }
    if (!currentOwnerId.trim()) {
      setUsageSummary(undefined);
      setUsageEvents([]);
      if (!options.silent) {
        setStatus("Owner ID is required before loading usage");
      }
      return;
    }
    setIsLoadingUsage(true);
    try {
      const result = await apiClient.getUsageSummary(currentOwnerId);
      setUsageSummary(result.usage);
      setUsageEvents(result.events);
      if (!options.silent) {
        setStatus(`Loaded usage: ${result.usage.jobEnqueued} jobs / ${result.usage.estimatedCostCents} cents`);
      }
    } catch (error) {
      if (!options.silent) {
        setStatus(error instanceof Error ? error.message : "Usage summary load failed");
      }
    } finally {
      setIsLoadingUsage(false);
    }
  };

  const refreshBilling = async (
    currentOwnerId = ownerId,
    options: { silent?: boolean } = {}
  ) => {
    if (!apiClient.enabled) {
      setBillingPlans([]);
      setBillingSubscription(undefined);
      setBillingCheckoutSessions([]);
      setBillingEvents([]);
      if (!options.silent) {
        setStatus("Production API is not configured");
      }
      return;
    }
    if (!currentOwnerId.trim()) {
      setBillingSubscription(undefined);
      setBillingCheckoutSessions([]);
      setBillingEvents([]);
      if (!options.silent) {
        setStatus("Owner ID is required before loading billing");
      }
      return;
    }
    setIsLoadingBilling(true);
    try {
      const [plans, subscription, checkoutSessions, events] = await Promise.all([
        apiClient.listBillingPlans(),
        apiClient.getBillingSubscription(currentOwnerId),
        apiClient.listBillingCheckoutSessions(currentOwnerId),
        apiClient.listBillingEvents(currentOwnerId)
      ]);
      setBillingPlans(plans);
      setBillingSubscription(subscription);
      setBillingCheckoutSessions(checkoutSessions);
      setBillingEvents(events);
      if (!plans.some((plan) => plan.id === selectedBillingPlanId)) {
        setSelectedBillingPlanId(subscription?.planId ?? plans.find((plan) => plan.id === "pro")?.id ?? plans[0]?.id ?? "");
      }
      if (!options.silent) {
        setStatus(subscription ? `Loaded billing: ${subscription.planId} / ${subscription.status}` : `Loaded ${plans.length} billing plans`);
      }
    } catch (error) {
      if (!options.silent) {
        setStatus(error instanceof Error ? error.message : "Billing refresh failed");
      }
    } finally {
      setIsLoadingBilling(false);
    }
  };

  const startBillingCheckout = async () => {
    if (!apiClient.enabled || isStartingBillingCheckout) {
      return;
    }
    const planId = selectedBillingPlanId || billingPlans[0]?.id;
    if (!planId) {
      setStatus("Load billing plans before checkout");
      return;
    }
    setIsStartingBillingCheckout(true);
    try {
      const session = await apiClient.startBillingCheckout({
        ownerId,
        planId,
        successUrl: `${window.location.origin}/billing/success`,
        cancelUrl: `${window.location.origin}/billing/cancel`
      });
      setLastBillingCheckoutUrl(session.checkoutUrl);
      setBillingCheckoutSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
      const subscription = await apiClient.getBillingSubscription(ownerId);
      setBillingSubscription(subscription);
      await refreshAuditEvents(ownerId, { silent: true });
      setStatus(`Started billing checkout: ${session.status}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Billing checkout failed");
    } finally {
      setIsStartingBillingCheckout(false);
    }
  };

  const cancelBillingSubscription = async () => {
    if (!apiClient.enabled || isCancellingBilling) {
      return;
    }
    setIsCancellingBilling(true);
    try {
      const subscription = await apiClient.cancelBillingSubscription(ownerId);
      setBillingSubscription(subscription);
      await refreshAuditEvents(ownerId, { silent: true });
      setStatus(`Cancelled billing subscription: ${subscription.planId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Billing cancel failed");
    } finally {
      setIsCancellingBilling(false);
    }
  };

  const createBillingPaymentMethodSession = async () => {
    if (!apiClient.enabled || isStartingBillingPortal) {
      return;
    }
    if (!billingSubscription) {
      setStatus("Load billing subscription before updating payment method");
      return;
    }
    setIsStartingBillingPortal(true);
    try {
      const session = await apiClient.createBillingPaymentMethodSession({
        ownerId,
        returnUrl: `${window.location.origin}/billing/payment-method`
      });
      setLastBillingPortalUrl(session.portalUrl);
      await refreshAuditEvents(ownerId, { silent: true });
      setStatus(`Payment method update link ready: ${session.provider}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Payment method update failed");
    } finally {
      setIsStartingBillingPortal(false);
    }
  };

  const refreshAuditEvents = async (
    currentOwnerId = ownerId,
    options: { silent?: boolean } = {}
  ) => {
    if (!apiClient.enabled) {
      setAuditEvents([]);
      if (!options.silent) {
        setStatus("Production API is not configured");
      }
      return;
    }
    if (!currentOwnerId.trim()) {
      setAuditEvents([]);
      if (!options.silent) {
        setStatus("Owner ID is required before loading audit events");
      }
      return;
    }
    setIsLoadingAudit(true);
    try {
      const events = await apiClient.listAuditEvents(currentOwnerId);
      setAuditEvents(events);
      if (!options.silent) {
        setStatus(`Loaded ${events.length} audit events`);
      }
    } catch (error) {
      if (!options.silent) {
        setStatus(error instanceof Error ? error.message : "Audit event list failed");
      }
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const refreshContentSafetyReviews = async (
    currentOwnerId = ownerId,
    options: { silent?: boolean } = {}
  ) => {
    if (!apiClient.enabled) {
      setContentSafetyReviews([]);
      if (!options.silent) {
        setStatus("Production API is not configured");
      }
      return;
    }
    if (!currentOwnerId.trim()) {
      setContentSafetyReviews([]);
      if (!options.silent) {
        setStatus("Owner ID is required before loading content safety reviews");
      }
      return;
    }
    setIsLoadingContentSafety(true);
    try {
      const reviews = await apiClient.listContentSafetyReviews(currentOwnerId);
      setContentSafetyReviews(reviews);
      if (!options.silent) {
        setStatus(`Loaded ${reviews.length} content safety reviews`);
      }
    } catch (error) {
      if (!options.silent) {
        setStatus(error instanceof Error ? error.message : "Content safety review list failed");
      }
    } finally {
      setIsLoadingContentSafety(false);
    }
  };

  const reviewCurrentProjectSafety = async () => {
    if (!apiClient.enabled || isReviewingProjectSafety) {
      return;
    }
    setIsReviewingProjectSafety(true);
    try {
      const savedProject = await apiClient.saveProject({
        id: remoteProjectId,
        ownerId,
        title: project.title,
        vnProject: project
      });
      setRemoteProjectId(savedProject.id);
      const review = await apiClient.reviewContentSafety({
        ownerId,
        source: "project_json",
        text: JSON.stringify(savedProject.vnProject),
        targetType: "project",
        targetId: savedProject.id,
        metadata: {
          title: savedProject.title,
          beatCount: compiledBeats.length
        }
      });
      setContentSafetyReviews((current) => [review, ...current.filter((item) => item.id !== review.id)]);
      await refreshOperationsSummary(ownerId, { silent: true });
      setStatus(`Project safety review: ${review.decision}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Content safety review failed");
    } finally {
      setIsReviewingProjectSafety(false);
    }
  };

  const refreshAccessTokens = async (
    currentOwnerId = ownerId,
    options: { silent?: boolean } = {}
  ) => {
    if (!apiClient.enabled) {
      setAccessTokens([]);
      if (!options.silent) {
        setStatus("Production API is not configured");
      }
      return;
    }
    if (!currentOwnerId.trim()) {
      setAccessTokens([]);
      if (!options.silent) {
        setStatus("Owner ID is required before loading access tokens");
      }
      return;
    }
    setIsLoadingAccessTokens(true);
    try {
      const tokens = await apiClient.listAccessTokens(currentOwnerId);
      setAccessTokens(tokens);
      if (!options.silent) {
        setStatus(`Loaded ${tokens.length} access tokens`);
      }
    } catch (error) {
      if (!options.silent) {
        setStatus(error instanceof Error ? error.message : "Access token list failed");
      }
    } finally {
      setIsLoadingAccessTokens(false);
    }
  };

  const createOwnerAccessToken = async () => {
    if (!apiClient.enabled || isCreatingAccessToken) {
      return;
    }
    setIsCreatingAccessToken(true);
    try {
      const created = await apiClient.createOwnerAccessToken({
        ownerId,
        label: accessTokenLabel.trim() || undefined,
        expiresAt: accessTokenExpiresAt.trim() || undefined
      });
      setLastCreatedAccessToken(created.token);
      setAccessTokens((current) => [created.accessToken, ...current.filter((token) => token.id !== created.accessToken.id)]);
      await refreshAuditEvents(ownerId, { silent: true });
      setStatus(`Created owner access token: ${created.accessToken.tokenPrefix}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Access token create failed");
    } finally {
      setIsCreatingAccessToken(false);
    }
  };

  const revokeAccessToken = async (tokenId: string) => {
    try {
      const revoked = await apiClient.revokeAccessToken(tokenId);
      setAccessTokens((current) => current.map((token) => (token.id === revoked.id ? revoked : token)));
      await refreshAuditEvents(ownerId, { silent: true });
      setStatus(`Revoked access token: ${revoked.tokenPrefix}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Access token revoke failed");
    }
  };

  const refreshTeamInvitations = async (
    teamId = ownerId,
    options: { silent?: boolean } = {}
  ) => {
    if (!apiClient.enabled) {
      setTeamInvitations([]);
      if (!options.silent) {
        setStatus("Production API is not configured");
      }
      return;
    }
    if (!teamId.trim()) {
      setTeamInvitations([]);
      if (!options.silent) {
        setStatus("Owner ID is required before loading invitations");
      }
      return;
    }
    setIsLoadingTeamInvitations(true);
    try {
      const invitations = await apiClient.listTeamInvitations(teamId);
      setTeamInvitations(invitations);
      if (!options.silent) {
        setStatus(`Loaded ${invitations.length} team invitations`);
      }
    } catch (error) {
      if (!options.silent) {
        setStatus(error instanceof Error ? error.message : "Team invitation list failed");
      }
    } finally {
      setIsLoadingTeamInvitations(false);
    }
  };

  const createTeamInvitation = async () => {
    if (!apiClient.enabled || isCreatingTeamInvitation) {
      return;
    }
    setIsCreatingTeamInvitation(true);
    try {
      const created = await apiClient.createTeamInvitation({
        teamId: ownerId,
        email: inviteEmail,
        role: inviteRole,
        invitedUserId: inviteUserId.trim() || undefined
      });
      setTeamInvitations((current) => [created.invitation, ...current.filter((item) => item.id !== created.invitation.id)]);
      setLastInvitationToken(created.invitationToken);
      setInviteEmail("");
      await refreshOperationsSummary(ownerId, { silent: true });
      setStatus(`Created team invitation: ${created.invitation.email}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Team invitation create failed");
    } finally {
      setIsCreatingTeamInvitation(false);
    }
  };

  const revokeTeamInvitation = async (invitationId: string) => {
    try {
      const revoked = await apiClient.revokeTeamInvitation(invitationId);
      setTeamInvitations((current) => current.map((invitation) =>
        invitation.id === revoked.id ? revoked : invitation
      ));
      await refreshOperationsSummary(ownerId, { silent: true });
      setStatus(`Revoked team invitation: ${revoked.email}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Team invitation revoke failed");
    }
  };

  const acceptTeamInvitation = async () => {
    try {
      const accepted = await apiClient.acceptTeamInvitation(
        acceptInvitationToken,
        acceptInvitationUserId.trim() || undefined
      );
      setAcceptInvitationToken("");
      setTeamInvitations((current) => current.map((invitation) =>
        invitation.id === accepted.invitation.id ? accepted.invitation : invitation
      ));
      await refreshTeamInvitations(ownerId, { silent: true });
      await refreshOperationsSummary(ownerId, { silent: true });
      setStatus(`Accepted invite for ${accepted.member.userId} as ${accepted.member.role}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Team invitation accept failed");
    }
  };

  const registerAccount = async (input: { email: string; password: string; name?: string }) => {
    await runAccountAction(async () => {
      const created = await apiClient.registerUser(input);
      storeAccountSession(created.sessionToken, created.user);
      setAcceptInvitationUserId(created.user.id);
      setMfaTotpSetup(undefined);
      setMfaRecoveryCodes([]);
      setStatus(`Registered account: ${created.user.email}`);
    }, "Account registration failed");
  };

  const loginAccount = async (input: {
    email: string;
    password: string;
    mfaCode?: string;
    rememberMfaDevice?: boolean;
  }) => {
    await runAccountAction(async () => {
      const loggedIn = await apiClient.loginUser({
        ...input,
        mfaDeviceToken
      });
      if ("mfaRequired" in loggedIn) {
        setMfaRecoveryCodes([]);
        setStatus("MFA code required");
        return;
      }
      storeAccountSession(loggedIn.sessionToken, loggedIn.user);
      if (loggedIn.mfaDeviceToken) {
        storeMfaDeviceToken(loggedIn.mfaDeviceToken);
      }
      setAcceptInvitationUserId(loggedIn.user.id);
      setMfaTotpSetup(undefined);
      setMfaRecoveryCodes([]);
      setStatus(`Logged in: ${loggedIn.user.email}`);
    }, "Account login failed");
  };

  const startOAuthLogin = async (input: { returnUrl?: string }) => {
    await runAccountAction(async () => {
      const started = await apiClient.startOAuthLogin(input);
      setOauthStart(started);
      setStatus(`SSO authorization started: ${started.provider}`);
    }, "SSO start failed");
  };

  const completeOAuthLogin = async (input: { state: string; code: string }) => {
    await runAccountAction(async () => {
      const completed = await apiClient.completeOAuthLogin(input);
      storeAccountSession(completed.sessionToken, completed.user);
      setAcceptInvitationUserId(completed.user.id);
      setOauthStart(undefined);
      setMfaTotpSetup(undefined);
      setMfaRecoveryCodes([]);
      setStatus(`SSO logged in: ${completed.user.email}`);
    }, "SSO callback failed");
  };

  const refreshAccount = async () => {
    await runAccountAction(async () => {
      const current = await apiClient.getCurrentUser();
      setCurrentUser(current.user);
      setMfaTotpSetup(undefined);
      setMfaRecoveryCodes([]);
      if (current.auth.role === "user") {
        setAcceptInvitationUserId(current.auth.userId);
        setStatus(current.user ? `Loaded account: ${current.user.email}` : `Loaded user: ${current.auth.userId}`);
      } else {
        setStatus(`Loaded auth role: ${current.auth.role}`);
      }
    }, "Account refresh failed");
  };

  const refreshAccountSessions = async () => {
    await runAccountAction(async () => {
      if (!accountSessionToken) {
        setAccountSessions([]);
        setStatus("Account session is required before loading sessions");
        return;
      }
      setIsLoadingAccountSessions(true);
      try {
        const sessions = await apiClient.listUserSessions();
        setAccountSessions(sessions);
        setStatus(`Loaded ${sessions.length} account sessions`);
      } finally {
        setIsLoadingAccountSessions(false);
      }
    }, "Account sessions refresh failed");
  };

  const revokeAccountSession = async (sessionId: string) => {
    await runAccountAction(async () => {
      const revoked = await apiClient.revokeUserSession(sessionId);
      setAccountSessions((current) => current.map((session) =>
        session.id === revoked.id ? revoked : session
      ));
      if (accountSessionToken && revoked.tokenPrefix === accountSessionToken.slice(0, 12)) {
        clearAccountSession();
      }
      setStatus(`Revoked account session: ${revoked.id}`);
    }, "Account session revoke failed");
  };

  const logoutAccount = async () => {
    await runAccountAction(async () => {
      const result = await apiClient.logoutUser();
      clearAccountSession();
      setStatus(result.revoked ? "Logged out" : "Local session cleared");
    }, "Account logout failed");
  };

  const requestAccountVerification = async () => {
    await runAccountAction(async () => {
      const requested = await apiClient.requestEmailVerification();
      setStatus(requested ? "Requested email verification" : "Email is already verified");
    }, "Email verification request failed");
  };

  const verifyAccountEmail = async (verificationToken: string) => {
    await runAccountAction(async () => {
      const user = await apiClient.verifyEmail(verificationToken);
      updateKnownUser(user);
      setStatus(`Verified email: ${user.email}`);
    }, "Email verification failed");
  };

  const requestAccountPasswordReset = async (email: string) => {
    await runAccountAction(async () => {
      await apiClient.requestPasswordReset(email);
      setStatus("Password reset requested");
    }, "Password reset request failed");
  };

  const confirmAccountPasswordReset = async (input: { resetToken: string; password: string }) => {
    await runAccountAction(async () => {
      const user = await apiClient.confirmPasswordReset(input.resetToken, input.password);
      updateKnownUser(user);
      if (currentUser?.id === user.id) {
        clearAccountSession();
      }
      setStatus(`Password reset completed: ${user.email}`);
    }, "Password reset confirm failed");
  };

  const startAccountMfaTotpSetup = async () => {
    await runAccountAction(async () => {
      const setup = await apiClient.startMfaTotpSetup();
      setMfaTotpSetup(setup);
      setMfaRecoveryCodes([]);
      updateKnownUser(setup.user);
      setStatus("MFA setup secret generated");
    }, "MFA setup failed");
  };

  const confirmAccountMfaTotpSetup = async (code: string) => {
    await runAccountAction(async () => {
      const confirmed = await apiClient.confirmMfaTotpSetup(code);
      setMfaTotpSetup(undefined);
      setMfaRecoveryCodes(confirmed.recoveryCodes);
      updateKnownUser(confirmed.user);
      setStatus(`MFA enabled: ${confirmed.user.email}. Recovery codes returned once.`);
    }, "MFA confirmation failed");
  };

  const disableAccountMfaTotp = async (input: { password: string; code?: string }) => {
    await runAccountAction(async () => {
      const user = await apiClient.disableMfaTotp(input);
      setMfaTotpSetup(undefined);
      setMfaRecoveryCodes([]);
      clearMfaDeviceToken();
      updateKnownUser(user);
      setStatus(`MFA disabled: ${user.email}`);
    }, "MFA disable failed");
  };

  const revokeAccountMfaTrustedDevices = async (input: { password: string; code?: string }) => {
    await runAccountAction(async () => {
      const user = await apiClient.revokeMfaTrustedDevices(input);
      clearMfaDeviceToken();
      updateKnownUser(user);
      setStatus(`MFA trusted devices revoked: ${user.email}`);
    }, "MFA trusted device revoke failed");
  };

  const regenerateAccountMfaRecoveryCodes = async (input: { password: string; code?: string }) => {
    await runAccountAction(async () => {
      const regenerated = await apiClient.regenerateMfaRecoveryCodes(input);
      setMfaTotpSetup(undefined);
      setMfaRecoveryCodes(regenerated.recoveryCodes);
      updateKnownUser(regenerated.user);
      setStatus(`MFA recovery codes regenerated: ${regenerated.user.email}`);
    }, "MFA recovery code regeneration failed");
  };

  const runAccountAction = async (action: () => Promise<void>, fallbackMessage: string) => {
    if (!apiClient.enabled) {
      setStatus("Production API is not configured");
      return;
    }
    setIsAccountLoading(true);
    try {
      await action();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : fallbackMessage);
    } finally {
      setIsAccountLoading(false);
    }
  };

  const storeAccountSession = (sessionToken: string, user: ProductionUserAccountRecord) => {
    localStorage.setItem(LOCAL_ACCOUNT_SESSION_KEY, sessionToken);
    setAccountSessionToken(sessionToken);
    setCurrentUser(user);
  };

  const storeMfaDeviceToken = (token: string) => {
    localStorage.setItem(LOCAL_MFA_DEVICE_KEY, token);
    setMfaDeviceToken(token);
  };

  const clearMfaDeviceToken = () => {
    localStorage.removeItem(LOCAL_MFA_DEVICE_KEY);
    setMfaDeviceToken(undefined);
  };

  const clearAccountSession = () => {
    localStorage.removeItem(LOCAL_ACCOUNT_SESSION_KEY);
    setAccountSessionToken(undefined);
    setCurrentUser(undefined);
    setAccountSessions([]);
    setMfaTotpSetup(undefined);
    setMfaRecoveryCodes([]);
    setOauthStart(undefined);
  };

  const updateKnownUser = (user: ProductionUserAccountRecord) => {
    setCurrentUser((current) => (current && current.id === user.id ? user : current));
  };

  const runNextNotificationDelivery = async () => {
    if (!apiClient.enabled || isRunningNotification) {
      return;
    }
    setIsRunningNotification(true);
    try {
      const delivery = await apiClient.runNextNotificationDelivery();
      await refreshNotificationDeliveries(ownerId, { silent: true });
      setStatus(delivery
        ? `Ran notification delivery: ${delivery.id} (${delivery.status})`
        : "No runnable notification deliveries");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Notification delivery run failed");
    } finally {
      setIsRunningNotification(false);
    }
  };

  const saveApi = async () => {
    try {
      const record = await apiClient.saveProject({
        id: remoteProjectId,
        ownerId,
        title: project.title,
        vnProject: project
      });
      setRemoteProjectId(record.id);
      localStorage.setItem(LOCAL_OWNER_KEY, ownerId);
      await refreshReleaseApprovals(record.id, { silent: true });
      await refreshOperationsSummary(ownerId, { silent: true });
      await refreshUsageSummary(ownerId, { silent: true });
      await refreshBilling(ownerId, { silent: true });
      await refreshContentSafetyReviews(ownerId, { silent: true });
      setReleaseDiff(undefined);
      setStatus(`Saved to API: ${record.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "API save failed");
    }
  };

  const loadApi = async () => {
    try {
      const [record] = await apiClient.listProjects(ownerId);
      if (!record) {
        setStatus("No API project for owner");
        return;
      }
      setProject(record.vnProject);
      setRemoteProjectId(record.id);
      setActiveIndex(0);
      localStorage.setItem(LOCAL_OWNER_KEY, ownerId);
      await refreshReleaseApprovals(record.id, { silent: true });
      await refreshOperationsSummary(ownerId, { silent: true });
      await refreshUsageSummary(ownerId, { silent: true });
      await refreshBilling(ownerId, { silent: true });
      await refreshContentSafetyReviews(ownerId, { silent: true });
      setReleaseDiff(undefined);
      setStatus(`Loaded API project: ${record.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "API load failed");
    }
  };

  const publishApi = async () => {
    try {
      const savedProject = await apiClient.saveProject({
        id: remoteProjectId,
        ownerId,
        title: project.title,
        vnProject: project
      });
      setRemoteProjectId(savedProject.id);
      const published = await apiClient.publishProject(savedProject.id);
      const link = published.currentPlayableUrl ?? published.playableUrl ?? published.currentProjectUrl ?? published.projectUrl;
      await refreshReleaseApprovals(savedProject.id, { silent: true });
      await refreshReleaseDiff(savedProject.id, { silent: true });
      await refreshOperationsSummary(ownerId, { silent: true });
      setStatus(`Published release v${published.release.version}: ${link}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "API publish failed");
    }
  };

  const requestReleaseApprovalApi = async () => {
    try {
      const savedProject = await apiClient.saveProject({
        id: remoteProjectId,
        ownerId,
        title: project.title,
        vnProject: project
      });
      setRemoteProjectId(savedProject.id);
      const approval = await apiClient.requestReleaseApproval(savedProject.id, `Request release for ${project.title}`);
      setReleaseApprovals((current) => [approval, ...current.filter((item) => item.id !== approval.id)]);
      await refreshApprovalComments(approval.id, { silent: true });
      await refreshReleaseDiff(savedProject.id, { silent: true });
      await refreshNotificationDeliveries(ownerId, { silent: true });
      await refreshOperationsSummary(ownerId, { silent: true });
      setStatus(`Release approval ${approval.status}: ${approval.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Release approval request failed");
    }
  };

  const approveReleaseApprovalApi = async (approvalId: string) => {
    try {
      const result = await apiClient.approveReleaseApproval(approvalId, normalizedReviewNotes(reviewNotes));
      setReleaseApprovals((current) => current.map((approval) =>
        approval.id === result.approval.id ? result.approval : approval
      ));
      setRemoteProjectId(result.approval.projectId);
      setReviewNotes("");
      await refreshReleaseDiff(result.approval.projectId, { silent: true });
      await refreshOperationsSummary(ownerId, { silent: true });
      setStatus(`Approved release approval ${result.approval.id}: release v${result.published.release.version}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Release approval approve failed");
    }
  };

  const rejectReleaseApprovalApi = async (approvalId: string) => {
    try {
      const approval = await apiClient.rejectReleaseApproval(approvalId, normalizedReviewNotes(reviewNotes));
      setReleaseApprovals((current) => current.map((item) =>
        item.id === approval.id ? approval : item
      ));
      setReviewNotes("");
      await refreshReleaseDiff(approval.projectId, { silent: true });
      await refreshOperationsSummary(ownerId, { silent: true });
      setStatus(`Rejected release approval: ${approval.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Release approval reject failed");
    }
  };

  const generateAssetsApi = async () => {
    if (!apiClient.enabled || isGeneratingAssets) {
      return;
    }
    const assetsToGenerate = placeholderImageAssets;
    if (assetsToGenerate.length === 0) {
      setStatus("No placeholder image assets");
      return;
    }
    setIsGeneratingAssets(true);
    try {
      const savedProject = await apiClient.saveProject({
        id: remoteProjectId,
        ownerId,
        title: project.title,
        vnProject: project
      });
      setRemoteProjectId(savedProject.id);

      const replacements = new Map<string, string>();
      for (const asset of assetsToGenerate) {
        setStatus(`Generating asset ${asset.id}`);
        const queued = await apiClient.createJob({
          ownerId,
          projectId: savedProject.id,
          kind: "asset_generation",
          input: createAssetGenerationInput(asset)
        });
        const completed = await completeAssetGenerationJob(queued, asset.id);
        if (completed.status !== "succeeded") {
          throw new Error(completed.error ?? `Asset generation failed: ${completed.status}`);
        }
        const publicUrl = typeof completed.output?.publicUrl === "string" ? completed.output.publicUrl : undefined;
        if (publicUrl) {
          replacements.set(asset.id, apiClient.resolvePublicUrl(publicUrl));
        }
      }

      const nextProject = replaceGeneratedAssetSources(project, replacements);
      setProject(nextProject);
      await apiClient.saveProject({
        id: savedProject.id,
        ownerId,
        title: nextProject.title,
        vnProject: nextProject
      });
      localStorage.setItem(LOCAL_OWNER_KEY, ownerId);
      await refreshOperationsSummary(ownerId, { silent: true });
      await refreshUsageSummary(ownerId, { silent: true });
      await refreshBilling(ownerId, { silent: true });
      setStatus(`Generated ${replacements.size} assets and saved API project`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Asset generation failed");
    } finally {
      setIsGeneratingAssets(false);
    }
  };

  const completeAssetGenerationJob = async (queued: ProductionJobRecord, assetId: string): Promise<ProductionJobRecord> => {
    if (assetJobConfig.runMode === "inline") {
      return apiClient.runJob(queued.id);
    }

    let latest = queued;
    for (let attempt = 0; attempt < assetJobConfig.pollAttempts; attempt += 1) {
      if (latest.status === "succeeded") {
        return latest;
      }
      if (latest.status === "failed" || latest.status === "blocked" || latest.status === "waiting_for_credentials") {
        throw new Error(latest.error ?? `Asset generation failed: ${latest.status}`);
      }

      setStatus(`Queued asset ${assetId}; waiting for worker ${attempt + 1}/${assetJobConfig.pollAttempts}`);
      await delay(assetJobConfig.pollIntervalMs);
      latest = await apiClient.getJob(queued.id);
    }

    throw new Error(`Asset generation timed out waiting for worker: ${assetId}`);
  };

  return (
    <main className="studio-app">
      <StudioToolbar
        project={project}
        ownerId={ownerId}
        apiEnabled={apiClient.enabled}
        onTitleChange={(title) => setProject((current) => updateProjectTitle(current, title))}
        onOwnerChange={(nextOwnerId) => {
          setOwnerId(nextOwnerId);
          setNotificationDeliveries([]);
          setOperationsSummary(undefined);
          setAuditEvents([]);
          setContentSafetyReviews([]);
          setAccessTokens([]);
          setLastCreatedAccessToken(undefined);
          setUsageSummary(undefined);
          setUsageEvents([]);
          setBillingPlans([]);
          setBillingSubscription(undefined);
          setBillingCheckoutSessions([]);
          setLastBillingCheckoutUrl(undefined);
          setTeamInvitations([]);
          setLastInvitationToken(undefined);
        }}
        onLoadSample={loadSample}
        onGenerate={generateProject}
        onSaveLocal={saveLocal}
        onLoadLocal={loadLocal}
        onSaveApi={saveApi}
        onLoadApi={loadApi}
        onPublishApi={publishApi}
        onRequestReleaseApproval={requestReleaseApprovalApi}
        onExportJson={() => {
          downloadJson(`${project.title}.vn.json`, project);
          setStatus("Exported project JSON");
        }}
        onExportStatic={() => {
          downloadStaticPlayable(project, compiledBeats);
          setStatus("Exported static playable");
        }}
      />

      <section className="studio-workspace">
        <BeatTree items={beatTree} activeIndex={activeIndex} onSelect={setActiveIndex} />
        <section className="preview-column">
          <RuntimePreview
            ref={previewRef}
            project={project}
            activeIndex={activeIndex}
            onIndexChange={setActiveIndex}
          />
          <AssetGenerationPanel
            apiEnabled={apiClient.enabled}
            placeholderCount={placeholderImageAssets.length}
            isGenerating={isGeneratingAssets}
            onGenerateAssets={generateAssetsApi}
          />
          <div className="preview-controls">
            <button type="button" onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}>
              Previous
            </button>
            <span>{activeIndex + 1} / {compiledBeats.length}</span>
            <button
              type="button"
              onClick={() => setActiveIndex((index) => Math.min(compiledBeats.length - 1, index + 1))}
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => {
                previewRef.current?.save("preview");
                setStatus(`Saved preview at beat ${activeIndex + 1}`);
              }}
            >
              Save Preview
            </button>
            <button
              type="button"
              onClick={() => {
                const loaded = previewRef.current?.load("preview");
                setStatus(loaded ? `Loaded preview at beat ${loaded.index + 1}` : "No preview save");
              }}
            >
              Load Preview
            </button>
          </div>
          <NovelImportPanel
            novelText={novelText}
            status={status}
            onNovelTextChange={setNovelText}
          />
          <section className="production-integrations">
            <div className="production-integrations-heading">
              <div className="panel-title">可选生产集成</div>
              <span>API、账号、审批、通知和运营能力不影响本地 Galgame 主链路</span>
            </div>
          <AccountPanel
            apiEnabled={apiClient.enabled}
            user={currentUser}
            sessionToken={accountSessionToken}
            sessions={accountSessions}
            mfaTotpSetup={mfaTotpSetup}
            mfaRecoveryCodes={mfaRecoveryCodes}
            mfaDeviceToken={mfaDeviceToken}
            oauthAuthorizationUrl={oauthStart?.authorizationUrl}
            oauthState={oauthStart?.state}
            isLoading={isAccountLoading}
            isLoadingSessions={isLoadingAccountSessions}
            onRegister={(input) => void registerAccount(input)}
            onLogin={(input) => void loginAccount(input)}
            onStartOAuth={(input) => void startOAuthLogin(input)}
            onCompleteOAuth={(input) => void completeOAuthLogin(input)}
            onRefresh={() => void refreshAccount()}
            onRefreshSessions={() => void refreshAccountSessions()}
            onRevokeSession={(sessionId) => void revokeAccountSession(sessionId)}
            onLogout={() => void logoutAccount()}
            onRequestVerification={() => void requestAccountVerification()}
            onVerifyEmail={(verificationToken) => void verifyAccountEmail(verificationToken)}
            onRequestPasswordReset={(email) => void requestAccountPasswordReset(email)}
            onConfirmPasswordReset={(input) => void confirmAccountPasswordReset(input)}
            onStartMfaTotpSetup={() => void startAccountMfaTotpSetup()}
            onConfirmMfaTotpSetup={(code) => void confirmAccountMfaTotpSetup(code)}
            onDisableMfaTotp={(input) => void disableAccountMfaTotp(input)}
            onRegenerateMfaRecoveryCodes={(input) => void regenerateAccountMfaRecoveryCodes(input)}
            onRevokeMfaTrustedDevices={(input) => void revokeAccountMfaTrustedDevices(input)}
          />
          <AccessTokenPanel
            apiEnabled={apiClient.enabled}
            ownerId={ownerId}
            tokens={accessTokens}
            lastCreatedToken={lastCreatedAccessToken}
            isLoading={isLoadingAccessTokens}
            isCreating={isCreatingAccessToken}
            label={accessTokenLabel}
            expiresAt={accessTokenExpiresAt}
            onLabelChange={setAccessTokenLabel}
            onExpiresAtChange={setAccessTokenExpiresAt}
            onRefresh={() => void refreshAccessTokens()}
            onCreate={() => void createOwnerAccessToken()}
            onRevoke={(tokenId) => void revokeAccessToken(tokenId)}
          />
          <UsageBillingPanel
            apiEnabled={apiClient.enabled}
            ownerId={ownerId}
            usage={usageSummary}
            events={usageEvents}
            isLoading={isLoadingUsage}
            onRefresh={() => void refreshUsageSummary()}
          />
          <BillingPanel
            apiEnabled={apiClient.enabled}
            ownerId={ownerId}
            plans={billingPlans}
            subscription={billingSubscription}
            checkoutSessions={billingCheckoutSessions}
            events={billingEvents}
            selectedPlanId={selectedBillingPlanId}
            lastCheckoutUrl={lastBillingCheckoutUrl}
            lastPortalUrl={lastBillingPortalUrl}
            isLoading={isLoadingBilling}
            isStartingCheckout={isStartingBillingCheckout}
            isStartingPortal={isStartingBillingPortal}
            isCancelling={isCancellingBilling}
            onSelectedPlanChange={setSelectedBillingPlanId}
            onRefresh={() => void refreshBilling()}
            onStartCheckout={() => void startBillingCheckout()}
            onStartPaymentMethodSession={() => void createBillingPaymentMethodSession()}
            onCancelSubscription={() => void cancelBillingSubscription()}
          />
          <OperationsSummaryPanel
            apiEnabled={apiClient.enabled}
            ownerId={ownerId}
            summary={operationsSummary}
            isLoading={isLoadingOperations}
            onRefresh={() => void refreshOperationsSummary()}
          />
          <AuditLogPanel
            apiEnabled={apiClient.enabled}
            ownerId={ownerId}
            events={auditEvents}
            isLoading={isLoadingAudit}
            onRefresh={() => void refreshAuditEvents()}
          />
          <ContentSafetyPanel
            apiEnabled={apiClient.enabled}
            ownerId={ownerId}
            reviews={contentSafetyReviews}
            isLoading={isLoadingContentSafety}
            isReviewingProject={isReviewingProjectSafety}
            onRefresh={() => void refreshContentSafetyReviews()}
            onReviewProject={() => void reviewCurrentProjectSafety()}
          />
          <TeamInvitationPanel
            apiEnabled={apiClient.enabled}
            ownerId={ownerId}
            invitations={teamInvitations}
            isLoading={isLoadingTeamInvitations}
            isCreating={isCreatingTeamInvitation}
            inviteEmail={inviteEmail}
            inviteRole={inviteRole}
            inviteUserId={inviteUserId}
            acceptToken={acceptInvitationToken}
            acceptUserId={acceptInvitationUserId}
            lastInvitationToken={lastInvitationToken}
            onInviteEmailChange={setInviteEmail}
            onInviteRoleChange={setInviteRole}
            onInviteUserIdChange={setInviteUserId}
            onAcceptTokenChange={setAcceptInvitationToken}
            onAcceptUserIdChange={setAcceptInvitationUserId}
            onCreate={() => void createTeamInvitation()}
            onRefresh={() => void refreshTeamInvitations()}
            onAccept={() => void acceptTeamInvitation()}
            onRevoke={(invitationId) => void revokeTeamInvitation(invitationId)}
          />
          <ReleaseDiffPanel
            apiEnabled={apiClient.enabled}
            projectId={remoteProjectId}
            diff={releaseDiff}
            isLoading={isLoadingReleaseDiff}
            onRefresh={() => void refreshReleaseDiff()}
          />
          <ReleaseApprovalPanel
            apiEnabled={apiClient.enabled}
            projectId={remoteProjectId}
            approvals={releaseApprovals}
            isLoading={isLoadingApprovals}
            loadingCommentsApprovalId={loadingCommentsApprovalId}
            reviewNotes={reviewNotes}
            commentsByApprovalId={approvalComments}
            commentDrafts={commentDrafts}
            onReviewNotesChange={setReviewNotes}
            onCommentDraftChange={(approvalId, value) => setCommentDrafts((current) => ({
              ...current,
              [approvalId]: value
            }))}
            onRefresh={() => void refreshReleaseApprovals()}
            onLoadComments={(approvalId) => void refreshApprovalComments(approvalId)}
            onAddComment={(approvalId) => void addApprovalComment(approvalId)}
            onApprove={(approvalId) => void approveReleaseApprovalApi(approvalId)}
            onReject={(approvalId) => void rejectReleaseApprovalApi(approvalId)}
          />
          <NotificationDeliveryPanel
            apiEnabled={apiClient.enabled}
            ownerId={ownerId}
            deliveries={notificationDeliveries}
            isLoading={isLoadingNotifications}
            isRunning={isRunningNotification}
            onRefresh={() => void refreshNotificationDeliveries()}
            onRunNext={() => void runNextNotificationDelivery()}
          />
          </section>
        </section>
        <Inspector
          project={project}
          beat={activeBeat}
          compiledBeat={activeCompiledBeat}
          onProjectChange={setProject}
        />
      </section>
    </main>
  );
}

function normalizedReviewNotes(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function keepKnownApprovalComments(
  current: Record<string, ProductionReleaseApprovalCommentRecord[]>,
  approvals: ProductionReleaseApprovalRecord[]
): Record<string, ProductionReleaseApprovalCommentRecord[]> {
  const approvalIds = new Set(approvals.map((approval) => approval.id));
  return Object.fromEntries(Object.entries(current).filter(([approvalId]) => approvalIds.has(approvalId)));
}

function keepKnownApprovalDrafts(
  current: Record<string, string>,
  approvals: ProductionReleaseApprovalRecord[]
): Record<string, string> {
  const approvalIds = new Set(approvals.map((approval) => approval.id));
  return Object.fromEntries(Object.entries(current).filter(([approvalId]) => approvalIds.has(approvalId)));
}

function isGeneratablePlaceholderAsset(asset: VNAsset): boolean {
  return asset.placeholder === true && (
    asset.type === "background" ||
    asset.type === "characterSprite" ||
    asset.type === "cg"
  );
}

function createAssetGenerationInput(asset: VNAsset): Record<string, unknown> {
  return {
    assetId: asset.id,
    kind: imageJobKind(asset),
    title: asset.name,
    fileName: `${asset.id}.png`,
    prompt: createAssetPrompt(asset)
  };
}

function imageJobKind(asset: VNAsset): "background" | "characterSprite" | "cg" {
  if (asset.type === "background" || asset.type === "characterSprite" || asset.type === "cg") {
    return asset.type;
  }
  return "cg";
}

function createAssetPrompt(asset: VNAsset): string {
  const base = "traditional galgame visual novel production asset, clean composition, no subtitles, no textbox UI";
  if (asset.type === "characterSprite") {
    return `${base}, transparent background, half-body character sprite, character name: ${asset.name}`;
  }
  if (asset.type === "cg") {
    return `${base}, 16:9 cinematic CG illustration, key scene: ${asset.name}`;
  }
  return `${base}, 16:9 background environment art, location: ${asset.name}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function replaceGeneratedAssetSources(project: VNProject, replacements: Map<string, string>): VNProject {
  if (replacements.size === 0) {
    return project;
  }
  return {
    ...project,
    assets: {
      items: project.assets.items.map((asset) => {
        const src = replacements.get(asset.id);
        return src
          ? {
              ...asset,
              src,
              placeholder: false
            }
          : asset;
      })
    },
    updatedAt: new Date().toISOString()
  };
}
