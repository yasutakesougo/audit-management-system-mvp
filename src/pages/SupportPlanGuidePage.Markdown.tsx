import { estimatePayloadSize } from '@/hydration/features';
import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export type MarkdownPreviewProps = {
  content: string;
  spanComplete?: (completion?: { meta?: Record<string, unknown>; error?: string }) => unknown;
} & React.ComponentProps<'div'>;

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  spanComplete,
  className,
  ...rest
}) => {
  const lastContentRef = useRef<string | null>(null);

  useEffect(() => {
    // spanComplete が提供されていない場合は何もしない
    if (!spanComplete) return;

    // 同じ content で重複して呼び出されるのを防ぐ
    if (lastContentRef.current === content) return;

    // content が変わったので、新しいメタデータでスパンを完了
    lastContentRef.current = content;

    try {
      spanComplete({
        meta: {
          characters: content.length,
          bytes: estimatePayloadSize(content),
          contentHash: content.length > 0 ? content.slice(0, 100) + '...' : '',
          timestamp: Date.now()
        }
      });
    } catch (error) {
      // spanComplete でエラーが発生した場合でもレンダリングは継続
      spanComplete({
        error: error instanceof Error ? error.message : 'Unknown error in spanComplete'
      });
    }
  }, [content, spanComplete]);

  return (
    <div className={className} {...rest}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
};

export default MarkdownPreview;
