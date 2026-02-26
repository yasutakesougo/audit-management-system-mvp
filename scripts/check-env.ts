// scripts/check-env.ts
import dotenv from 'dotenv';
import { AppEnvSchema } from '../src/lib/env.schema';

// 1. 本番用設定ファイルを読み込む（GitHub Secretsに登録する前のローカル検証用）
dotenv.config({ path: '.env.production' });

console.log('🚀 [Check] 本番環境変数の整合性チェックを開始します...');

// 2. スキーマによる検証実行
const result = AppEnvSchema.safeParse(process.env);

if (result.success) {
  console.log('✅ [Success] すべての必須変数がスキーマに適合しています。デプロイ準備完了です！');
} else {
  console.log('❌ [Error] 設定に不備があります。以下の項目を修正してください：');

  // エラー内容を分かりやすく表示
  const formatted = result.error.format();
  Object.keys(formatted).forEach((key) => {
    if (key !== '_errors') {
      console.error(`  - ${key}: ${(formatted as any)[key]._errors.join(', ')}`);
    }
  });
  process.exit(1);
}
