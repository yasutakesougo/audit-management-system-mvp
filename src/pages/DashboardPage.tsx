  return (
    <Box
      sx={{
        height: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      data-testid="dashboard-page"
    >
      {/* 固定ヘッダー */}
      <Box
        sx={{
          flexShrink: 0,
          px: { xs: 2, sm: 3 },
          py: 1.5,
          bgcolor: 'background.default',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Box>
            <Typography variant="h4" component="h1" sx={{ mb: 0.5 }}>
              <DashboardIcon sx={{ verticalAlign: 'middle', mr: 2 }} />
              黒ノート
            </Typography>
            <Typography variant="body2" color="text.secondary">
              全利用者の活動状況と支援記録の統合的な管理・分析
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<WbSunnyIcon />}
              onClick={() => {
                setMeetingKind('morning');
                setMeetingDrawerOpen(true);
              }}
              size="small"
            >
              朝会ガイド
            </Button>
            <Button
              variant="outlined"
              startIcon={<NightsStayIcon />}
              onClick={() => {
                setMeetingKind('evening');
                setMeetingDrawerOpen(true);
              }}
              size="small"
              color="secondary"
            >
              夕会ガイド
            </Button>
            <Button
              variant="contained"
              startIcon={<AccessTimeIcon />}
              component={Link}
              to="/handoff-timeline"
              size="small"
              color="primary"
            >
              申し送りタイムライン
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* スクロール可能コンテンツ */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          px: { xs: 2, sm: 3 },
          py: 1.5,
        }}
      >
        <Container maxWidth="lg" disableGutters>
          <Stack spacing={2}>
            <DashboardSafetyHUD />

            <Paper elevation={3} sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                今日の通所 / 出勤状況
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                  <Typography variant="h4" color="primary" sx={{ fontWeight: 800 }}>
                    {attendanceSummary.facilityAttendees}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    施設通所
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                  <Typography variant="h4" color="success.main" sx={{ fontWeight: 800 }}>
                    {attendanceSummary.lateOrEarlyLeave}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    遅刻 / 早退
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                  <Typography variant="h4" color="warning.main" sx={{ fontWeight: 800 }}>
                    {attendanceSummary.absenceCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    当日欠席
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                  <Typography variant="h4" color="text.primary" sx={{ fontWeight: 800 }}>
                    {attendanceSummary.onDutyStaff}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    出勤職員
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                  <Typography variant="h4" color="secondary.main" sx={{ fontWeight: 800 }}>
                    {attendanceSummary.lateOrShiftAdjust}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    遅刻 / シフト調整
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                  <Typography variant="h4" color="info.main" sx={{ fontWeight: 800 }}>
                    {attendanceSummary.outStaff}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    外出スタッフ
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            <Paper elevation={3} sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                日次記録状況
              </Typography>
              <Grid container spacing={2}>
                {dailyStatusCards.map(({ label, completed, pending, planned }) => {
                  const total = planned;
                  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
                  return (
                    <Grid key={label} size={{ xs: 12, md: 4 }}>
                      <Paper variant="outlined" sx={{ p: 1.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                          完了 {completed} / 予定 {total}
                        </Typography>
                        <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3, mb: 0.5 }} />
                        <Typography variant="caption" color="text.secondary">
                          残り {pending} 件
                        </Typography>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </Paper>

            <Paper elevation={3} sx={{ p: 2 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
                sx={{ mb: 1 }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  今日の予定
                </Typography>
                {schedulesEnabled && (
                  <Button
                    variant="outlined"
                    startIcon={<EventAvailableRoundedIcon />}
                    component={Link}
                    to="/schedules/week"
                    size="small"
                  >
                    マスタースケジュール
                  </Button>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                レーンごとの進行状況を確認できます。
              </Typography>
              <Grid container spacing={1.5}>
                {[
                  { label: '利用者レーン', items: scheduleLanes.userLane },
                  { label: '職員レーン', items: scheduleLanes.staffLane },
                  { label: '組織レーン', items: scheduleLanes.organizationLane },
                ].map(({ label, items }) => (
                  <Grid key={label} size={{ xs: 12, md: 4 }}>
                    <Paper variant="outlined" sx={{ p: 1.5, maxHeight: '180px', overflow: 'auto' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                        {label}
                      </Typography>
                      <List dense disablePadding>
                        {items.map((item) => (
                          <ListItem key={item.id} disableGutters sx={{ py: 0.25 }}>
                            <ListItemText
                              primary={`${item.time} ${item.title}`}
                              secondary={item.location ? `場所: ${item.location}` : item.owner ? `担当: ${item.owner}` : undefined}
                              primaryTypographyProps={{ variant: 'caption', fontWeight: 600 }}
                              secondaryTypographyProps={{ variant: 'caption' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Paper>

            <Paper elevation={3} sx={{ p: 2 }} {...tid(TESTIDS['dashboard-handoff-summary'])}>
              <Stack spacing={1.5}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    申し送りタイムライン
                  </Typography>
                  {handoffCritical > 0 && (
                    <Chip
                      size="small"
                      color="error"
                      variant="filled"
                      label={`重要・未完了 ${handoffCritical}件`}
                    />
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  今日の申し送り状況を把握して、必要に応じてタイムラインページで詳細を確認してください。
                </Typography>
                {handoffTotal > 0 ? (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      color="warning"
                      variant={handoffStatus['未対応'] > 0 ? 'filled' : 'outlined'}
                      label={`未対応 ${handoffStatus['未対応']}件`}
                      {...tid(TESTIDS['dashboard-handoff-summary-alert'])}
                    />
                    <Chip
                      size="small"
                      color="info"
                      variant={handoffStatus['対応中'] > 0 ? 'filled' : 'outlined'}
                      label={`対応中 ${handoffStatus['対応中']}件`}
                      {...tid(TESTIDS['dashboard-handoff-summary-action'])}
                    />
                    <Chip
                      size="small"
                      color="success"
                      variant={handoffStatus['対応済'] > 0 ? 'filled' : 'outlined'}
                      label={`対応済 ${handoffStatus['対応済']}件`}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`合計 ${handoffTotal}件`}
                      {...tid(TESTIDS['dashboard-handoff-summary-total'])}
                    />
                  </Stack>
                ) : (
                  <Alert severity="info" sx={{ borderRadius: 2, py: 0.5 }}>
                    まだ今日の申し送りは登録されていません。
                  </Alert>
                )}
                <Button
                  variant="contained"
                  startIcon={<AccessTimeIcon />}
                  onClick={() => openTimeline('today')}
                  size="small"
                  fullWidth
                >
                  タイムラインで詳細を見る
                </Button>
              </Stack>
            </Paper>
          </Stack>

          {/* 基本統計 */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ my: 2 }}>
            <Paper sx={{ p: 1.5, textAlign: 'center', flex: 1 }}>
              <Typography variant="h4" color="primary">
                {stats.totalUsers}名
              </Typography>
              <Typography variant="caption" color="text.secondary">
                総利用者数
              </Typography>
            </Paper>

            <Paper sx={{ p: 1.5, textAlign: 'center', flex: 1 }}>
              <Typography variant="h4" color="success.main">
                {stats.recordedUsers}名
              </Typography>
              <Typography variant="caption" color="text.secondary">
                本日記録完了
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={stats.completionRate}
                  sx={{ height: 4, borderRadius: 2 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {Math.round(stats.completionRate)}%
                </Typography>
              </Box>
            </Paper>

            <Paper sx={{ p: 1.5, textAlign: 'center', flex: 1 }}>
              <Typography variant="h4" color="secondary.main">
                {intensiveSupportUsers.length}名
              </Typography>
              <Typography variant="caption" color="text.secondary">
                強度行動障害対象者
              </Typography>
            </Paper>

            <Paper sx={{ p: 1.5, textAlign: 'center', flex: 1 }}>
              <Typography variant="h4" color={stats.seizureCount > 0 ? "error.main" : "success.main"}>
                {stats.seizureCount}件
              </Typography>
              <Typography variant="caption" color="text.secondary">
                本日発作記録
              </Typography>
            </Paper>
          </Stack>

          {audience === 'admin' && (
            <>
              <Card sx={{ mb: 2 }}>
                <Tabs
                  value={tabValue}
                  onChange={handleTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  {ADMIN_TABS.map((tab) => (
                    <Tab
                      key={tab.label}
                      label={tab.label}
                      icon={tab.icon}
                      iconPosition="start"
                    />
                  ))}
                </Tabs>
              </Card>

              <TabPanel value={tabValue} index={0}>
                <Stack spacing={2}>
                  <Card>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Typography variant="h6" gutterBottom>
                        <RestaurantIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                        昼食摂取状況
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {Object.entries(stats.lunchStats).map(([amount, count]) => (
                          <Chip
                            key={amount}
                            label={`${amount}: ${count}名`}
                            size="small"
                            color={amount === '完食' ? 'success' : amount === 'なし' ? 'error' : 'default'}
                            variant={amount === '完食' ? 'filled' : 'outlined'}
                          />
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Typography variant="h6" gutterBottom>
                        <BehaviorIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                        問題行動発生状況
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip
                          label={`自傷: ${stats.problemBehaviorStats.selfHarm}件`}
                          size="small"
                          color={stats.problemBehaviorStats.selfHarm > 0 ? 'error' : 'default'}
                        />
                        <Chip
                          label={`暴力: ${stats.problemBehaviorStats.violence}件`}
                          size="small"
                          color={stats.problemBehaviorStats.violence > 0 ? 'error' : 'default'}
                        />
                        <Chip
                          label={`大声: ${stats.problemBehaviorStats.loudVoice}件`}
                          size="small"
                          color={stats.problemBehaviorStats.loudVoice > 0 ? 'warning' : 'default'}
                        />
                        <Chip
                          label={`異食: ${stats.problemBehaviorStats.pica}件`}
                          size="small"
                          color={stats.problemBehaviorStats.pica > 0 ? 'error' : 'default'}
                        />
                        <Chip
                          label={`その他: ${stats.problemBehaviorStats.other}件`}
                          size="small"
                          color={stats.problemBehaviorStats.other > 0 ? 'warning' : 'default'}
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                </Stack>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <UsageStatusDashboard
                  users={users.filter(user => user.UsageStatus === '利用中')}
                  usageMap={usageMap}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                <Stack spacing={2}>
                  {stats.problemBehaviorStats.selfHarm > 0 && (
                    <Alert severity="error" icon={<WarningIcon />}>本日、自傷行動が{stats.problemBehaviorStats.selfHarm}件発生しています。</Alert>
                  )}
                  {stats.problemBehaviorStats.violence > 0 && (
                    <Alert severity="error" icon={<WarningIcon />}>本日、暴力行動が{stats.problemBehaviorStats.violence}件発生しています。</Alert>
                  )}
                  {Object.values(stats.problemBehaviorStats).every(count => count === 0) && (
                    <Alert severity="success">本日は問題行動の記録がありません。</Alert>
                  )}

                  <Card>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Typography variant="h6" gutterBottom>問題行動対応履歴</Typography>
                      <Typography variant="body2" color="text.secondary">
                        詳細な対応記録と改善傾向の分析は個別の支援記録（ケース記録）をご確認ください。
                      </Typography>
                    </CardContent>
                  </Card>
                </Stack>
              </TabPanel>

              <TabPanel value={tabValue} index={3}>
                <Stack spacing={2}>
                  <Card>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Typography variant="h6" gutterBottom>
                        <MedicalIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                        発作記録サマリー
                      </Typography>
                      {stats.seizureCount > 0 ? (
                        <Alert severity="warning">
                          本日{stats.seizureCount}件の発作が記録されています。
                        </Alert>
                      ) : (
                        <Alert severity="success">
                          本日は発作の記録がありません。
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Typography variant="h6" gutterBottom>健康管理指標</Typography>
                      <Stack spacing={1}>
                        <Box>
                          <Typography variant="caption" gutterBottom>昼食摂取率</Typography>
                          <LinearProgress
                            variant="determinate"
                            value={((stats.lunchStats['完食'] || 0) / stats.totalUsers) * 100}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                          <Typography variant="caption">
                            {Math.round(((stats.lunchStats['完食'] || 0) / stats.totalUsers) * 100)}%
                            ({stats.lunchStats['完食'] || 0}名/{stats.totalUsers}名)
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Stack>
              </TabPanel>

              <TabPanel value={tabValue} index={4}>
                <Stack spacing={2}>
                  <Typography variant="h6" gutterBottom>
                    <PersonIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                    強度行動障害対象者 支援手順記録
                  </Typography>

                  {intensiveSupportUsers.map(user => (
                    <Card key={user.Id} sx={{ border: '2px solid', borderColor: 'warning.main' }}>
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                          <Typography variant="h6">
                            {user.FullName}
                          </Typography>
                          <Stack direction="row" spacing={1}>
                            <Chip label="強度行動障害" color="warning" size="small" />
                            <Chip label="支援手順記録対象" color="info" size="small" />
                          </Stack>
                        </Box>

                        <Divider sx={{ my: 1.5 }} />

                        <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
                          <Paper sx={{ p: 1, textAlign: 'center', flex: 1 }}>
                            <Typography variant="subtitle1" color="primary">
                              {Math.floor(Math.random() * 15) + 10}/19
                            </Typography>
                            <Typography variant="caption">支援手順実施</Typography>
                          </Paper>
                          <Paper sx={{ p: 1, textAlign: 'center', flex: 1 }}>
                            <Typography variant="subtitle1" color="success.main">
                              {Math.floor(Math.random() * 3) + 8}
                            </Typography>
                            <Typography variant="caption">効果的手順</Typography>
                          </Paper>
                          <Paper sx={{ p: 1, textAlign: 'center', flex: 1 }}>
                            <Typography variant="subtitle1" color="warning.main">
                              {Math.floor(Math.random() * 3) + 1}
                            </Typography>
                            <Typography variant="caption">要改善手順</Typography>
                          </Paper>
                        </Stack>

                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => window.open(`/daily/support?user=${user.UserID}`, '_blank')}
                        >
                          詳細記録を確認
                        </Button>
                      </CardContent>
                    </Card>
                  ))}

                  {intensiveSupportUsers.length === 0 && (
                    <Alert severity="info">
                      現在、支援手順記録の対象者はいません。
                    </Alert>
                  )}
                </Stack>
              </TabPanel>
            </>
          )}

          {audience === 'staff' && (
            <Stack spacing={2}>
              <Card
                elevation={3}
                sx={{
                  borderWidth: 2,
                  borderStyle: 'solid',
                  borderColor: isMorningTime ? 'primary.main' : 'divider',
                }}
              >
                <CardHeader
                  title="🌅 朝会情報（9:00）"
                  titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                  sx={{
                    py: 1.5,
                    bgcolor: (theme) => (isMorningTime ? alpha(theme.palette.primary.main, 0.08) : 'transparent'),
                  }}
                />
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Stack spacing={2}>
                    <HandoffSummaryForMeeting
                      dayScope="yesterday"
                      title="前日からの申し送り引き継ぎ"
                      description="朝会では前日までの申し送りを確認します。"
                      actionLabel="タイムラインを開く"
                      onOpenTimeline={() => openTimeline('yesterday')}
                    />

                    <Card>
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="subtitle2" gutterBottom>
                          重点フォロー利用者
                        </Typography>
                        {prioritizedUsers.length > 0 ? (
                          <List dense disablePadding>
                            {prioritizedUsers.map((user) => (
                              <ListItem key={user.Id} disableGutters>
                                <ListItemAvatar>
                                  <Avatar sx={{ width: 32, height: 32 }}>{user.FullName?.charAt(0) ?? '利'}</Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                  primary={user.FullName ?? '利用者'}
                                  secondary="支援手順記録の確認をお願いします"
                                  primaryTypographyProps={{ variant: 'body2' }}
                                  secondaryTypographyProps={{ variant: 'caption' }}
                                />
                              </ListItem>
                            ))}
                          </List>
                        ) : (
                          <Alert severity="success">現在フォロー対象の利用者はありません。</Alert>
                        )}
                      </CardContent>
                    </Card>

                    {renderScheduleLanes('今日の予定', scheduleLanes)}
                  </Stack>
                </CardContent>
              </Card>

              <Card
                elevation={3}
                sx={{
                  borderWidth: 2,
                  borderStyle: 'solid',
                  borderColor: isEveningTime ? 'secondary.main' : 'divider',
                }}
              >
                <CardHeader
                  title="🌆 夕会情報（17:15）"
                  titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                  sx={{
                    py: 1.5,
                    bgcolor: (theme) => (isEveningTime ? alpha(theme.palette.secondary.main, 0.08) : 'transparent'),
                  }}
                />
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Stack spacing={2}>
                    <Card>
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="subtitle2" gutterBottom>
                          本日の振り返り
                        </Typography>
                        <Stack spacing={1}>
                          {dailyStatusCards.map(({ label, completed, pending, planned }) => {
                            const total = planned;
                            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
                            return (
                              <Paper key={label} variant="outlined" sx={{ p: 1.5 }}>
                                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                  {label}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  完了 {completed} / 予定 {total} （残り {pending} 件）
                                </Typography>
                                <LinearProgress value={progress} variant="determinate" sx={{ mt: 0.5, height: 4, borderRadius: 2 }} />
                              </Paper>
                            );
                          })}
                        </Stack>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="subtitle2" gutterBottom>
                          健康・行動トピック
                        </Typography>
                        <Stack spacing={1}>
                          {stats.seizureCount > 0 ? (
                            <Alert severity="warning" sx={{ py: 0.5 }}>本日 {stats.seizureCount} 件の発作対応がありました。</Alert>
                          ) : (
                            <Alert severity="success" sx={{ py: 0.5 }}>発作対応はありませんでした。</Alert>
                          )}
                          {Object.values(stats.problemBehaviorStats).some((count) => count > 0) ? (
                            <Alert severity="error" sx={{ py: 0.5 }}>
                              問題行動が記録されています。
                            </Alert>
                          ) : (
                            <Alert severity="info" sx={{ py: 0.5 }}>問題行動の記録はありません。</Alert>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>

                    <HandoffSummaryForMeeting
                      dayScope="today"
                      title="明日への申し送り候補"
                      description="夕会では今日の申し送りを最終確認します。"
                      actionLabel="タイムラインで確認"
                      onOpenTimeline={() => openTimeline('today')}
                    />

                    {renderScheduleLanes('明日の予定', scheduleLanes)}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          )}
        </Container>
      </Box>

      <MeetingGuideDrawer
        open={meetingDrawerOpen}
        kind={meetingKind}
        onClose={() => setMeetingDrawerOpen(false)}
      />
    </Box>
  );