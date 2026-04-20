import { useAuth } from './useAuth';

/**
 * useAuthReady — 実行レイヤーの「通信可能状態」を判定する標準フック
 * 
 * ADR-020: Auth Readiness Contract に基づき、
 * 認証が完了し、MSALがアイドルで、かつトークン取得が可能な状態であるかを確認します。
 * 
 * 背景タスクや初期化IOを開始する際のガードとして使用してください。
 */
export function useAuthReady(): boolean {
  const { isAuthReady } = useAuth();
  return isAuthReady;
}
