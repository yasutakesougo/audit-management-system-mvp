import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSpClient, type SpFieldDef, __ensureListInternals } from '../../src/lib/spClient';

describe('spClient ensureListExists', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let acquireToken: ReturnType<typeof vi.fn<() => Promise<string | null>>>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch' as any);
    acquireToken = vi.fn<() => Promise<string | null>>().mockResolvedValue('tok');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns existing list metadata when the list is already provisioned', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ Id: '{ABCDEF}', Title: 'Existing List' }), { status: 200 })
    );

    const client = createSpClient(acquireToken, 'https://contoso.sharepoint.com/sites/wf/_api/web');
    const result = await client.ensureListExists('Existing List', []);

    expect(result).toEqual({ listId: 'ABCDEF', title: 'Existing List' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain(`/lists/getbytitle('Existing%20List')`);
  });

  it('creates the list and adds missing fields', async () => {
    const fields: SpFieldDef[] = [
      { internalName: 'Status', type: 'Choice', required: true, choices: ['Active', 'Closed'] },
      { internalName: 'RelatedItem', type: 'Lookup', lookupListId: '{99998888-7777-6666-5555-444433332222}' },
    ];

    fetchSpy
      .mockResolvedValueOnce(
        new Response('Not Found', { status: 404, statusText: 'Not Found' })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ Id: '{12345678-1234-1234-1234-123456789000}', Title: 'Provisioned' }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));

    const client = createSpClient(acquireToken, 'https://contoso.sharepoint.com/sites/wf/_api/web');
    const result = await client.ensureListExists('New List', fields);

    expect(result.listId).toBe('12345678-1234-1234-1234-123456789000');
    expect(result.title).toBe('Provisioned');
    expect(fetchSpy).toHaveBeenCalledTimes(5);

    const addStatusBody = JSON.parse((fetchSpy.mock.calls[3][1] as RequestInit).body as string);
    expect(addStatusBody.parameters.AddToDefaultView).toBe(false);
    expect(addStatusBody.parameters.SchemaXml).toContain('Type="Choice"');
    expect(addStatusBody.parameters.SchemaXml).toContain('Required="TRUE"');
    expect(addStatusBody.parameters.SchemaXml).toContain('<CHOICES><CHOICE>Active</CHOICE><CHOICE>Closed</CHOICE></CHOICES>');

    const addLookupBody = JSON.parse((fetchSpy.mock.calls[4][1] as RequestInit).body as string);
    expect(addLookupBody.parameters.SchemaXml).toContain('Type="Lookup"');
    expect(addLookupBody.parameters.SchemaXml).toContain('List="{99998888-7777-6666-5555-444433332222}"');
  });

  it('skips adding fields that already exist on the target list', async () => {
    const fields: SpFieldDef[] = [
      { internalName: 'ExistingField', type: 'Text' },
    ];

    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ Id: '{ABC}', Title: 'Existing' }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ value: [{ InternalName: 'ExistingField', TypeAsString: 'Text', Required: false }] }),
          { status: 200 }
        )
      );

    const client = createSpClient(acquireToken, 'https://contoso.sharepoint.com/sites/wf/_api/web');
    const result = await client.ensureListExists('Existing', fields);

    expect(result).toEqual({ listId: 'ABC', title: 'Existing' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('emits default values for supported field schemas', () => {
    const { buildFieldSchema } = __ensureListInternals;

    const choiceXml = buildFieldSchema({
      internalName: 'Status',
      type: 'Choice',
      choices: ['Active', 'Closed'],
      default: 'Active',
    });
    expect(choiceXml).toContain('<Default>Active</Default>');

    const boolXml = buildFieldSchema({
      internalName: 'IsVisible',
      type: 'Boolean',
      default: true,
    });
    expect(boolXml).toContain('Default="1"');
  });

  it('warns when an existing field misses the required flag', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      fetchSpy
        .mockResolvedValueOnce(new Response(JSON.stringify({ Id: '{ABC}', Title: 'Existing' }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          value: [
            { InternalName: 'NeedsRequired', TypeAsString: 'Text', Required: false },
          ],
        }), { status: 200 }));

      const client = createSpClient(acquireToken, 'https://contoso.sharepoint.com/sites/wf/_api/web');
      const result = await client.ensureListExists('Existing', [
        { internalName: 'NeedsRequired', type: 'Text', required: true },
      ]);

      expect(result).toEqual({ listId: 'ABC', title: 'Existing' });
      const sawWarning = warnSpy.mock.calls.some((args: unknown[]) => {
        const [message] = args;
        return typeof message === 'string' && message.includes('required flag differs (current=FALSE)');
      });
      expect(sawWarning).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
