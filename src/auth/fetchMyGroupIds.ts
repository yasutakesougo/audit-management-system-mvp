/**
 * Fetch the list of group IDs the current user is a member of.
 * Used for authorization checks (reception, admin roles).
 *
 * Moved from features/schedules/data/graphAdapter.ts to auth/
 * because this is an authorization concern, not a schedules concern.
 */

type GetToken = () => Promise<string | null>;

export const fetchMyGroupIds = async (getToken: GetToken): Promise<string[]> => {
  const token = await getToken();
  if (!token) return [];

  const fetchAllIds = async (initialUrl: string): Promise<string[]> => {
    const ids: string[] = [];
    let nextUrl: string | undefined = initialUrl;

    while (nextUrl) {
      // eslint-disable-next-line no-restricted-globals -- TODO: Phase 2 で graphFetch に統一
      const res = await fetch(nextUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`memberOf failed: ${res.status} ${body.slice(0, 200)}`.trim());
      }

      const json = (await res.json().catch(() => ({}))) as {
        value?: Array<{ id?: string }>;
        '@odata.nextLink'?: string;
      };

      const chunk = (json.value ?? [])
        .map((v) => v.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      ids.push(...chunk);
      nextUrl = json['@odata.nextLink'];
    }

    return ids;
  };

  const endpoints = [
    'https://graph.microsoft.com/v1.0/me/transitiveMemberOf?$select=id',
    'https://graph.microsoft.com/v1.0/me/memberOf?$select=id',
  ];

  for (const endpoint of endpoints) {
    try {
      return await fetchAllIds(endpoint);
    } catch (error) {
      if (endpoint === endpoints[endpoints.length - 1]) {
        throw error;
      }
    }
  }

  return [];
};
