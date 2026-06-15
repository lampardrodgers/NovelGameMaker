# Fog Name Village sample

This sample is a clean import package for NovelGameMaker. It contains an originalized Chinese mystery VN sample, placeholder art, and preserved source data for future branching/key/trial systems.

## Files

- `project.vn.json`: NovelGameMaker native VNProject. Current player can load this directly.
- `novel.txt`: linearized source text for Studio paste/import tests.
- `assets/`: temporary backgrounds, character sprites, and evidence CG cards.
- `source/`: structured story/key/character/flow/ending data from the Godot MVP.

## Notes

- This package intentionally does not include raw PDFs, OCR output, zip archives, local GodotMaker state, `.lnk` files, or commercial reference images.
- The current VNProject is linearized because the existing Runtime is a linear VN player. Branch choices, keys, evidence, and trial data are preserved in `source/*.json` for later engine support.
- Runtime art is placeholder-only and can be replaced by keeping the same filenames or updating asset `src` fields in `project.vn.json`.
