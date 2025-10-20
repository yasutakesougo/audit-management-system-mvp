import {
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { getUserProfile, upsertUserProfile } from '../adapters/userProfile.api';
import type { UserProfile } from '../types/userProfile';
import { profileToAssessmentLiteDefaults } from '../features/assessment/bridge';
import { AssessmentFoldout } from './IndividualSupportManagementPage';
import type { AssessmentLite } from './IndividualSupportManagementPage';

type FieldDefinition = {
  fieldName: string;
  dataType: string;
  description: string;
  example?: string;
};

const fieldDefinitions: FieldDefinition[] = [
  {
    fieldName: 'personalInfo',
    dataType: 'Object',
    description: '利用者の基本情報',
    example: 'name, dateOfBirth, gender, address, contact',
  },
  {
    fieldName: 'administrativeInfo',
    dataType: 'Object',
    description: '行政関連情報',
    example: 'disabilityHandbook (Object), disabilitySupportCategory (String), serviceRecipientNumber (String)',
  },
  {
    fieldName: 'familyComposition',
    dataType: 'Array<Object>',
    description: '家族構成員の情報',
    example: 'name, relationship, age, isCohabiting (Boolean)',
  },
  {
    fieldName: 'serviceHistory',
    dataType: 'Array<Object>',
    description: '過去および現在のサービス利用履歴',
    example: 'serviceName, provider, startDate, endDate, status',
  },
  {
    fieldName: 'medicalHistory',
    dataType: 'Array<Object>',
    description: '既往歴、アレルギー、服薬情報',
    example: 'condition, physician, medications (Array), allergies (Array)',
  },
  {
    fieldName: 'lifeHistory',
    dataType: 'Object',
    description: '生活歴、学歴、職歴などのナラティブ情報',
    example: 'education (String), employment (String), narrative (String)',
  },
  {
    fieldName: 'hopesAndGoals',
    dataType: 'String',
    description: '本人および家族の希望や長期的な目標',
  },
  {
    fieldName: 'assessments',
    dataType: 'Array<Object>',
    description: '実施されたアセスメントの結果',
    example: 'assessmentType (例: "Strengths"), date, assessor, results (Object)',
  },
  {
    fieldName: 'supportPlan',
    dataType: 'Object',
    description: '現在の個別支援計画書',
    example: 'longTermGoals, shortTermGoals, specificSupports (Array), monitoringSchedule',
  },
  {
    fieldName: 'legacyDocuments',
    dataType: 'Array<Object>',
    description: 'OCRでデジタル化された過去の記録',
    example: 'documentTitle, originalDate, extractedText, fileLink',
  },
];

export default function UserProfileFaceSheetPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const { userId } = useParams<{ userId: string }>();
  const uid = userId ?? 'user001';

  useEffect(() => {
    getUserProfile(uid).then(setProfile);
  }, [uid]);

  if (!profile) {
    return null;
  }

  const defaultsRaw = profileToAssessmentLiteDefaults(profile);
  const defaults: AssessmentLite = {
    strengths: defaultsRaw.strengths,
    iceberg: defaultsRaw.iceberg,
    aba: defaultsRaw.aba,
    notes: undefined,
    updatedAt: profile.assessments?.lastUpdated,
  };
  const handleSave = () => {
    void upsertUserProfile(profile);
  };

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Paper sx={{ p: 2 }} role="region" aria-label="統合利用者プロファイル ヘッダー">
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          統合利用者プロファイル
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {profile.personalInfo.name}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button size="small" component={RouterLink} to={`/records/diary/${uid}`} variant="outlined">
            活動日誌へ
          </Button>
          <Button size="small" component={RouterLink} to={`/records/support-procedures/${uid}`} variant="outlined">
            支援手順記録へ
          </Button>
          <Button size="small" component={RouterLink} to={`/support-plans/guide?userId=${uid}`} variant="outlined">
            計画ガイドへ
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }} role="region" aria-label="基本情報">
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          基本情報
        </Typography>
        <Divider sx={{ my: 1 }} />
        <Stack direction="row" spacing={4}>
          <Stack>
            <Typography variant="caption">生年月日</Typography>
            <Typography>{profile.personalInfo.birthDate ?? '—'}</Typography>
          </Stack>
          <Stack>
            <Typography variant="caption">住所</Typography>
            <Typography>{profile.personalInfo.address ?? '—'}</Typography>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }} role="region" aria-label="本人と家族の希望">
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          本人・家族の希望
        </Typography>
        <Divider sx={{ my: 1 }} />
        <Typography sx={{ whiteSpace: 'pre-wrap' }}>
          {profile.hopesAndGoals?.person ?? '—'}
        </Typography>
      </Paper>

      <Paper sx={{ p: 2 }} role="region" aria-label="アセスメント サマリー">
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          アセスメント サマリー
        </Typography>
        <Divider sx={{ my: 1 }} />
        <AssessmentFoldout value={defaults} onChange={() => {}} />
        <Typography variant="caption" color="text.secondary">
          ※ このビューはサマリ表示です。編集は「支援手順記録」から行ってください。
        </Typography>
      </Paper>

      <Stack direction="row" justifyContent="flex-end">
        <Button variant="outlined" onClick={handleSave}>
          保存
        </Button>
      </Stack>

      <Paper sx={{ p: 2 }} role="region" aria-label="統合利用者記録フィールド仕様">
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          統合利用者記録フィールド仕様
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          利用者プロファイル JSON の主なフィールド構造です。アプリや連携基盤での拡張時に参照してください。
        </Typography>
        <Table size="small" aria-label="統合利用者記録 フィールド定義">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>フィールド名</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>データ型</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>概要</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>サブフィールド例</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fieldDefinitions.map((field) => (
              <TableRow key={field.fieldName}>
                <TableCell sx={{ fontFamily: 'monospace' }}>{field.fieldName}</TableCell>
                <TableCell>{field.dataType}</TableCell>
                <TableCell>{field.description}</TableCell>
                <TableCell>{field.example ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
