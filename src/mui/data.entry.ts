export async function warm(): Promise<void> {
  await Promise.all([
    import('@mui/material/Table'),
    import('@mui/material/TableBody'),
    import('@mui/material/TableCell'),
    import('@mui/material/TableContainer'),
    import('@mui/material/TableHead'),
    import('@mui/material/TableRow'),
    import('@mui/material/Paper'),
  ]);
}
