/**
 * UserLinkSection — 利用者マスタ紐付けUI
 *
 * OverviewTab の最上部に配置。
 * 利用者マスタから利用者を選択し、ドラフトと明示的に紐付ける。
 * 紐付け状態を視覚的にわかりやすく表示する。
 */
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { UserOption } from '../../types';

export type UserLinkSectionProps = {
  /** 現在のドラフトに紐づいている利用者ID（null = 未紐付け） */
  linkedUserId: number | string | null | undefined;
  /** 現在のドラフトに紐づいている利用者コード */
  linkedUserCode: string | null | undefined;
  /** 現在のドラフトの利用者名 */
  linkedUserName: string;
  /** 利用者マスタ選択肢 */
  userOptions: UserOption[];
  /** 管理者かどうか */
  isAdmin: boolean;
  /** 利用者を選択したときのハンドラ */
  onSelectUser: (userId: string) => void;
};

const UserLinkSection: React.FC<UserLinkSectionProps> = ({
  linkedUserId,
  linkedUserCode,
  linkedUserName,
  userOptions,
  isAdmin,
  onSelectUser,
}) => {
  const isLinked = linkedUserId != null;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderColor: isLinked ? 'success.main' : 'warning.main',
        borderWidth: 2,
        bgcolor: isLinked ? 'success.50' : 'warning.50',
      }}
    >
      <Stack spacing={2}>
        {/* ── ステータスバー ── */}
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {isLinked ? (
            <VerifiedUserRoundedIcon color="success" />
          ) : (
            <LinkOffIcon color="warning" />
          )}
          <Box flex={1}>
            <Typography
              variant="subtitle1"
              component="h3"
              sx={{ fontWeight: 600 }}
            >
              {isLinked ? '✅ 利用者マスタと紐付け済み' : '⚠️ 利用者マスタと未紐付け'}
            </Typography>
            {isLinked ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {linkedUserName}
                {linkedUserCode ? `（コード: ${linkedUserCode}）` : ''}
                {` — レコードID: ${linkedUserId}`}
              </Typography>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                利用者マスタから選択すると、氏名・IDが自動入力され、
                他の機能（モニタリング履歴等）と連携できます。
              </Typography>
            )}
          </Box>
          <Chip
            icon={isLinked ? <LinkIcon /> : <LinkOffIcon />}
            label={isLinked ? '紐付け済' : '未紐付け'}
            color={isLinked ? 'success' : 'warning'}
            size="small"
            variant={isLinked ? 'filled' : 'outlined'}
          />
        </Stack>

        {/* ── 利用者選択UI ── */}
        {isAdmin && (
          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <PersonSearchRoundedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {isLinked ? '別の利用者に変更する場合' : '利用者を選択してください'}
              </Typography>
            </Stack>
            <Autocomplete
              options={userOptions}
              getOptionLabel={(option) => option.label}
              onChange={(_event, newValue) => {
                if (newValue) {
                  onSelectUser(newValue.id);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="利用者を検索（名前またはID）"
                  size="small"
                  variant="outlined"
                  InputProps={{
                    ...params.InputProps,
                  }}
                />
              )}
              renderOption={(props, option) => {
                const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key: string };
                const alreadyLinked = option.id === String(linkedUserId);
                return (
                  <li key={key} {...rest}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{ width: '100%' }}
                    >
                      <Typography variant="body2" flex={1}>
                        {option.label}
                      </Typography>
                      {alreadyLinked && (
                        <Chip
                          label="現在の紐付け先"
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  </li>
                );
              }}
              noOptionsText="該当する利用者が見つかりません"
              clearOnEscape
              blurOnSelect
              fullWidth
              size="small"
            />
            {!isLinked && (
              <Typography
                variant="caption"
                sx={{ color: 'text.disabled', fontStyle: 'italic' }}
              >
                💡 ヒント: 紐付けなしでもフリーテキスト入力は可能ですが、
                モニタリング履歴の自動取得など一部機能が利用できません。
              </Typography>
            )}
          </Stack>
        )}

        {/* ── 非管理者向け情報 ── */}
        {!isAdmin && !isLinked && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            利用者マスタとの紐付けは管理者（サビ管）が行います。
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

export default React.memo(UserLinkSection);
