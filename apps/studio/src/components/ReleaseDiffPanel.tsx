import type { ProductionReleaseDiff, ProductionReleaseDiffItem } from "../studio/productionApi";

interface ReleaseDiffPanelProps {
  apiEnabled: boolean;
  projectId?: string;
  diff?: ProductionReleaseDiff;
  isLoading: boolean;
  onRefresh(): void;
}

export function ReleaseDiffPanel({
  apiEnabled,
  projectId,
  diff,
  isLoading,
  onRefresh
}: ReleaseDiffPanelProps) {
  const disabled = !apiEnabled || !projectId || isLoading;

  return (
    <section className="release-diff-panel" aria-label="Release Diff">
      <div className="release-diff-header">
        <div>
          <div className="panel-title">Release Diff</div>
          <div className="release-diff-readout">
            {diff ? diffTitle(diff) : projectId ? "No release diff loaded" : "Save or load an API project first"}
          </div>
        </div>
        <button type="button" onClick={onRefresh} disabled={disabled}>
          {isLoading ? "Loading Diff" : "Refresh Release Diff"}
        </button>
      </div>

      {diff ? (
        <div className="release-diff-body">
          <div className="release-diff-stats">
            <span>{diff.totals.addedBeats} beat added</span>
            <span>{diff.totals.changedBeats} beat changed</span>
            <span>{diff.totals.removedBeats} beat removed</span>
            <span>{diff.totals.changedAssets + diff.totals.addedAssets + diff.totals.removedAssets} asset changes</span>
          </div>
          {diff.baseUnavailable ? (
            <div className="release-diff-warning">Published baseline has no diff summary</div>
          ) : null}
          <ChangeList title="Beat Changes" changes={diff.beatChanges} />
          <ChangeList title="Asset Changes" changes={diff.assetChanges} />
          <ChangeList title="Character Changes" changes={diff.characterChanges} />
        </div>
      ) : null}
    </section>
  );
}

function ChangeList({
  title,
  changes
}: {
  title: string;
  changes: ProductionReleaseDiffItem[];
}) {
  if (changes.length === 0) {
    return null;
  }
  return (
    <div className="release-diff-change-group">
      <div className="release-diff-change-title">{title}</div>
      <ul className="release-diff-change-list">
        {changes.map((change) => (
          <li key={`${change.kind}:${change.id}`} className={`release-diff-change is-${change.kind}`}>
            <span className="release-diff-kind">{change.kind}</span>
            <strong>{change.label}</strong>
            {change.previous ? <span>Before: {change.previous}</span> : null}
            {change.current ? <span>After: {change.current}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function diffTitle(diff: ProductionReleaseDiff): string {
  if (!diff.baseRelease) {
    return "New release candidate";
  }
  return diff.changed
    ? `Diff vs release v${diff.baseRelease.version}`
    : `No changes vs release v${diff.baseRelease.version}`;
}
