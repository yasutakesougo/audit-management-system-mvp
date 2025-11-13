import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import type { FC, ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

export type UsersBreadcrumbSection =
  | 'overview'
  | 'support-procedure';

type UsersBreadcrumbsProps = {
  section?: UsersBreadcrumbSection | string;
};

type Crumb = {
  label: string;
  to?: string;
  icon?: ReactNode;
};

const SECTION_LABELS: Record<string, string> = {
  overview: '利用者ハブ',
  'support-procedure': '支援手順兼記録レポート',
};

const buildCrumbs = (section?: UsersBreadcrumbsProps['section']): Crumb[] => {
  const crumbs: Crumb[] = [
    {
      label: 'ホーム',
      to: '/',
      icon: <HomeRoundedIcon fontSize="inherit" />,
    },
    {
      label: '利用者',
      to: '/users',
      icon: <PeopleAltRoundedIcon fontSize="inherit" />,
    },
  ];

  if (section) {
    crumbs.push({
      label: SECTION_LABELS[section] ?? section,
      icon: <RouteRoundedIcon fontSize="inherit" />,
    });
  }

  return crumbs;
};

const UsersBreadcrumbs: FC<UsersBreadcrumbsProps> = ({ section }) => {
  const crumbs = buildCrumbs(section);

  return (
    <Breadcrumbs aria-label="ユーザーページのパンくず" sx={{ fontSize: 14 }}>
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        const content = (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            {crumb.icon}
            <span>{crumb.label}</span>
          </Box>
        );

        if (isLast || !crumb.to) {
          return (
            <Typography key={crumb.label} color="text.primary" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              {content}
            </Typography>
          );
        }

        return (
          <Link
            key={crumb.to}
            component={RouterLink}
            to={crumb.to}
            color="inherit"
            underline="hover"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
          >
            {content}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
};

export default UsersBreadcrumbs;
