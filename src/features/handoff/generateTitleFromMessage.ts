/**
 * メッセージ内容からタイトルを自動生成
 * SharePoint のタイトルフィールド用（必須項目対応）
 */
export function generateTitleFromMessage(message: string): string {
  if (!message || message.trim() === '') {
    return '申し送り事項';
  }

  // メッセージを50文字以内に要約してタイトル化
  const cleanMessage = message.trim().replace(/\n+/g, ' ');

  if (cleanMessage.length <= 50) {
    return cleanMessage;
  }

  // 50文字で区切り、適切な区切り位置を探す
  const truncated = cleanMessage.substring(0, 50);
  const lastSpace = truncated.lastIndexOf(' ');
  const lastPunctuation = Math.max(
    truncated.lastIndexOf('。'),
    truncated.lastIndexOf('、'),
    truncated.lastIndexOf('！'),
    truncated.lastIndexOf('？'),
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf(',')
  );

  // 適切な区切り位置がある場合はそこで切る
  if (lastPunctuation > 20) {
    return truncated.substring(0, lastPunctuation + 1);
  } else if (lastSpace > 20) {
    return truncated.substring(0, lastSpace) + '...';
  } else {
    return truncated + '...';
  }
}

/**
 * メッセージ内容からカテゴリを推定
 * 自動分類支援用（オプション機能）
 */
export function estimateCategoryFromMessage(message: string): string {
  const lowerMessage = message.toLowerCase();

  // 業務関連キーワード
  if (lowerMessage.includes('監査') || lowerMessage.includes('audit')) {
    return 'audit';
  }
  if (lowerMessage.includes('システム') || lowerMessage.includes('system') || lowerMessage.includes('エラー') || lowerMessage.includes('障害')) {
    return 'system';
  }
  if (lowerMessage.includes('お客') || lowerMessage.includes('クライアント') || lowerMessage.includes('client')) {
    return 'client';
  }
  if (lowerMessage.includes('スケジュール') || lowerMessage.includes('予定') || lowerMessage.includes('会議')) {
    return 'schedule';
  }
  if (lowerMessage.includes('リスク') || lowerMessage.includes('問題') || lowerMessage.includes('課題')) {
    return 'risk';
  }
  if (lowerMessage.includes('進捗') || lowerMessage.includes('状況') || lowerMessage.includes('報告')) {
    return 'progress';
  }

  // デフォルトは業務
  return 'general';
}

/**
 * メッセージ内容から重要度を推定
 * 自動分類支援用（オプション機能）
 */
export function estimateSeverityFromMessage(message: string): string {
  const lowerMessage = message.toLowerCase();

  // 緊急度の高いキーワード
  const urgentKeywords = ['緊急', 'urgent', '至急', '重要', 'important', '問題', '障害', 'エラー', '遅延'];
  const warningKeywords = ['注意', 'warning', '要確認', '気をつけ', '留意'];

  const hasUrgentKeyword = urgentKeywords.some(keyword => lowerMessage.includes(keyword));
  const hasWarningKeyword = warningKeywords.some(keyword => lowerMessage.includes(keyword));

  if (hasUrgentKeyword) {
    return 'high';
  } else if (hasWarningKeyword) {
    return 'medium';
  } else {
    return 'low';
  }
}