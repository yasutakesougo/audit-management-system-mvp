import { Page, type Route } from '@playwright/test';

type PeoplePickerResult = {
  Id: number;
  Title: string;
  UserPrincipalName: string;
  Email?: string;
  LoginName?: string;
  PrincipalType?: number;
};

type PeoplePickerOptions = {
  results?: PeoplePickerResult[];
  onFilter?: (filter: string) => void;
};

const defaultResults: PeoplePickerResult[] = [
  { Id: 101, Title: '職員A', UserPrincipalName: 'a@example.com', Email: 'a@example.com', LoginName: 'i:0#.f|membership|a@example.com', PrincipalType: 1 },
  { Id: 102, Title: '職員B', UserPrincipalName: 'b@example.com', Email: 'b@example.com', LoginName: 'i:0#.f|membership|b@example.com', PrincipalType: 1 },
];

export async function setupPeoplePickerStubs(page: Page, options?: PeoplePickerOptions) {
  const results = options?.results ?? defaultResults;
  const corsHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type, prefer, odata-version, x-requestdigest, if-match',
    'access-control-allow-methods': 'GET,POST,OPTIONS,PATCH,DELETE',
  } as const;
  const jsonHeaders = { 'content-type': 'application/json', ...corsHeaders } as const;
  const fulfillOptions = async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders, body: '' });
      return true;
    }
    return false;
  };

  await page.route(/_api\/web\/siteusers/i, async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }
    const url = new URL(route.request().url());
    const filter = url.searchParams.get('$filter') ?? '';
    options?.onFilter?.(filter);

    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ value: results }),
    });
  });

  await page.route(/_api\/search\/query/i, async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        PrimaryQueryResult: {
          RelevantResults: {
            Table: {
              Rows: results.map((result) => ({
                Cells: [
                  { Key: 'AccountName', Value: result.UserPrincipalName },
                  { Key: 'PreferredName', Value: result.Title },
                  { Key: 'WorkEmail', Value: result.Email ?? result.UserPrincipalName },
                  { Key: 'UserProfile_GUID', Value: String(result.Id) },
                ],
              })),
            },
          },
        },
      }),
    });
  });
}
