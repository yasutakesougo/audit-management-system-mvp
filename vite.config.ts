import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- import.meta is supported in the Vite Node runtime
const srcDir = fileURLToPath(new URL('./src', import.meta.url))
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- import.meta is supported in the Vite Node runtime
const fluentStub = fileURLToPath(new URL('./src/stubs/fluentui-react.tsx', import.meta.url))
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- import.meta is supported in the Vite Node runtime
const emptyShim = fileURLToPath(new URL('./src/shims/empty.ts', import.meta.url))

const MUI_SHELL_COMPONENTS = new Set([
  'AppBar',
  'Toolbar',
  'Typography',
  'Container',
  'Box',
  'Stack',
  'Tooltip',
  'IconButton',
  'Button',
  'ButtonBase',
  'CssBaseline',
  'Paper',
  'Popover',
  'Menu',
  'MenuItem',
  'MenuList',
  'List',
  'ListItem',
  'ListItemIcon',
  'ListItemText',
  'ClickAwayListener',
  'Grow',
  'Fade',
  'Popper',
  'Portal',
])

const MUI_CORE_SEGMENTS = new Set([
  'styles',
  'colors',
  'utils',
  'theme',
  'useScrollTrigger',
  'index',
])

const MUI_COMPONENT_TO_CHUNK = new Map<string, string>([
  ['Accordion', 'mui-surfaces'],
  ['AccordionDetails', 'mui-surfaces'],
  ['AccordionSummary', 'mui-surfaces'],
  ['Alert', 'mui-feedback'],
  ['Autocomplete', 'mui-forms'],
  ['Avatar', 'mui-display'],
  ['Badge', 'mui-feedback'],
  ['BottomNavigation', 'mui-navigation'],
  ['BottomNavigationAction', 'mui-navigation'],
  ['Breadcrumbs', 'mui-navigation'],
  ['Card', 'mui-surfaces'],
  ['CardActionArea', 'mui-surfaces'],
  ['CardActions', 'mui-surfaces'],
  ['CardContent', 'mui-surfaces'],
  ['CardHeader', 'mui-surfaces'],
  ['Checkbox', 'mui-forms'],
  ['Chip', 'mui-display'],
  ['CircularProgress', 'mui-feedback'],
  ['Collapse', 'mui-surfaces'],
  ['Dialog', 'mui-overlay'],
  ['DialogActions', 'mui-overlay'],
  ['DialogContent', 'mui-overlay'],
  ['DialogTitle', 'mui-overlay'],
  ['Divider', 'mui-display'],
  ['Fab', 'mui-navigation'],
  ['FormControl', 'mui-forms'],
  ['FormControlLabel', 'mui-forms'],
  ['FormLabel', 'mui-forms'],
  ['InputAdornment', 'mui-forms'],
  ['InputLabel', 'mui-forms'],
  ['LinearProgress', 'mui-feedback'],
  ['Link', 'mui-navigation'],
  ['List', 'mui-display'],
  ['ListItem', 'mui-display'],
  ['ListItemIcon', 'mui-display'],
  ['ListItemText', 'mui-display'],
  ['Menu', 'mui-overlay'],
  ['MenuItem', 'mui-overlay'],
  ['Paper', 'mui-surfaces'],
  ['Popover', 'mui-overlay'],
  ['Radio', 'mui-forms'],
  ['RadioGroup', 'mui-forms'],
  ['Select', 'mui-forms'],
  ['Skeleton', 'mui-feedback'],
  ['Slider', 'mui-forms'],
  ['Snackbar', 'mui-feedback'],
  ['SpeedDial', 'mui-navigation'],
  ['SpeedDialAction', 'mui-navigation'],
  ['SpeedDialIcon', 'mui-navigation'],
  ['Switch', 'mui-forms'],
  ['Tab', 'mui-navigation'],
  ['Tabs', 'mui-navigation'],
  ['Table', 'mui-data'],
  ['TableBody', 'mui-data'],
  ['TableCell', 'mui-data'],
  ['TableContainer', 'mui-data'],
  ['TableHead', 'mui-data'],
  ['TableRow', 'mui-data'],
  ['TextField', 'mui-forms'],
  ['ToggleButton', 'mui-navigation'],
  ['ToggleButtonGroup', 'mui-navigation'],
])

const LOGGED_MUI_SEGMENTS = new Set<string>()

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': srcDir,
      '@/adapters': resolve(srcDir, 'adapters'),
      '@fluentui/react': fluentStub,
      'node:fs': emptyShim,
      crypto: emptyShim,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }
          const normalized = id.replace(/\\/g, '/');
          if (
            normalized.includes('/node_modules/react/') ||
            normalized.includes('/node_modules/react-dom/') ||
            normalized.includes('/node_modules/scheduler/')
          ) {
            return 'react';
          }
          if (normalized.includes('/@mui/icons-material/')) {
            return 'mui-icons';
          }
          if (normalized.includes('/@mui/material/')) {
            const [, muiPath = ''] = normalized.split('/@mui/material/');
            const [first, second] = muiPath.split('/');
            const rawSegment = first === 'esm' ? second ?? '' : first ?? '';
            const segment = rawSegment.split('.')[0];
            if (process.env.DEBUG_MUI_CHUNKS === 'true' && !LOGGED_MUI_SEGMENTS.has(segment)) {
              console.log(`[manualChunks] mapping ${segment || 'unknown'} from ${normalized}`)
              LOGGED_MUI_SEGMENTS.add(segment)
            }
            if (MUI_SHELL_COMPONENTS.has(segment)) {
              return 'mui-shell';
            }
            if (MUI_CORE_SEGMENTS.has(segment)) {
              return 'mui-core';
            }
            const mappedChunk = MUI_COMPONENT_TO_CHUNK.get(segment);
            if (mappedChunk) {
              return mappedChunk;
            }
            const initial = segment.charAt(0).toLowerCase();
            if ('abcde'.includes(initial)) {
              return 'mui-components-a-e';
            }
            if ('fghij'.includes(initial)) {
              return 'mui-components-f-j';
            }
            if ('klmno'.includes(initial)) {
              return 'mui-components-k-o';
            }
            if ('pqrst'.includes(initial)) {
              return 'mui-components-p-t';
            }
            if ('uvwxyz'.includes(initial)) {
              return 'mui-components-u-z';
            }
            return 'mui-components-misc';
          }
          if (
            normalized.includes('/@mui/system/') ||
            normalized.includes('/@mui/base/') ||
            normalized.includes('/@mui/styled-engine/') ||
            normalized.includes('/@mui/utils/') ||
            normalized.includes('/@mui/private-')
          ) {
            return 'mui-foundation';
          }
          if (normalized.includes('/@mui/x-data-grid')) {
            return 'datagrid';
          }
          if (normalized.includes('/@emotion/')) {
            return 'emotion';
          }
          if (
            normalized.includes('/react-markdown/') ||
            normalized.includes('/remark-') ||
            normalized.includes('/rehype-') ||
            normalized.includes('/micromark/')
          ) {
            return 'markdown';
          }
          if (normalized.includes('recharts')) {
            return 'charting';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    host: 'localhost',
    port: 3000,
    strictPort: true,
    https: false,
    proxy: {
      '/sharepoint-api': {
        target: 'https://isogokatudouhome.sharepoint.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sharepoint-api/, ''),
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  },
})
