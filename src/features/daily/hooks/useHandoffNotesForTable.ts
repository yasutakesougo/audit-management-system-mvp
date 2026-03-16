/**
 * Re-export from adapters layer.
 * hooks/ 以下でのインポート互換性を保つ。
 *
 * @deprecated adapters/useHandoffNotesForTable から直接 import してください
 */
export { useHandoffNotesForTable, type HandoffNotesForTableResult } from '../adapters/useHandoffNotesForTable';
