import type { CompiledBeat, StageRenderMode, VNBeat, VNProject } from "@novel-game-maker/vn-core";
import {
  getFirstSpeaker,
  updateBeatLine,
  updateBeatStagePatch,
  updateCharacterPatch
} from "../studio/projectEditing";

interface InspectorProps {
  project: VNProject;
  beat: VNBeat | undefined;
  compiledBeat: CompiledBeat | undefined;
  onProjectChange(project: VNProject): void;
}

export function Inspector({ project, beat, compiledBeat, onProjectChange }: InspectorProps) {
  if (!beat || !compiledBeat) {
    return (
      <aside className="inspector">
        <div className="panel-title">Inspector</div>
      </aside>
    );
  }

  const cgAssets = project.assets.items.filter((asset) => asset.type === "cg");
  const backgroundAssets = project.assets.items.filter((asset) => asset.type === "background");
  const currentRenderMode = beat.stagePatch?.renderMode ?? compiledBeat.resolvedStage.renderMode;
  const currentBackgroundId = beat.stagePatch?.backgroundId ?? compiledBeat.resolvedStage.backgroundId ?? "";
  const currentCgAssetId = beat.stagePatch?.cgAssetId ?? compiledBeat.resolvedStage.cgAssetId ?? cgAssets[0]?.id;
  const editableCharacters = project.characters.filter((character) => character.id !== "protagonist");
  const firstSpeaker = getFirstSpeaker(project.characters);

  const updateKind = (kind: "narration" | "dialogue" | "monologue") => {
    if (kind === "narration") {
      onProjectChange(updateBeatLine(project, beat.id, { kind }));
      return;
    }
    onProjectChange(
      updateBeatLine(project, beat.id, {
        kind,
        speakerId: beat.line.speakerId ?? firstSpeaker?.id,
        speakerName: undefined
      })
    );
  };

  const updateRenderMode = (renderMode: StageRenderMode) => {
    onProjectChange(
      updateBeatStagePatch(project, beat.id, {
        renderMode,
        cgAssetId: renderMode === "cg" ? currentCgAssetId : beat.stagePatch?.cgAssetId
      })
    );
  };

  return (
    <aside className="inspector">
      <div className="panel-title">Inspector</div>

      <div className="inspector-meta">
        <div><span>Beat</span><strong>{beat.id}</strong></div>
        <div><span>Resolved Stage</span><strong>{compiledBeat.resolvedStage.renderMode}</strong></div>
      </div>

      <label className="field">
        <span>Line Kind</span>
        <select value={beat.line.kind} onChange={(event) => updateKind(event.target.value as typeof beat.line.kind)}>
          <option value="narration">旁白</option>
          <option value="dialogue">对话</option>
          <option value="monologue">内心</option>
        </select>
      </label>

      <label className="field">
        <span>Speaker</span>
        <select
          value={beat.line.speakerId ?? ""}
          disabled={beat.line.kind === "narration"}
          onChange={(event) =>
            onProjectChange(
              updateBeatLine(project, beat.id, {
                speakerId: event.target.value || undefined,
                speakerName: undefined
              })
            )
          }
        >
          <option value="">无</option>
          {project.characters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Text</span>
        <textarea
          className="inspector-textarea"
          value={beat.line.text}
          onChange={(event) => onProjectChange(updateBeatLine(project, beat.id, { text: event.target.value }))}
        />
      </label>

      <label className="field">
        <span>Render Mode</span>
        <select value={currentRenderMode} onChange={(event) => updateRenderMode(event.target.value as StageRenderMode)}>
          <option value="stage">Stage</option>
          <option value="cg">CG</option>
        </select>
      </label>

      <label className="field">
        <span>Background</span>
        <select
          value={currentBackgroundId}
          onChange={(event) =>
            onProjectChange(
              updateBeatStagePatch(project, beat.id, {
                renderMode: currentRenderMode,
                backgroundId: event.target.value
              })
            )
          }
        >
          {backgroundAssets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>CG Asset</span>
        <select
          value={currentCgAssetId ?? ""}
          disabled={currentRenderMode !== "cg"}
          onChange={(event) =>
            onProjectChange(
              updateBeatStagePatch(project, beat.id, {
                renderMode: "cg",
                cgAssetId: event.target.value
              })
            )
          }
        >
          {cgAssets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name}
            </option>
          ))}
        </select>
      </label>

      <div className="inspector-meta">
        <div>
          <span>CG Score</span>
          <strong>{beat.meta?.cgCandidateScore?.toFixed(2) ?? "none"}</strong>
        </div>
        <div>
          <span>CG Reason</span>
          <strong>{beat.meta?.cgCandidateReason ?? "none"}</strong>
        </div>
      </div>

      <div className="inspector-divider" />

      {editableCharacters.map((character) => {
        const resolvedCharacter = compiledBeat.resolvedStage.characters.find(
          (stageCharacter) => stageCharacter.characterId === character.id
        );
        return (
          <div key={character.id} className="character-editor">
            <div className="character-editor-title">{character.name}</div>
            <div className="character-focus-readout">Focus: {resolvedCharacter?.focus ?? "not visible"}</div>
            <label className="field">
              <span>Expression</span>
              <input
                value={resolvedCharacter?.expression ?? character.defaultExpression ?? "neutral"}
                onChange={(event) =>
                  onProjectChange(
                    updateCharacterPatch(project, beat.id, character.id, {
                      expression: event.target.value
                    })
                  )
                }
              />
            </label>
            <label className="field">
              <span>Position</span>
              <select
                value={resolvedCharacter?.position ?? "center"}
                onChange={(event) =>
                  onProjectChange(
                    updateCharacterPatch(project, beat.id, character.id, {
                      position: event.target.value
                    })
                  )
                }
              >
                <option value="farLeft">Far Left</option>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
                <option value="farRight">Far Right</option>
              </select>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={resolvedCharacter?.visible ?? false}
                onChange={(event) =>
                  onProjectChange(
                    updateCharacterPatch(project, beat.id, character.id, {
                      visible: event.target.checked
                    })
                  )
                }
              />
              <span>Visible</span>
            </label>
          </div>
        );
      })}
    </aside>
  );
}
