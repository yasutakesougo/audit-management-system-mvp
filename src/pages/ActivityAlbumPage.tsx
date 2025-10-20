import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PhotoAlbumRoundedIcon from '@mui/icons-material/PhotoAlbumRounded';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import dayjs from 'dayjs';
import React from 'react';

type AlbumHighlight = {
  id: string;
  title: string;
  takenAt: string;
  location: string;
  tags: string[];
  description: string;
};

const eventHighlights: AlbumHighlight[] = [
  {
    id: '2025-spring-festival',
    title: '春の地域交流フェスタ',
    takenAt: '2025-04-14T10:00:00+09:00',
    location: '磯子区公園',
    tags: ['イベント', '屋外活動', '地域交流'],
    description:
      '天候にも恵まれ、地域住民の方々と一緒にゲームや茶話会を楽しみました。手作りのガーランドが会場を彩りました。',
  },
  {
    id: '2025-workshop',
    title: 'アトリエワークショップ',
    takenAt: '2025-03-05T13:30:00+09:00',
    location: '創作ルーム',
    tags: ['創作活動', '作品展示'],
    description:
      '陶芸班と手芸班の合同企画。完成した作品は施設の玄関に展示し、お迎えに来られた家族からも好評でした。',
  },
];

const personalHighlights: AlbumHighlight[] = [
  {
    id: 'user001-2025-03-01',
    title: 'Aさんのリズム活動チャレンジ',
    takenAt: '2025-03-01T11:15:00+09:00',
    location: '音楽スタジオ',
    tags: ['個別記録', '音楽', '成長記録'],
    description:
      '得意なドラムに加えてキーボードにも挑戦。支援者が伴奏を合わせることで集中が続き、最後まで演奏できました。',
  },
  {
    id: 'user012-2025-02-20',
    title: 'Bさんのクッキング記録',
    takenAt: '2025-02-20T15:00:00+09:00',
    location: '生活訓練室',
    tags: ['調理訓練', '生活スキル', '本人記録'],
    description:
      '包丁の持ち方を復習しながら、野菜スープを作りました。安全確認の声かけに自ら応じる姿が印象的でした。',
  },
];

const ActivityAlbumPage: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={4}>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CollectionsBookmarkRoundedIcon color="primary" fontSize="large" />
            <Typography variant="h4" component="h1">
              活動アルバム
            </Typography>
          </Stack>
          <Typography variant="body1" color="text.secondary">
            行事・プログラムの様子から個別支援のワンシーンまで、写真と記録を一元管理します。
            施設全体の共有アルバムと、利用者ごとの個別アルバムを切り替えてご利用ください。
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip icon={<GroupRoundedIcon fontSize="small" />} label="全体記録" color="primary" variant="outlined" />
            <Chip icon={<PersonRoundedIcon fontSize="small" />} label="個人別記録" color="primary" variant="outlined" />
            <Chip label="公開設定・同意管理対応" size="small" />
          </Stack>
        </Stack>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PhotoAlbumRoundedIcon color="primary" />
                全体アルバム（イベント・活動風景）
              </Typography>
              <Typography variant="body2" color="text.secondary">
                定例行事や特別プログラムの写真、活動報告をアーカイブします。撮影許諾の確認状況や、広報用への転用可否もここで管理できます。
              </Typography>
              <Stack
                spacing={2}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                }}
              >
                {eventHighlights.map((highlight) => (
                  <Card key={highlight.id} variant="outlined" sx={{ display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Stack spacing={1.5}>
                        <Stack spacing={0.5}>
                          <Typography variant="subtitle2" color="text.secondary">
                            {dayjs(highlight.takenAt).format('YYYY年MM月DD日 (ddd) HH:mm')} / {highlight.location}
                          </Typography>
                          <Typography variant="h6">{highlight.title}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {highlight.tags.map((tag) => (
                            <Chip key={tag} label={tag} size="small" />
                          ))}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {highlight.description}
                        </Typography>
                      </Stack>
                    </CardContent>
                    <CardActions sx={{ px: 2, pb: 2 }}>
                      <Button variant="contained" size="small" sx={{ flexGrow: 1 }}>
                        アルバムを見る
                      </Button>
                      <Button variant="outlined" size="small">
                        配布資料を作成
                      </Button>
                    </CardActions>
                  </Card>
                ))}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Divider />

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonRoundedIcon color="primary" />
                個人アルバム（個別記録）
              </Typography>
              <Typography variant="body2" color="text.secondary">
                個別支援計画や面談で活用できる写真・記録を利用者単位で整理します。家族共有用のダイジェスト資料やモニタリング資料もここから作成できます。
              </Typography>
              <Stack
                spacing={2}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                }}
              >
                {personalHighlights.map((highlight) => (
                  <Card key={highlight.id} variant="outlined" sx={{ display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Stack spacing={1.5}>
                        <Stack spacing={0.5}>
                          <Typography variant="subtitle2" color="text.secondary">
                            {dayjs(highlight.takenAt).format('YYYY年MM月DD日 (ddd) HH:mm')} / {highlight.location}
                          </Typography>
                          <Typography variant="h6">{highlight.title}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {highlight.tags.map((tag) => (
                            <Chip key={tag} label={tag} size="small" color="secondary" variant="outlined" />
                          ))}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {highlight.description}
                        </Typography>
                      </Stack>
                    </CardContent>
                    <CardActions sx={{ px: 2, pb: 2 }}>
                      <Button variant="contained" size="small" sx={{ flexGrow: 1 }}>
                        個別アルバムを見る
                      </Button>
                      <Button variant="outlined" size="small">
                        モニタリング資料へ追加
                      </Button>
                    </CardActions>
                  </Card>
                ))}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
};

export default ActivityAlbumPage;
