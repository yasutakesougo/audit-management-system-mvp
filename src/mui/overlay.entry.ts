export async function warm(): Promise<void> {
  await Promise.all([
    import('@mui/material/Dialog'),
    import('@mui/material/Popover'),
    import('@mui/material/Portal'),
  ]);
}
