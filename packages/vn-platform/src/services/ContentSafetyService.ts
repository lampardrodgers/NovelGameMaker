import { createHash } from "node:crypto";
import type {
  ContentSafetyDecision,
  ContentSafetyPolicy,
  ContentSafetyRepository,
  ContentSafetyReviewRecord,
  ContentSafetySource
} from "../types.js";

export class ContentSafetyBlockedError extends Error {
  constructor(readonly review: ContentSafetyReviewRecord) {
    super("Content safety review blocked this request.");
    this.name = "ContentSafetyBlockedError";
  }
}

export class ContentSafetyService {
  constructor(
    private readonly reviews: ContentSafetyRepository,
    private readonly policy: ContentSafetyPolicy
  ) {}

  async review(input: {
    ownerId: string;
    source: ContentSafetySource;
    text: string;
    targetType: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ContentSafetyReviewRecord> {
    const matchedBlocked = matchTerms(input.text, this.policy.blockedTerms)
      .map((term) => `blocked:${term}`);
    const matchedReview = matchTerms(input.text, this.policy.reviewTerms)
      .map((term) => `review:${term}`);
    const decision = decide({
      enabled: this.policy.enabled,
      hasBlocked: matchedBlocked.length > 0,
      hasReview: matchedReview.length > 0
    });

    return this.reviews.create({
      id: createRecordId("safety"),
      ownerId: input.ownerId,
      source: input.source,
      decision,
      targetType: input.targetType,
      targetId: input.targetId,
      inputHash: hashText(input.text),
      inputLength: input.text.length,
      matchedRules: [...matchedBlocked, ...matchedReview],
      metadata: input.metadata,
      createdAt: new Date().toISOString()
    });
  }

  async assertApproved(input: {
    ownerId: string;
    source: ContentSafetySource;
    text: string;
    targetType: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ContentSafetyReviewRecord> {
    const review = await this.review(input);
    if (review.decision === "blocked" || (review.decision === "review_required" && this.policy.blockOnReview)) {
      throw new ContentSafetyBlockedError(review);
    }
    return review;
  }

  async listByOwner(ownerId: string, limit = 50): Promise<ContentSafetyReviewRecord[]> {
    return this.reviews.listByOwner(ownerId, limit);
  }
}

function decide(input: { enabled: boolean; hasBlocked: boolean; hasReview: boolean }): ContentSafetyDecision {
  if (!input.enabled) {
    return "approved";
  }
  if (input.hasBlocked) {
    return "blocked";
  }
  if (input.hasReview) {
    return "review_required";
  }
  return "approved";
}

function matchTerms(text: string, terms: string[]): string[] {
  const lower = text.toLocaleLowerCase();
  return terms
    .map((term) => term.trim())
    .filter(Boolean)
    .filter((term) => lower.includes(term.toLocaleLowerCase()));
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function createRecordId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
