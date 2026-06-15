import type { BeatTreeItem } from "../studio/projectEditing";

interface BeatTreeProps {
  items: BeatTreeItem[];
  activeIndex: number;
  onSelect(index: number): void;
}

export function BeatTree({ items, activeIndex, onSelect }: BeatTreeProps) {
  let currentChapter = "";
  let currentScene = "";

  return (
    <aside className="beat-tree">
      <div className="panel-title">Beat Tree</div>
      <div className="tree-list">
        {items.map((item) => {
          const showChapter = item.chapterTitle !== currentChapter;
          const showScene = item.sceneTitle !== currentScene || showChapter;
          currentChapter = item.chapterTitle;
          currentScene = item.sceneTitle;

          return (
            <div key={item.beatId} className="tree-group">
              {showChapter ? <div className="tree-heading">{item.chapterTitle}</div> : null}
              {showScene ? <div className="tree-subheading">{item.sceneTitle}</div> : null}
              <button
                type="button"
                className={`beat-row ${item.index === activeIndex ? "is-active" : ""}`}
                onClick={() => onSelect(item.index)}
              >
                <span className="beat-index">{item.index + 1}</span>
                <span className="beat-label">{item.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
