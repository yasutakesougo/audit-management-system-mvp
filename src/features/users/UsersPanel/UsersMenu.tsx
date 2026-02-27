import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { FC } from 'react';

type UsersMenuProps = {
  onNavigateToList: () => void;
  onNavigateToCreate: () => void;
  onExportMonthlySummary?: () => void;
};

const UsersMenu: FC<UsersMenuProps> = ({
  onNavigateToList,
  onNavigateToCreate,
  onExportMonthlySummary
}) => (
  <Stack spacing={2.5}>
    <BoxHeading />
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <Button
        fullWidth
        variant="outlined"
        startIcon={<PeopleAltRoundedIcon />}
        onClick={onNavigateToList}
      >
        利用者一覧を表示
      </Button>
      <Button
        fullWidth
        variant="contained"
        startIcon={<PersonAddRoundedIcon />}
        onClick={onNavigateToCreate}
      >
        新規利用者登録
      </Button>
    </Stack>

    <Stack spacing={1.5}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        帳票出力・データエクスポート
      </Typography>
      <Button
        variant="outlined"
        color="secondary"
        startIcon={<FileDownloadRoundedIcon />}
        onClick={onExportMonthlySummary}
        sx={{ alignSelf: 'flex-start' }}
      >
        利用実績月次サマリ (Excel) 出力
      </Button>
    </Stack>

    <Typography variant="body2" color="text.secondary">
      利用者一覧タブでは詳細表示・編集・削除、登録タブでは簡易登録や詳細フォームによる登録が行えます。
    </Typography>
  </Stack>
);

const BoxHeading: FC = () => (
  <Stack spacing={0.5}>
    <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
      利用者メニュー
    </Typography>
    <Typography variant="body2" color="text.secondary">
      利用者一覧を確認するか、新規利用者登録を選択してください。
    </Typography>
  </Stack>
);

export default UsersMenu;
