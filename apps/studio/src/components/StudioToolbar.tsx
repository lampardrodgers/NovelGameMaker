import type { VNProject } from "@agentic-galgame/vn-core";

interface StudioToolbarProps {
  project: VNProject;
  ownerId: string;
  apiEnabled: boolean;
  onTitleChange(title: string): void;
  onOwnerChange(ownerId: string): void;
  onLoadSample(): void;
  onGenerate(): void;
  onSaveLocal(): void;
  onLoadLocal(): void;
  onSaveApi(): void;
  onLoadApi(): void;
  onPublishApi(): void;
  onRequestReleaseApproval(): void;
  onExportJson(): void;
  onExportStatic(): void;
}

export function StudioToolbar({
  project,
  ownerId,
  apiEnabled,
  onTitleChange,
  onOwnerChange,
  onLoadSample,
  onGenerate,
  onSaveLocal,
  onLoadLocal,
  onSaveApi,
  onLoadApi,
  onPublishApi,
  onRequestReleaseApproval,
  onExportJson,
  onExportStatic
}: StudioToolbarProps) {
  return (
    <header className="studio-toolbar">
      <div className="toolbar-primary">
        <input
          className="project-title-input"
          value={project.title}
          onChange={(event) => onTitleChange(event.target.value)}
          aria-label="项目标题"
        />
        <div className="toolbar-actions toolbar-core-actions">
          <button type="button" onClick={onLoadSample}>Load Sample</button>
          <button type="button" onClick={onGenerate}>Generate VN Project</button>
          <button type="button" onClick={onSaveLocal}>Save Local</button>
          <button type="button" onClick={onLoadLocal}>Load Local</button>
          <button type="button" onClick={onExportJson}>Export Project JSON</button>
          <button type="button" onClick={onExportStatic}>Export Static Playable</button>
        </div>
      </div>
      <div className="toolbar-production-actions" aria-label="可选生产集成快捷操作">
        <label className="owner-field">
          <span>Owner</span>
          <input
            value={ownerId}
            onChange={(event) => onOwnerChange(event.target.value)}
            aria-label="Owner ID"
          />
        </label>
        <span className={apiEnabled ? "api-status is-online" : "api-status"}>
          {apiEnabled ? "API Online" : "API Offline"}
        </span>
        <button type="button" onClick={onSaveApi} disabled={!apiEnabled}>Save API</button>
        <button type="button" onClick={onLoadApi} disabled={!apiEnabled}>Load API</button>
        <button type="button" onClick={onRequestReleaseApproval} disabled={!apiEnabled}>Request Approval</button>
        <button type="button" onClick={onPublishApi} disabled={!apiEnabled}>Publish Player</button>
      </div>
    </header>
  );
}
