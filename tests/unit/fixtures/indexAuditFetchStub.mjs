// External HTTP boundary only. Never contact a real SharePoint tenant.
globalThis.fetch = async (url, init) => {
  if (!String(url).startsWith('https://audit-fixture.sharepoint.com/sites/Test/_api/web/lists/')) {
    throw new Error('Unexpected audit connection target');
  }
  if (init?.headers?.Authorization !== 'Bearer synthetic-audit-token') {
    throw new Error('Unexpected audit token');
  }
  const scenario = process.env.INDEX_AUDIT_TEST_SCENARIO;
  if (scenario === 'network') throw new Error('Synthetic network failure');
  if (scenario === 'denied') return new Response('{}', { status: 403 });
  const fields = scenario === 'missing' ? [] : [
    'ParentScheduleId', 'ApprovedAt', 'UserCode', 'Date', 'RecordDate',
    'ParentID', 'UserID', 'UserId', 'AssignedStaffId', 'EventDate',
    'RecipientCertNumber', 'GrantPeriodEnd', 'Modified', 'EntryHash',
    'UpdatedAt', 'SessionId',
  ];
  return Response.json({ value: fields.map(InternalName => ({ InternalName, Title: InternalName })) });
};
