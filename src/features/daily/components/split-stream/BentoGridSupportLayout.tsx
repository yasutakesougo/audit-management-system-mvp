// ---------------------------------------------------------------------------
// BentoGridSupportLayout — CSS Grid ベースの Bento Grid レイアウト
// /daily/support ページ専用。タブレット向け2カラム非対称グリッド。
// ---------------------------------------------------------------------------
import Box from '@mui/material/Box';
import type { ReactNode, Ref } from 'react';

export type BentoGridSupportLayoutProps = {
  /** Full-width header slot (user selector, date, actions) */
  header: ReactNode;
  /** Left sidebar: ProcedurePanel (Plan) — ~30% width */
  plan: ReactNode;
  /** Main area: RecordPanel (Do) — ~70% width */
  record: ReactNode;
  /** Horizontal bento strip at bottom of record area (progress, ABC, SPS) */
  summary?: ReactNode;
  /** Ref forwarded to the plan area (for scroll management) */
  planRef?: Ref<HTMLDivElement>;
  /** Ref forwarded to the record area (for scroll management) */
  recordRef?: Ref<HTMLDivElement>;
};

/**
 * Bento Grid layout for the Daily Support page.
 *
 * **Tablet+ (≥md):**
 * ```
 * ┌──────────────────────────────────────────┐
 * │              header (full width)          │
 * ├──────────────┬───────────────────────────┤
 * │  plan (30%)  │   record (70%)            │
 * │  scrollable  │   scrollable              │
 * │              ├───────────────────────────┤
 * │              │   summary (bento strip)   │
 * └──────────────┴───────────────────────────┘
 * ```
 *
 * **Mobile (<md):** Single-column stack: header → plan → record → summary
 */
export function BentoGridSupportLayout({
  header,
  plan,
  record,
  summary,
  planRef,
  recordRef,
}: BentoGridSupportLayoutProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        height: '100%',
        overflow: 'hidden',
        gap: { xs: 1, md: 1.5 },
        // Mobile: single column
        gridTemplateColumns: { xs: '1fr', md: '3fr 7fr' },
        gridTemplateRows: {
          xs: 'auto auto 1fr auto',
          md: 'auto minmax(0, 1fr) auto',
        },
        gridTemplateAreas: {
          xs: `"header" "plan" "record" "summary"`,
          md: `"header header" "plan record" "summary summary"`,
        },
      }}
      data-testid="bento-grid-support-layout"
    >
      {/* Header — full width */}
      <Box sx={{ gridArea: 'header' }}>
        {header}
      </Box>

      {/* Plan — left sidebar, independently scrollable */}
      <Box
        ref={planRef}
        sx={{
          gridArea: 'plan',
          minHeight: 0,
          overflowY: 'auto',
          // On mobile, limit plan height so it doesn't push Record off-screen
          maxHeight: { xs: 300, md: 'none' },
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'divider',
            borderRadius: 3,
          },
        }}
      >
        {plan}
      </Box>

      {/* Record — main workspace, independently scrollable */}
      <Box
        ref={recordRef}
        sx={{
          gridArea: 'record',
          minHeight: 0,
          overflowY: 'auto',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'divider',
            borderRadius: 3,
          },
        }}
      >
        {record}
      </Box>

      {/* Summary — bento strip at bottom of record area */}
      {summary && (
        <Box sx={{ gridArea: 'summary' }}>
          {summary}
        </Box>
      )}
    </Box>
  );
}

export default BentoGridSupportLayout;
