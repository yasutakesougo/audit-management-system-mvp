/**
 * AI Client — 実装
 *
 * Azure OpenAI + Mock の2つの実装を提供する。
 * 本番は Proxy（Azure Functions / Cloudflare Workers）経由を推奨。
 */

import type { AiClient, AiChatOptions, AiChatResponse } from './aiClientTypes';

// Re-export types for convenience
export type { AiClient, AiChatOptions, AiChatResponse };

// ────────────────────────────────────────────────────────────
// Azure OpenAI 実装
// ────────────────────────────────────────────────────────────

export interface AzureOpenAiConfig {
  /** Azure OpenAI エンドポイント (例: https://xxx.openai.azure.com) */
  endpoint: string;
  /** API キー */
  apiKey: string;
  /** デプロイメント名 (例: gpt-4o-mini) */
  deploymentId: string;
  /** API バージョン (デフォルト: 2024-06-01) */
  apiVersion?: string;
}

/**
 * Azure OpenAI クライアントを作成する。
 *
 * @example
 * ```ts
 * // 環境変数は src/env.ts の env helpers 経由で取得
 * const client = createAzureOpenAiClient({
 *   endpoint: env.AZURE_OPENAI_ENDPOINT,
 *   apiKey: env.AZURE_OPENAI_KEY,
 *   deploymentId: env.AZURE_OPENAI_DEPLOYMENT,
 * });
 * ```
 */
export function createAzureOpenAiClient(config: AzureOpenAiConfig): AiClient {
  const { endpoint, apiKey, deploymentId,
          apiVersion = '2024-06-01' } = config;

  return {
    async chat(prompt: string, options: AiChatOptions = {}): Promise<AiChatResponse> {
      const url = `${endpoint}/openai/deployments/${deploymentId}/chat/completions?api-version=${apiVersion}`;

      const messages: { role: string; content: string }[] = [];
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 800,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
          `Azure OpenAI error: ${response.status} ${response.statusText}${errorText ? ` — ${errorText.slice(0, 200)}` : ''}`,
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? '';

      return {
        content,
        model: data.model ?? deploymentId,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens ?? 0,
              completionTokens: data.usage.completion_tokens ?? 0,
              totalTokens: data.usage.total_tokens ?? 0,
            }
          : undefined,
      };
    },
  };
}

// ────────────────────────────────────────────────────────────
// Mock 実装（テスト・開発用）
// ────────────────────────────────────────────────────────────

export interface MockAiClientOptions {
  /** 返すレスポンス文字列 */
  response?: string;
  /** モデル名 */
  model?: string;
  /** 人工的な遅延 (ms) */
  delayMs?: number;
  /** 強制的にエラーを投げる */
  shouldError?: boolean;
  /** エラーメッセージ */
  errorMessage?: string;
}

/**
 * テスト・開発用のモック AI クライアントを作成する。
 *
 * @example
 * ```ts
 * const client = createMockAiClient({ response: '{"summary":"テスト"}' });
 * const res = await client.chat('prompt');
 * // res.content === '{"summary":"テスト"}'
 * ```
 */
export function createMockAiClient(options: MockAiClientOptions = {}): AiClient {
  const {
    response = '{"summary":"テスト要約","keyPoints":[],"suggestedActions":[],"userHighlights":[]}',
    model = 'mock',
    delayMs = 0,
    shouldError = false,
    errorMessage = 'Mock AI error',
  } = options;

  return {
    async chat(): Promise<AiChatResponse> {
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      if (shouldError) {
        throw new Error(errorMessage);
      }

      return {
        content: response,
        model,
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      };
    },
  };
}
