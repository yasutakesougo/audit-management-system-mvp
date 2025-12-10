import { warmAll, warmAsync, warmDataEntryComponents, warmTableComponents } from '@/mui/warm';

/**
 * ルート遷移時のMUIコンポーネントプリロード戦略
 *
 * 使用パターン:
 * 1. ナビゲーションリンクのhover時にプリロード
 * 2. 画面遷移直前の事前読み込み
 * 3. アイドル時間での投機的プリロード
 */

/**
 * ルートベースのプリロード戦略
 * @param route - 遷移先のルート
 */
export const routingPreloadStrategy = async (route: string): Promise<void> => {
  console.log(`[preload] routing-based preload triggered for ${route}`);

  try {
    const normalizedRoute = route.toLowerCase();

    if (normalizedRoute.includes('audit') || normalizedRoute.includes('dashboard')) {
      await warmTableComponents();
    } else if (normalizedRoute.includes('entry') || normalizedRoute.includes('attendance')) {
      await warmDataEntryComponents();
    } else {
      await warmAll();
    }
  } catch {
    // プリロード失敗は非致命的エラーとして処理
  }
};

/**
 * ダッシュボードから各画面への遷移時プリロード
 */
export const preloadStrategies = {
  /**
   * 出席記録画面への遷移時
   * Card、Dialog、Form系コンポーネントを事前読み込み
   */
  attendance: () => warmAsync(),

  /**
   * スケジュール画面への遷移時
   * Table、Calendar系コンポーネントを事前読み込み
   */
  schedules: () => warmAsync(),

  /**
   * ユーザー管理画面への遷移時
   * DataGrid、Form系コンポーネントを事前読み込み
   */
  users: () => warmAsync(),

  /**
   * 監査ログ画面への遷移時
   * Table、Filter系コンポーネントを事前読み込み
   */
  audit: () => warmAsync(),
} as const;

/**
 * ナビゲーションリンクでの使用例:
 *
 * <Link
 *   to="/attendance"
 *   onMouseEnter={() => preloadStrategies.attendance()}
 *   onFocus={() => preloadStrategies.attendance()}
 * >
 *   出席記録
 * </Link>
 */

/**
 * React Router loader での使用例:
 *
 * export const attendanceLoader = async () => {
 *   // データ読み込みと並行してコンポーネントもプリロード
 *   const [data] = await Promise.all([
 *     fetchAttendanceData(),
 *     warmDataEntryComponents() // データ読み込み中にコンポーネントも準備
 *   ]);
 *   return data;
 * };
 */

/**
 * アイドル時間での投機的プリロード
 * ユーザーが何もしていない時間を活用して事前読み込み
 */
export const speculativePreload = (): void => {
  console.log('[preload] speculative preload started');

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      warmAsync();
    }, { timeout: 5000 });
  } else {
    // requestIdleCallback未対応の場合は短い遅延で実行
    setTimeout(() => warmAsync(), 1000);
  }
};

/**
 * 接続品質に応じたプリロード戦略
 * 低速接続時はプリロードを控えめに
 */
export const adaptivePreload = async (): Promise<void> => {
  if (typeof navigator !== 'undefined' && 'connection' in navigator) {
    const connection = (navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        saveData?: boolean;
      }
    }).connection;

    // データセーバーモードの場合はスキップ
    if (connection?.saveData) {
      console.log('[preload] skipping preload due to data saver mode');
      return;
    }

    // 低速接続の場合はスキップ
    if (connection?.effectiveType &&
        ['slow-2g', '2g'].includes(connection.effectiveType)) {
      console.log('[preload] skipping preload due to slow connection');
      return;
    }
  }

  // 高速接続または接続情報不明時はプリロード実行
  await warmAll();
  console.log('[preload] adaptive preload completed');
};

export default preloadStrategies;