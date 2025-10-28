export async function warm(): Promise<void> {
  await Promise.all([
    import('@mui/material/Snackbar'),
    import('@mui/material/Alert'),
    import('@mui/material/CircularProgress'),
  ]);
}
