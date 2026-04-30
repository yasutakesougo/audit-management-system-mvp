/**
 * MeetingMinutesBlockEditor — BlockNote ベースのブロックエディタ
 *
 * 責務:
 * - BlockNote エディタの初期化とレンダリング
 * - カスタムスキーマ (decision / action ブロック含む) の使用
 * - 初期値 (MeetingMinuteBlock[]) の受け取り
 * - onChange で変更後のブロック配列を返却
 * - 議事録専用 Slash メニューの提供
 *
 * MeetingMinutesForm から利用され、
 * summary/decisions/actions の TextArea を置き換える。
 */
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

import { filterSuggestionItems } from '@blocknote/core/extensions';
import { BlockNoteView } from '@blocknote/mantine';
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from '@blocknote/react';
import { Box, Typography } from '@mui/material';
import { useCallback, useMemo, useRef } from 'react';

import type { MeetingCategory, MeetingMinuteBlock } from '../types';
import { meetingMinutesSchema } from '../editor/blockKinds';
import { normalizeMeetingMinuteBlocks } from '../editor/blockNormalizer';
import { getMeetingMinutesSlashMenuItems } from '../editor/slashMenuItems';

export type MeetingMinutesBlockEditorProps = {
  value: MeetingMinuteBlock[];
  onChange: (blocks: MeetingMinuteBlock[]) => void;
  category: MeetingCategory;
};

/**
 * BlockNote の Block 型を内部の MeetingMinuteBlock に変換する。
 * BlockNote の Block 型は内部に複雑な generic があるため、
 * 安全に serializable な最小サブセットに射影する。
 */
function toMinuteBlocks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bnBlocks: readonly any[]
): MeetingMinuteBlock[] {
  return bnBlocks.map((b) => ({
    id: String(b.id ?? ''),
    type: String(b.type ?? 'paragraph'),
    props: (b.props as Record<string, unknown>) ?? {},
    content: Array.isArray(b.content) ? b.content : [],
    children: Array.isArray(b.children) ? toMinuteBlocks(b.children) : [],
  }));
}

export function MeetingMinutesBlockEditor(
  props: MeetingMinutesBlockEditorProps
) {
  const { value, onChange, category } = props;

  // onChange の最新参照を useRef で保持して副作用ループを防ぐ
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // 初期コンテンツ: 正規化してから BlockNote へ渡す
  const normalized = normalizeMeetingMinuteBlocks(value);
  const initialContent = normalized.length > 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (normalized as any[])
    : undefined;

  // カスタムスキーマ付きエディタを生成
  const editor = useCreateBlockNote({
    schema: meetingMinutesSchema,
    initialContent,
  });

  // Slash メニュー: 議事録専用項目を先頭に、標準項目を後続に配置
  const slashMenuItems = useMemo(
    () => [
      ...getMeetingMinutesSlashMenuItems(editor),
      ...getDefaultReactSlashMenuItems(editor),
    ],
    [editor]
  );

  const handleChange = useCallback(() => {
    const blocks = toMinuteBlocks(editor.document);
    onChangeRef.current(blocks);
  }, [editor]);

  const editorLabel =
    category === '朝会'
      ? '朝会 議事録'
      : category === '夕会'
        ? '夕会 議事録'
        : '議事録本文';

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {editorLabel}（ブロックエディタ）
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {'💡 「/」を入力すると議事録メニューが開きます（議題・報告・決定事項・アクション・連絡事項 他）'}
      </Typography>
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          minHeight: 300,
          '& .bn-container': {
            minHeight: 280,
          },
        }}
      >
        <BlockNoteView
          editor={editor}
          onChange={handleChange}
          theme="light"
          slashMenu={false}
        >
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) =>
              filterSuggestionItems(slashMenuItems, query)
            }
          />
        </BlockNoteView>
      </Box>
    </Box>
  );
}
