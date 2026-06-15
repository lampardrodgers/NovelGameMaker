import type {
  ProductionReleaseApprovalCommentRecord,
  ProductionReleaseApprovalRecord
} from "../studio/productionApi";

interface ReleaseApprovalPanelProps {
  apiEnabled: boolean;
  projectId?: string;
  approvals: ProductionReleaseApprovalRecord[];
  isLoading: boolean;
  loadingCommentsApprovalId?: string;
  reviewNotes: string;
  commentsByApprovalId: Record<string, ProductionReleaseApprovalCommentRecord[]>;
  commentDrafts: Record<string, string>;
  onReviewNotesChange(value: string): void;
  onCommentDraftChange(approvalId: string, value: string): void;
  onRefresh(): void;
  onLoadComments(approvalId: string): void;
  onAddComment(approvalId: string): void;
  onApprove(approvalId: string): void;
  onReject(approvalId: string): void;
}

export function ReleaseApprovalPanel({
  apiEnabled,
  projectId,
  approvals,
  isLoading,
  loadingCommentsApprovalId,
  reviewNotes,
  commentsByApprovalId,
  commentDrafts,
  onReviewNotesChange,
  onCommentDraftChange,
  onRefresh,
  onLoadComments,
  onAddComment,
  onApprove,
  onReject
}: ReleaseApprovalPanelProps) {
  const disabled = !apiEnabled || !projectId || isLoading;
  const pendingCount = approvals.filter((approval) => approval.status === "pending").length;

  return (
    <section className="release-approval-panel" aria-label="Release Approval Review">
      <div className="release-approval-header">
        <div>
          <div className="panel-title">Release Approval Review</div>
          <div className="release-approval-readout">
            {projectId
              ? `${pendingCount} pending / ${approvals.length} total`
              : "Save or load an API project first"}
          </div>
        </div>
        <button type="button" onClick={onRefresh} disabled={disabled}>
          {isLoading ? "Loading Approvals" : "Refresh Approvals"}
        </button>
      </div>

      <label className="release-review-notes">
        <span>Review Notes</span>
        <textarea
          value={reviewNotes}
          onChange={(event) => onReviewNotesChange(event.target.value)}
          disabled={!apiEnabled || !projectId}
          rows={2}
          aria-label="Review notes"
          placeholder="批准或拒绝时写入审核备注"
        />
      </label>

      {approvals.length === 0 ? (
        <div className="release-approval-empty">
          {apiEnabled ? "No release approvals loaded" : "Production API is offline"}
        </div>
      ) : (
        <ul className="release-approval-list">
          {approvals.map((approval) => (
            <li key={approval.id} className="release-approval-item">
              <div className="release-approval-meta">
                <strong>{approval.id}</strong>
                <span className={`release-approval-status is-${approval.status}`}>{approval.status}</span>
              </div>
              <div className="release-approval-detail">
                <span>requested by {approval.requestedBy}</span>
                <span>{approval.updatedAt}</span>
              </div>
              {approval.notes ? <p>{approval.notes}</p> : null}
              {approval.reviewNotes ? <p>Review: {approval.reviewNotes}</p> : null}
              {approval.publishedReleaseId ? (
                <div className="release-approval-release">Release: {approval.publishedReleaseId}</div>
              ) : null}
              <div className="release-approval-comments">
                <div className="release-approval-comments-header">
                  <span>Comments</span>
                  <button
                    type="button"
                    onClick={() => onLoadComments(approval.id)}
                    disabled={!apiEnabled || loadingCommentsApprovalId === approval.id}
                    aria-label={`Load Comments ${approval.id}`}
                  >
                    {loadingCommentsApprovalId === approval.id ? "Loading Comments" : "Load Comments"}
                  </button>
                </div>
                {(commentsByApprovalId[approval.id] ?? []).length > 0 ? (
                  <ul className="release-approval-comment-list">
                    {(commentsByApprovalId[approval.id] ?? []).map((comment) => (
                      <li key={comment.id}>
                        <strong>{comment.author}</strong>
                        <span>{comment.body}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <label className="release-approval-comment-field">
                  <span>Add Comment</span>
                  <textarea
                    value={commentDrafts[approval.id] ?? ""}
                    onChange={(event) => onCommentDraftChange(approval.id, event.target.value)}
                    disabled={!apiEnabled}
                    rows={2}
                    aria-label={`Comment ${approval.id}`}
                    placeholder="给这次审批留下讨论记录"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onAddComment(approval.id)}
                  disabled={!apiEnabled || !(commentDrafts[approval.id] ?? "").trim()}
                  aria-label={`Add Comment ${approval.id}`}
                >
                  Add Comment
                </button>
              </div>
              {approval.status === "pending" ? (
                <div className="release-approval-actions">
                  <button
                    type="button"
                    aria-label={`Approve ${approval.id}`}
                    onClick={() => onApprove(approval.id)}
                    disabled={!apiEnabled}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    aria-label={`Reject ${approval.id}`}
                    onClick={() => onReject(approval.id)}
                    disabled={!apiEnabled}
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
