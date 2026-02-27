import { TESTIDS, tidWithSuffix } from '@/testids';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import type { IUserMaster } from '../types';
import { USAGE_STATUS_VALUES } from '../typesExtended';
import { formatDateLabel, renderHighlights, resolveUserIdentifier } from './helpers';
import {
    DEFAULT_TAB_KEY,
    menuSections,
    NON_TABBED_SECTIONS,
    QUICK_ACCESS_KEYS,
    TAB_SECTION_KEYS,
    TAB_SECTIONS,
} from './menuSections';
import type { MenuSection } from './types';

type BackLinkProps =
  | { label?: string; to: string }
  | { label?: string; onClick: () => void }
  | undefined;

type UserDetailSectionsProps = {
  user: IUserMaster;
  backLink?: BackLinkProps;
  variant?: 'page' | 'embedded';
  onEdit?: (user: IUserMaster) => void;
};

const renderSectionDetails = (section: MenuSection, user: IUserMaster, attendanceLabel: string) => {
  if (section.key === 'basic') {
    const detailRows = [
      { label: '氏名', value: user.FullName || '未設定' },
      { label: 'ふりがな', value: user.Furigana || user.FullNameKana || '未登録' },
      { label: '利用者コード', value: resolveUserIdentifier(user) },
      { label: '契約日', value: formatDateLabel(user.ContractDate) },
      { label: '利用開始日', value: formatDateLabel(user.ServiceStartDate) },
      { label: '利用終了日', value: user.ServiceEndDate ? formatDateLabel(user.ServiceEndDate) : '継続利用中' },
      { label: '在籍状況', value: user.IsActive === false ? '退所' : '在籍' },
      { label: '支援区分', value: user.IsHighIntensitySupportTarget ? '強度行動障害支援対象者' : '通常支援' },
      { label: '支援手順記録', value: user.IsSupportProcedureTarget ? '対象' : '対象外' },
      { label: '通所予定日', value: attendanceLabel },
      { label: '受給者証番号', value: user.RecipientCertNumber || '未登録' },
      { label: '受給者証期限', value: formatDateLabel(user.RecipientCertExpiry) },
    ];

    return (
      <Stack spacing={2}>
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' },
            columnGap: 3,
            rowGap: 1.5,
          }}
        >
          {detailRows.map(({ label, value }) => (
            <React.Fragment key={label}>
              <Typography component="dt" variant="subtitle2" color="text.secondary">
                {label}
              </Typography>
              <Typography component="dd" variant="body1" sx={{ m: 0 }}>
                {value}
              </Typography>
            </React.Fragment>
          ))}
        </Box>
        <Divider />
        <Typography variant="subtitle2" color="text.secondary">
          このセクションでできること
        </Typography>
        {renderHighlights(section.highlights)}
      </Stack>
    );
  }

  const supportProcedureWarning = section.key === 'support-procedure' && !user.IsSupportProcedureTarget;

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" color="text.secondary">
        想定されるコンテンツ
      </Typography>
      {renderHighlights(section.highlights)}
      {supportProcedureWarning && (
        <Alert severity="warning">
          この利用者は支援手順記録の対象に設定されていません。
        </Alert>
      )}
      {section.status === 'coming-soon' && (
        <Alert severity="info">
          このセクションの詳細画面は今後の開発で提供予定です。
        </Alert>
      )}
    </Stack>
  );
};

