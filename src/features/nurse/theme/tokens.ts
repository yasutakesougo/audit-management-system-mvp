import { createTheme } from '@mui/material/styles';

export const nurseCssVars = `
:root {
  --bg: #FFFCF5;
  --accent: #2A9D8F;
  --danger: #EF4444;
  --warn: #F59E0B;
}
`;

export const nurseTheme = () =>
  createTheme({
    palette: {
      primary: { main: '#2A9D8F' },
      background: { default: '#FFFCF5' },
      error: { main: '#EF4444' },
      warning: { main: '#F59E0B' },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            textTransform: 'none',
          },
        },
      },
    },
  });
