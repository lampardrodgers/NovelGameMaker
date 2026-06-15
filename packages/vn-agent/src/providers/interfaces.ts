import type { VNProject } from "@novel-game-maker/vn-core";

export interface TextModelProvider {
  id: string;
  generateStructured<T>(input: {
    task: string;
    schemaName: string;
    prompt: string;
  }): Promise<T>;
  complete?(prompt: string): Promise<string>;
}

export type ImageAssetKind = "background" | "characterSprite" | "cg";

export interface ImageAssetGenerationInput {
  id: string;
  title: string;
  kind: ImageAssetKind;
  prompt?: string;
}

export interface ImageAssetGenerationResult {
  src: string;
  provider: string;
  mimeType?: string;
  revisedPrompt?: string;
}

export interface ImageGenerationProvider {
  id: string;
  generateImage(input: {
    prompt: string;
    width: number;
    height: number;
    seed?: number;
    referenceAssetIds?: string[];
  }): Promise<{
    assetUrl: string;
    seed?: number;
  }>;
  generateAsset(input: ImageAssetGenerationInput): Promise<ImageAssetGenerationResult>;
  generatePlaceholderAsset?(input: ImageAssetGenerationInput): Promise<{ src: string }>;
}

export interface VNAgentWorkflow {
  id: string;
  run(input: unknown): Promise<unknown>;
  createProject(input: {
    title: string;
    novelText: string;
    style?: {
      name?: string;
      mood?: string;
    };
  }): VNProject | Promise<VNProject>;
}
