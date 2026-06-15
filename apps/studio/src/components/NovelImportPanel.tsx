interface NovelImportPanelProps {
  novelText: string;
  status: string;
  onNovelTextChange(value: string): void;
}

export function NovelImportPanel({ novelText, status, onNovelTextChange }: NovelImportPanelProps) {
  return (
    <section className="novel-panel">
      <div className="panel-title">Novel Import</div>
      <textarea
        className="novel-textarea"
        value={novelText}
        onChange={(event) => onNovelTextChange(event.target.value)}
        aria-label="小说文本"
      />
      <div className="status-line">{status}</div>
    </section>
  );
}
