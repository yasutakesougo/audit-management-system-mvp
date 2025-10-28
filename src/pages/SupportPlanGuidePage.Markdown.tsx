import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export type MarkdownPreviewProps = {
  content: string;
  spanComplete?: (completion?: { meta?: Record<string, unknown>; error?: string }) => unknown;
};

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, spanComplete }) => {
  const finalizedRef = useRef(false);

  useEffect(() => {
    if (finalizedRef.current || !spanComplete) {
      return;
    }
    spanComplete({ meta: { characters: content.length } });
    finalizedRef.current = true;
  }, [content.length, spanComplete]);

  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
};

export default MarkdownPreview;
