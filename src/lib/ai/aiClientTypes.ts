/**
 * AI Client — 型定義
 *
 * Adapter パターンで AI サービスを差し替え可能にする。
 * Azure OpenAI / Mock / Cloudflare Workers 等。
 */

/** AI チャットのオプション */
export interface AiChatOptions {
  /** システムプロンプト */
  systemPrompt?: string;
  /** 温度 (0-1)。低いほど決定性が高い */
  temperature?: number;
  /** 最大生成トークン数 */
  maxTokens?: number;
}

/** AI チャットの応答 */
export interface AiChatResponse {
  /** 生成されたテキスト */
  content: string;
  /** 使用されたモデル名 */
  model: string;
  /** トークン使用量（取得可能な場合） */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * AI Client インターフェース。
 *
 * Adapter パターンにより実装を差し替え可能。
 * - Azure OpenAI
 * - Mock（テスト・開発用）
 * - Cloudflare Workers Proxy
 */
export interface AiClient {
  chat(prompt: string, options?: AiChatOptions): Promise<AiChatResponse>;
}
