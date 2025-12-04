import UsersBreadcrumbs from '@/features/users/components/UsersBreadcrumbs';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type { FC } from 'react';

const scenarioList: Array<{ title: string; description: string }> = [
  {
    title: 'モニタリングと即応',
    description:
      '行動障害支援の対象者ごとに、予定された支援と実績を同一画面で比較し、未対応の危険兆候があれば看護・生活支援へ即時アラートを出す。'
  },
  {
    title: '多職種の業務引き継ぎ',
    description:
      '夜勤から日勤への申し送り、及び本社専門職へのエスカレーションを支援し、支援手順の変更履歴と理由を明確に残す。'
  },
  {
    title: '監査証跡とガイドライン準拠',
    description:
      '障害者総合支援法ガイドラインに従い、支援計画・行動記録・インシデントメモを紐付け、第三者検証に耐えるログを確保する。'
  }
];

const workflowRows: Array<{ phase: string; focus: string; collaboration: string; evidence: string }> = [
  {
    phase: '事前準備',
    focus: '支援手順書の最新差分、危険行動の予兆タグ、環境調整タスクを把握する。',
    collaboration: '相談支援専門員からの依頼事項を確認し、生活支援員と役割分担を調整する。',
    evidence: '支援計画の改定履歴、直近一週間の行動ログをリンク表示する。'
  },
  {
    phase: '支援実施中',
    focus: '予定と実績のズレをタイムラインで捕捉し、介入の効果と未対応事項を即時メモ化する。',
    collaboration: '看護・心理担当へエスカレーションする際、必要な観察情報をテンプレートで共有する。',
    evidence: '支援ステップの完了状態、ABC記録、使用した環境調整リソースを構造化保存する。'
  },
  {
    phase: '事後振り返り',
    focus: '高リスク事象の再発防止策と、次回支援までのフォローアップタスクを設定する。',
    collaboration: '管理者レビューと家族連絡の要否を判定し、必要なフォローを依頼者に可視化する。',
    evidence: 'レビュー記録、通知履歴、タスク完了ログを一元化し監査可能性を確保する。'
  },
  {
    phase: '計画改定',
    focus: '支援効果指標を集約し、行動障害特性の変化を定量・定性の両面で評価する。',
    collaboration: '個別支援計画のモニタリング会議と接続し、意思決定材料を迅速に提供する。',
    evidence: '計画との整合性、評価コメント、承認ルートの履歴を保全する。'
  }
];

const alignmentChecklist = [
  '個別支援計画で定義した目標・支援ステップを、支援手順兼記録のテンプレートに自動反映すること。',
  '支援加算の算定要件を満たす項目（支援時間、対応者、評価）を欠かさず記録できること。',
  '重大インシデント・ヒヤリハットをタグ付きで登録し、事業所時間割記録や健康記録と相互参照できること。',
  '未完了タスクや確認事項を次シフトの担当者へ引き継ぐ際、期限と重要度が明確に共有されること。'
];

const trainingModules = [
  'プロトコル策定ワークショップ: 手順書と記録フォーマットを現場の業務フローに合わせてカスタマイズ。',
  'デイリー運用トレーニング: 行動観察から記録入力までをロールプレイで反復し、タグ設定の基準を統一。',
  'レビュー会議テンプレート: 多職種の振り返りミーティングで利用するアジェンダと資料テンプレートを提供。'
];

const integrationRoadmap = [
  'MVP: 既存の事業所時間割記録と連携し、支援手順テンプレートの閲覧・出力を優先提供。',
  'Phase 2: ABC記録や行動要因分析を入力できるフォームと、未対応タスクの通知機能を追加。',
  'Phase 3: 計画改定ワークフローと承認フローを統合し、監査レポートを自動生成する。'
];