const UserDetailSections: React.FC<UserDetailSectionsProps> = ({ user, backLink, variant = 'page', onEdit }) => {
  const [activeTab, setActiveTab] = useState<MenuSection['key']>(DEFAULT_TAB_KEY);
  const tabPanelRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const quickAccessSections = useMemo(
    () => menuSections.filter((section) => QUICK_ACCESS_KEYS.includes(section.key)),
    []
  );

  const attendanceLabel = user.AttendanceDays?.length ? user.AttendanceDays.join('・') : '—';
  const supportLabel = user.IsHighIntensitySupportTarget ? '強度行動障害支援対象者' : '通常支援';
  const isActive = user.IsActive !== false;

  const handleCardNavigate = useCallback(
    (section: MenuSection) => {
      if (section.key === 'create-user') {
        navigate('/users', { state: { tab: 'create' } });
        return;
      }

      if (TAB_SECTION_KEYS.includes(section.key)) {
        setActiveTab(section.key);
        if (typeof window !== 'undefined') {
          window.requestAnimationFrame(() => {
            if (tabPanelRef.current) {
              tabPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        }
        return;
      }

      if (typeof document !== 'undefined') {
        const target = document.getElementById(section.anchor);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    },
    [navigate]
  );

  const backControl = useMemo(() => {
    if (!backLink) return null;
    if ('to' in backLink) {
      return (
        <Button
          component={RouterLink as unknown as React.ElementType}
          to={backLink.to}
          startIcon={<ArrowBackRoundedIcon />}
          variant="text"
          sx={{ alignSelf: 'flex-start' }}
        >
          {backLink.label ?? '一覧に戻る'}
        </Button>
      );
    }

    if ('onClick' in backLink) {
      return (
        <Button
          onClick={backLink.onClick}
          startIcon={<ArrowBackRoundedIcon />}
          variant="text"
          sx={{ alignSelf: 'flex-start' }}
        >
          {backLink.label ?? '一覧に戻る'}
        </Button>
      );
    }

    return null;
  }, [backLink]);

  const instructionText =
    variant === 'embedded'
      ? '利用者一覧を確認するか、新規利用者登録・基本情報・個別支援計画書・支援手順兼記録・モニタリングシートを選択してください。'
      : '利用者一覧を確認するか、新規利用者登録・基本情報・個別支援計画書・支援手順兼記録・モニタリングシートを選択してください。';

  const isEmbedded = variant === 'embedded';

  return (
  <Stack spacing={isEmbedded ? 1.5 : 3} data-testid={TESTIDS['user-detail-sections']}>
      {backControl}

      <Paper variant="outlined" sx={{ p: isEmbedded ? 2 : { xs: 2.5, md: 3 }, borderRadius: isEmbedded ? 2 : 3 }}>
        <Stack spacing={isEmbedded ? 1 : 2}>
          <Stack
            direction="row"
            spacing={isEmbedded ? 1.5 : 2}
            alignItems="center"
          >
            <Avatar sx={{ bgcolor: 'primary.main', color: '#fff', width: isEmbedded ? 40 : 56, height: isEmbedded ? 40 : 56 }}>
              <PeopleAltRoundedIcon fontSize={isEmbedded ? 'small' : 'medium'} />
            </Avatar>
            <Box>
              {!isEmbedded && (
                <Typography variant="overline" color="text.secondary">
                  利用者プロフィール
                </Typography>
              )}
              <Typography variant={isEmbedded ? 'h6' : 'h4'} component="h1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {user.FullName || '氏名未登録'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {resolveUserIdentifier(user)}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={0.5} flexWrap="wrap" alignItems="center" sx={{ rowGap: 0.5 }}>
            {isEmbedded && (
              <Chip
                label={
                  user.UsageStatus === USAGE_STATUS_VALUES.TERMINATED ? '終了'
                  : user.UsageStatus === USAGE_STATUS_VALUES.SUSPENDED || user.IsActive === false ? '休止'
                  : '利用中'
                }
                color={
                  user.UsageStatus === USAGE_STATUS_VALUES.TERMINATED || user.UsageStatus === USAGE_STATUS_VALUES.SUSPENDED || user.IsActive === false
                    ? 'default' : 'success'
                }
                size="small"
              />
            )}
            {!isEmbedded && (
              <Chip label={`利用者コード: ${resolveUserIdentifier(user)}`} size="small" />
            )}
            <Chip label={supportLabel} color={user.IsHighIntensitySupportTarget ? 'warning' : 'default'} size="small" />
            {user.IsSupportProcedureTarget && (
              <Chip label="支援手順対象" color="secondary" size="small" />
            )}
            {!isEmbedded && (
              <Chip label={isActive ? '在籍' : '退所'} color={isActive ? 'success' : 'default'} size="small" />
            )}
            {!isEmbedded && (
              <>
                <Chip label={`契約日: ${formatDateLabel(user.ContractDate)}`} size="small" variant="outlined" />
                <Chip label={`利用開始日: ${formatDateLabel(user.ServiceStartDate)}`} size="small" variant="outlined" />
                {user.ServiceEndDate && (
                  <Chip label={`利用終了日: ${formatDateLabel(user.ServiceEndDate)}`} size="small" variant="outlined" />
                )}
              </>
            )}
          </Stack>

          {!isEmbedded && (
            <>
              <Divider />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Box flex={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    通所予定日
                  </Typography>
                  <Typography variant="body1">{attendanceLabel}</Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    メモ
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    利用者関連の主要帳票へアクセスするためのメニューです。表示されている「利用者コード」はシステム用で、職員が覚える必要はありません。
                  </Typography>
                </Box>
              </Stack>
            </>
          )}

          {isEmbedded && (
            <>
              <Divider />
              <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: '100px 1fr', columnGap: 1.5, rowGap: 0.75, fontSize: '0.85rem' }}>
                <Typography component="dt" variant="caption" color="text.secondary">契約日</Typography>
                <Typography component="dd" variant="body2" sx={{ m: 0 }}>{formatDateLabel(user.ContractDate)}</Typography>
                <Typography component="dt" variant="caption" color="text.secondary">利用開始日</Typography>
                <Typography component="dd" variant="body2" sx={{ m: 0 }}>{formatDateLabel(user.ServiceStartDate)}</Typography>
                {user.ServiceEndDate && (
                  <>
                    <Typography component="dt" variant="caption" color="text.secondary">利用終了日</Typography>
                    <Typography component="dd" variant="body2" sx={{ m: 0 }}>{formatDateLabel(user.ServiceEndDate)}</Typography>
                  </>
                )}
                <Typography component="dt" variant="caption" color="text.secondary">通所予定日</Typography>
                <Typography component="dd" variant="body2" sx={{ m: 0 }}>{attendanceLabel}</Typography>
                {user.RecipientCertNumber && (
                  <>
                    <Typography component="dt" variant="caption" color="text.secondary">受給者証</Typography>
                    <Typography component="dd" variant="body2" sx={{ m: 0 }}>****{user.RecipientCertNumber.slice(-4)}</Typography>
                  </>
                )}
              </Box>
            </>
          )}

          {isEmbedded && (
            <>
              <Divider />
              <Stack direction="row" spacing={1}>
                {onEdit && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<EditRoundedIcon />}
                    onClick={() => onEdit(user)}
                    sx={{ textTransform: 'none', flex: 1 }}
                  >
                    編集
                  </Button>
                )}
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<OpenInNewRoundedIcon />}
                  component={RouterLink as unknown as React.ElementType}
                  to={`/users/${encodeURIComponent(user.UserID || String(user.Id))}`}
                  sx={{ textTransform: 'none', flex: 1 }}
                >
                  詳細を開く
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </Paper>

      {!isEmbedded && (
      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              利用者メニュー
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {instructionText}
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
            {quickAccessSections.map((section) => (
              <Button
                key={`quick-${section.key}`}
                {...tidWithSuffix(TESTIDS['users-quick-prefix'], section.key)}
                variant={section.key === 'create-user' ? 'contained' : 'outlined'}
                color={section.key === 'create-user' ? 'primary' : 'inherit'}
                size="small"
                onClick={() => handleCardNavigate(section)}
              >
                {section.title}
              </Button>
            ))}
          </Stack>
          <Grid container spacing={2.5}>
            {menuSections.map((section) => {
              const IconComponent = section.icon;
              const cardIsTab = TAB_SECTION_KEYS.includes(section.key);
              const cardActionLabel = section.actionLabel ?? (cardIsTab ? 'タブを開く' : '詳細へ');
              const chipProps = (() => {
                if (section.key === 'support-procedure') {
                  return {
                    label: user.IsSupportProcedureTarget ? '対象' : '対象外',
                    color: user.IsSupportProcedureTarget ? 'secondary' : 'default',
                    variant: user.IsSupportProcedureTarget ? 'filled' : 'outlined',
                  } as const;
                }
                if (section.status === 'coming-soon') {
                  return {
                    label: '準備中',
                    color: 'default',
                    variant: 'outlined',
                  } as const;
                }
                return {
                  label: '利用可',
                  color: 'success',
                  variant: 'outlined',
                } as const;
              })();

              return (
                <Grid key={section.key} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Paper
                    {...tidWithSuffix(TESTIDS['user-menu-card-prefix'], section.key)}
                    variant="outlined"
                    sx={{
                      p: 2.5,
                      height: '100%',
                      borderRadius: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar sx={{ bgcolor: section.avatarColor, color: '#fff', width: 44, height: 44 }}>
                        <IconComponent fontSize="small" />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {section.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {section.description}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" mt="auto">
                      <Chip size="small" {...chipProps} />
                      <Button variant="contained" color="primary" size="small" onClick={() => handleCardNavigate(section)}>
                        {cardActionLabel}
                      </Button>
                    </Stack>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
          <Tabs
            value={activeTab}
            onChange={(_, value) => setActiveTab(value as MenuSection['key'])}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="利用者メニュータブ"
          >
            {TAB_SECTIONS.map((section) => {
              const IconComponent = section.icon;
              return (
                <Tab
                  key={section.key}
                  value={section.key}
                  label={section.title}
                  icon={<IconComponent fontSize="small" />}
                  iconPosition="start"
                  id={`user-menu-tab-${section.key}`}
                  aria-controls={`user-menu-tabpanel-${section.key}`}
                />
              );
            })}
          </Tabs>

          {TAB_SECTIONS.map((section) => {
            const IconComponent = section.icon;
            const chipProps = (() => {
              if (section.key === 'support-procedure') {
                return {
                  label: user.IsSupportProcedureTarget ? '対象' : '対象外',
                  color: user.IsSupportProcedureTarget ? 'secondary' : 'default',
                  variant: user.IsSupportProcedureTarget ? 'filled' : 'outlined',
                } as const;
              }
              if (section.status === 'coming-soon') {
                return {
                  label: '準備中',
                  color: 'default',
                  variant: 'outlined',
                } as const;
              }
              return {
                label: '利用可',
                color: 'success',
                variant: 'outlined',
              } as const;
            })();

            const isTabActive = activeTab === section.key;

            return (
              <Box
                key={section.key}
                ref={isTabActive ? tabPanelRef : undefined}
                role="tabpanel"
                hidden={!isTabActive}
                id={`user-menu-tabpanel-${section.key}`}
                {...tidWithSuffix(TESTIDS['user-menu-tabpanel-prefix'], section.key)}
                aria-labelledby={`user-menu-tab-${section.key}`}
                sx={{ mt: 2 }}
              >
                {isTabActive && (
                  <Stack spacing={2.5}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={2}
                      alignItems={{ xs: 'flex-start', md: 'center' }}
                    >
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ flexGrow: 1 }}>
                        <Avatar sx={{ bgcolor: section.avatarColor, color: '#fff', width: 48, height: 48 }}>
                          <IconComponent fontSize="medium" />
                        </Avatar>
                        <Box>
                          <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                            {section.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {section.description}
                          </Typography>
                        </Box>
                      </Stack>
                      <Chip size="small" {...chipProps} />
                    </Stack>
                    <Divider />
                    {renderSectionDetails(section, user, attendanceLabel)}
                  </Stack>
                )}
              </Box>
            );
          })}
        </Stack>
      </Paper>
      )}

      {NON_TABBED_SECTIONS.map((section) => {
        const IconComponent = section.icon;
        return (
          <Paper
            key={section.key}
            id={section.anchor}
            {...tidWithSuffix(TESTIDS['user-menu-section-prefix'], section.key)}
            variant="outlined"
            sx={{
              p: { xs: 2.5, md: 3 },
              borderRadius: 3,
              scrollMarginTop: 120,
            }}
          >
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: section.avatarColor, color: '#fff', width: 48, height: 48 }}>
                  <IconComponent fontSize="medium" />
                </Avatar>
                <Box flex={1}>
                  <Typography variant="h5" component="h3" sx={{ fontWeight: 600 }}>
                    {section.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {section.description}
                  </Typography>
                </Box>
                {section.status === 'coming-soon' && <Chip label="準備中" size="small" variant="outlined" />}
              </Stack>
              <Divider />
              {renderSectionDetails(section, user, attendanceLabel)}
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
};

export {
    DEFAULT_TAB_KEY,
    menuSections,
    NON_TABBED_SECTIONS,
    QUICK_ACCESS_KEYS,
    TAB_SECTION_KEYS,
    TAB_SECTIONS
};
export type { MenuSection };
export default UserDetailSections;
