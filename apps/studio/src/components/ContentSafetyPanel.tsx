import type { ProductionContentSafetyReviewRecord } from "../studio/productionApi";

interface ContentSafetyPanelProps {
  apiEnabled: boolean;
  ownerId: string;
  reviews: ProductionContentSafetyReviewRecord[];
  isLoading: boolean;
  isReviewingProject: boolean;
  onRefresh(): void;
  onReviewProject(): void;
}

export function ContentSafetyPanel({
  apiEnabled,
  ownerId,
  reviews,
  isLoading,
  isReviewingProject,
  onRefresh,
  onReviewProject
}: ContentSafetyPanelProps) {
  const blockedCount = reviews.filter((review) => review.decision === "blocked").length;
  const reviewRequiredCount = reviews.filter((review) => review.decision === "review_required").length;

  return (
    <section className="content-safety-panel" aria-label="Content Safety">
      <div className="content-safety-header">
        <div>
          <div className="panel-title">Content Safety</div>
          <div className="content-safety-readout">
            {reviews.length > 0
              ? `${reviews.length} reviews / ${blockedCount} blocked / ${reviewRequiredCount} review`
              : apiEnabled
                ? "No safety reviews loaded"
                : "Production API is offline"}
          </div>
        </div>
        <div className="content-safety-actions">
          <button type="button" onClick={onReviewProject} disabled={!apiEnabled || !ownerId || isReviewingProject}>
            {isReviewingProject ? "Reviewing Project" : "Review Project"}
          </button>
          <button type="button" onClick={onRefresh} disabled={!apiEnabled || !ownerId || isLoading}>
            {isLoading ? "Loading Safety" : "Refresh Safety"}
          </button>
        </div>
      </div>

      {reviews.length > 0 ? (
        <ul className="content-safety-list">
          {reviews.slice(0, 10).map((review) => (
            <li key={review.id} className={`content-safety-item is-${review.decision}`}>
              <div className="content-safety-row">
                <strong>{review.source}</strong>
                <span className={`content-safety-decision is-${review.decision}`}>{formatDecision(review.decision)}</span>
              </div>
              <div className="content-safety-meta">
                <span>{review.targetType}{review.targetId ? `:${review.targetId}` : ""}</span>
                <span>{review.inputLength} chars</span>
                <span>{formatTime(review.createdAt)}</span>
              </div>
              <code>{review.matchedRules.length > 0 ? review.matchedRules.join(" / ") : review.inputHash.slice(0, 16)}</code>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function formatDecision(decision: ProductionContentSafetyReviewRecord["decision"]): string {
  if (decision === "review_required") {
    return "review";
  }
  return decision;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toISOString().replace(".000Z", "Z");
}
