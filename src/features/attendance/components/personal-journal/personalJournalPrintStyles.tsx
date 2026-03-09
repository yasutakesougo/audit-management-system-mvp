import GlobalStyles from '@mui/material/GlobalStyles';

// ── Print Styles ────────────────────────────────────────────────────────────

export const personalJournalPrintStyles = (
  <GlobalStyles
    styles={{
      '[data-print="only"]': { display: 'none' },
      '@page': {
        size: 'A4 landscape',
        margin: '4mm 4mm 14mm 4mm',
      },
      '@media print': {
        // Hide screen-only UI
        '[data-print="hide"]': { display: 'none !important' },
        '[data-print="only"]': { display: 'block !important' },

        body: {
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
          background: '#fff',
          overflow: 'visible !important',
        },

        'html, body': {
          height: 'auto !important',
          overflow: 'visible !important',
        },

        // ── AppShell Reset ──────────────────────────────────────────
        // Hide AppBar (header), sidebar (navigation), footer, mobile drawer, FABs
        '.MuiAppBar-root': { display: 'none !important' },
        '.MuiDrawer-root': { display: 'none !important' },
        '.MuiFab-root': { display: 'none !important' },
        '[data-testid="app-shell"]': {
          display: 'block !important',
          height: 'auto !important',
          overflow: 'visible !important',
        },

        // Reset AppShellV2 grid → single area, no header/sidebar/footer
        '[data-testid="app-shell"] > div': {
          display: 'block !important',
          height: 'auto !important',
          overflow: 'visible !important',
          gridTemplateAreas: 'none !important' as string,
          gridTemplateRows: 'auto !important',
          gridTemplateColumns: '1fr !important',
        },

        // Hide grid areas except main
        '[data-testid="app-shell"] > div > div:not(main)': {
          display: 'none !important',
        },

        // Main content area: remove scroll constraints
        main: {
          overflow: 'visible !important',
          maxWidth: 'none !important',
          height: 'auto !important',
        },

        'main > div': {
          maxWidth: 'none !important',
          padding: '0 !important',
        },

        // ── Content Layer ───────────────────────────────────────────
        '.MuiContainer-root': {
          maxWidth: 'none !important',
          paddingLeft: '0 !important',
          paddingRight: '0 !important',
        },

        '.MuiPaper-root': {
          boxShadow: 'none !important',
        },

        // Compact table cells for print — fit on single A4 landscape page
        '.MuiTableCell-root': {
          paddingTop: '1px !important',
          paddingBottom: '1px !important',
          paddingLeft: '3px !important',
          paddingRight: '3px !important',
          fontSize: '7pt !important',
          lineHeight: '1.15 !important',
        },

        // Stretch table to fill full page height
        '.MuiTableContainer-root': {
          border: 'none !important',
          overflow: 'visible !important',
        },

        '.MuiTable-root': {
          width: '100% !important',
        },

        // Repeat table header on every printed page
        thead: {
          display: 'table-header-group',
        },

        // Stretch data rows to fill 2 pages
        // 22 weekday rows × 15mm ≈ 330mm → fills 2 A4 landscape pages
        '.MuiTableRow-root': {
          breakInside: 'avoid',
          pageBreakInside: 'avoid',
        },
        'tbody .MuiTableRow-root': {
          height: '14mm !important',
        },

        // Remove padding from page container
        '[data-testid="personal-journal-page"] > div': {
          padding: '0 !important',
        },
      },
    }}
  />
);