const UsersSupportProcedurePage: FC = () => (
  <Container maxWidth="lg" sx={{ py: 6 }}>
    <Stack spacing={4}>
      <UsersBreadcrumbs section="support-procedure" />

      <Paper elevation={2} sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={2}>
          <Typography variant="h3" component="h1" fontWeight={700} data-testid="support-procedure-title">
            支援手順兼記録 UI 要件レポート
          </Typography>
          <Alert severity="info" variant="outlined">
            の支援現場における「支援手順兼記録」の位置づけを整理し、既存の事業所時間割記録・健康記録との連携観点をまとめたレポートです。入力機能の実装に先立ち、チームで共有すべき情報構造と運用ルールを可視化します。
          </Alert>
          <Typography variant="body2" color="text.secondary">
            ※本ページは将来の入力画面の設計指針を示すドキュメントであり、現時点では支援データの参照・設計レビュー用として活用します。
          </Typography>
          <Chip label="支援" color="warning" sx={{ alignSelf: 'flex-start' }} />
          <Typography variant="body1">
            支援手順兼記録は、個別支援計画で定義された支援方法と日々の行動記録を一体化し、スタッフが同じシナリオを共有できるようにする業務基盤です。本レポートでは「誰が・いつ・どの情報を更新するか」というワークフローを整理し、段階的なシステム整備のロードマップを提示します。
          </Typography>
        </Stack>
      </Paper>

      <Paper elevation={1} sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" component="h2" fontWeight={600} data-testid="support-procedure-section-scenarios">
              導入シナリオと業務ゴール
            </Typography>
            <Typography variant="body2" color="text.secondary">
              支援手順兼記録が解決すべき現場課題を三つの代表的なシナリオで整理し、優先する成果指標を明確化します。
            </Typography>
          </Box>
          <List sx={{ listStyleType: 'disc', pl: 4 }}>
            {scenarioList.map((scenario) => (
              <ListItem key={scenario.title} sx={{ display: 'list-item' }}>
                <ListItemText primary={scenario.title} secondary={scenario.description} />
              </ListItem>
            ))}
          </List>
        </Stack>
      </Paper>

      <Paper elevation={1} sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" component="h2" fontWeight={600} data-testid="support-procedure-section-workflow">
              ランブック視点のワークフロー
            </Typography>
            <Typography variant="body2" color="text.secondary">
              支援の準備から振り返りまでのフェーズを標準化し、各段階で必要なコラボレーションと記録の粒度を定義します。
            </Typography>
          </Box>
          <Box sx={{ width: '100%', overflowX: 'auto' }} data-testid="support-procedure-workflow-table">
            <Table size="small" sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>フェーズ</TableCell>
                  <TableCell>目的と着目点</TableCell>
                  <TableCell>連携・通知</TableCell>
                  <TableCell>ログ・証跡</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {workflowRows.map((row) => (
                  <TableRow key={row.phase}>
                    <TableCell sx={{ fontWeight: 600 }}>{row.phase}</TableCell>
                    <TableCell>{row.focus}</TableCell>
                    <TableCell>{row.collaboration}</TableCell>
                    <TableCell>{row.evidence}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Stack>
      </Paper>

      <Paper elevation={1} sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" component="h2" fontWeight={600} data-testid="support-procedure-section-checklist">
              データ連携チェックリスト
            </Typography>
            <Typography variant="body2" color="text.secondary">
              既存の記録資産と整合するための必須条件を列挙し、開発時の受け入れ基準として利用します。
            </Typography>
          </Box>
          <List sx={{ listStyleType: 'disc', pl: 4 }}>
            {alignmentChecklist.map((item) => (
              <ListItem key={item} sx={{ display: 'list-item' }}>
                <ListItemText primary={item} />
              </ListItem>
            ))}
          </List>
        </Stack>
      </Paper>

      <Paper elevation={1} sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" component="h2" fontWeight={600} data-testid="support-procedure-section-training">
              運用支援と育成プログラム
            </Typography>
            <Typography variant="body2" color="text.secondary">
              現場リリース後にスタッフが迷わず利用できるよう、研修とレビューの仕組みをセットで提供します。
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(3, 1fr)',
              },
            }}
            data-testid="support-procedure-training-modules"
          >
            {trainingModules.map((module) => {
              const [title, ...rest] = module.split(':');
              const description = rest.join(':').trim();
              return (
                <Paper variant="outlined" sx={{ p: 2 }} key={module}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {title}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    {description}
                  </Typography>
                </Paper>
              );
            })}
          </Box>
        </Stack>
      </Paper>

      <Paper elevation={1} sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" component="h2" fontWeight={600} data-testid="support-procedure-section-roadmap">
              ロードマップと今後の整備ポイント
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ステップアップの観点で三段階のマイルストーンを提示し、開発・運用双方の優先順位づけに役立てます。
            </Typography>
          </Box>
          <List sx={{ listStyleType: 'disc', pl: 4 }}>
            {integrationRoadmap.map((milestone) => (
              <ListItem key={milestone} sx={{ display: 'list-item' }}>
                <ListItemText primary={milestone} />
              </ListItem>
            ))}
          </List>
        </Stack>
      </Paper>
    </Stack>
  </Container>
);

export default UsersSupportProcedurePage;
