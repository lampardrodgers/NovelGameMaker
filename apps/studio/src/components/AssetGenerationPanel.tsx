interface AssetGenerationPanelProps {
  apiEnabled: boolean;
  placeholderCount: number;
  isGenerating: boolean;
  onGenerateAssets(): void;
}

export function AssetGenerationPanel({
  apiEnabled,
  placeholderCount,
  isGenerating,
  onGenerateAssets
}: AssetGenerationPanelProps) {
  return (
    <section className="asset-generation-panel" aria-label="Asset Generation">
      <div>
        <div className="panel-title">Asset Generation</div>
        <div className="asset-generation-readout">
          {placeholderCount} placeholder image assets
        </div>
      </div>
      <button
        type="button"
        onClick={onGenerateAssets}
        disabled={!apiEnabled || isGenerating || placeholderCount === 0}
      >
        {isGenerating ? "Generating Assets" : "Generate Placeholder Assets"}
      </button>
    </section>
  );
}
