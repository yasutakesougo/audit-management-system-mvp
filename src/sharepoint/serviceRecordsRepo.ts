import { getSp, LIST_ATTENDANCE, LIST_ADDONS } from "./ensureServiceRecordsLists";
export type AttendancePayload = Record<string, string | number | boolean | undefined>;
export async function upsertAttendance(entry: AttendancePayload) {
  const sp = getSp();
  const list = sp.web.lists.getByTitle(LIST_ATTENDANCE);
  const entryHash = entry.EntryHash as string;
  if (!entryHash) throw new Error("EntryHash is required");

  const hit = await list.items.filter(`EntryHash eq '${entryHash}'`).top(1)();
  if (hit?.length) {
    await list.items.getById(hit[0].Id).update(entry);
    return hit[0].Id;
  } else {
    const add = await list.items.add(entry);
    return add.data.Id;
  }
}

export type AddonPayload = {
  RecordDate: string;
  UserCode: string;
  AddonCode: string;
  AddonValue: number;
  LinkedEntryHash?: string;
  EntryHash: string;
};
export async function addAddon(row: AddonPayload) {
  const sp = getSp();
  const list = sp.web.lists.getByTitle(LIST_ADDONS);
  const entryHash = row.EntryHash as string;
  if (!entryHash) throw new Error("EntryHash is required");

  const exists = await list.items.filter(`EntryHash eq '${entryHash}'`).top(1)();
  if (!exists?.length) {
    await list.items.add(row);
  }
}
