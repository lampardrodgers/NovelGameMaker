import type {
  ImageAssetGenerationInput,
  ImageAssetGenerationResult,
  ImageGenerationProvider,
  TextModelProvider
} from "./interfaces.js";

export class MockTextModelProvider implements TextModelProvider {
  readonly id = "mock-text-model";

  async generateStructured<T>(input: {
    task: string;
    schemaName: string;
    prompt: string;
  }): Promise<T> {
    return {
      task: input.task,
      schemaName: input.schemaName,
      prompt: input.prompt
    } as T;
  }

  async complete(prompt: string): Promise<string> {
    return prompt;
  }
}

export class MockImageGenerationProvider implements ImageGenerationProvider {
  readonly id = "mock-image-generation";

  async generateImage(input: {
    prompt: string;
    width: number;
    height: number;
    seed?: number;
    referenceAssetIds?: string[];
  }): Promise<{ assetUrl: string; seed?: number }> {
    return {
      assetUrl: `mock://${encodeURIComponent(input.prompt)}-${input.width}x${input.height}.svg`,
      seed: input.seed
    };
  }

  async generateAsset(input: ImageAssetGenerationInput): Promise<ImageAssetGenerationResult> {
    return {
      src: `assets/${input.id}.svg`,
      provider: "mock-placeholder",
      mimeType: "image/svg+xml"
    };
  }

  async generatePlaceholderAsset(input: ImageAssetGenerationInput): Promise<{ src: string }> {
    const asset = await this.generateAsset(input);
    return { src: asset.src };
  }
}
