export async function warm(): Promise<void> {
  await Promise.all([
    import('@mui/material/TextField'),
    import('@mui/material/Select'),
    import('@mui/material/FormControl'),
  ]);
}
