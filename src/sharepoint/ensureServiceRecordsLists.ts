  interface WindowWithSpBase { __spBaseUrl?: string }
  const _baseUrl = (window as WindowWithSpBase).__spBaseUrl || "";
import { spfi } from "@pnp/sp";
import { SPBrowser } from "@pnp/sp/behaviours/spbrowser";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/fields";
import "@pnp/sp/items";

export const LIST_ATTENDANCE = "ServiceAttendanceDaily";
export const LIST_ADDONS = "ServiceAddonsDaily";

export const getSp = () => {
  // 例: index.html などで window.__spBaseUrl = "https://{tenant}.sharepoint.com/sites/{site}"
  interface WindowWithSpBase { __spBaseUrl?: string }
  const _baseUrl = (window as WindowWithSpBase).__spBaseUrl || "";
  return spfi().using(SPBrowser({ baseUrl: _baseUrl }));
};

type EnsureResult = { created: boolean };
export async function ensureServiceRecordsLists(sp = getSp()): Promise<{
  attendance: EnsureResult;
  addons: EnsureResult;
}> {
  // --- A) Attendance ---
  const a = await sp.web.lists.ensure(
    LIST_ATTENDANCE,
    "生活介護: 日次実績",
    100,
    true,
    { OnQuickLaunch: true }
  );

  if (a.created) {
    const fields = sp.web.lists.getByTitle(LIST_ATTENDANCE).fields;

    await fields.addDateTime("RecordDate", { DisplayFormat: 0, Required: true }); // 日付のみ
    await fields.addText("UserCode", 50, { Required: true });
    await fields.addChoice("Status", {
      Choices: ["未", "通所中", "退所済", "当日欠席"],
      Required: true,
    });

    await fields.addDateTime("CheckInAt");
    await fields.addDateTime("CheckOutAt");
    await fields.addNumber("CntAttendIn", { MinimumValue: 0, MaximumValue: 1 });
    await fields.addNumber("CntAttendOut", { MinimumValue: 0, MaximumValue: 1 });
    await fields.addBoolean("TransportTo");
    await fields.addBoolean("TransportFrom");
    await fields.addBoolean("IsEarlyLeave");

    await fields.addBoolean("AbsentMorningContacted");
    await fields.addChoice("AbsentMorningMethod", {
      Choices: ["電話", "SMS", "家族", "その他", ""],
    });
    await fields.addBoolean("EveningChecked");
    await fields.addNote("EveningNote", 6, false);

    await fields.addBoolean("IsAbsenceAddonClaimable");
    await fields.addNumber("ProvidedMinutes");
    await fields.addDateTime("UserConfirmedAt");

    await fields.addText("EntryHash", 255, { Required: true }); // ユニークキー: date+user

    // インデックス等
    const listA = sp.web.lists.getByTitle(LIST_ATTENDANCE);
    await listA.fields
      .getByInternalNameOrTitle("EntryHash")
      .update({ EnforceUniqueValues: true, Indexed: true });
    await listA.fields.getByInternalNameOrTitle("RecordDate").update({ Indexed: true });
    await listA.fields.getByInternalNameOrTitle("UserCode").update({ Indexed: true });
  }

  // --- B) Addons ---
  const b = await sp.web.lists.ensure(
    LIST_ADDONS,
    "生活介護: 日次加算",
    100,
    true,
    { OnQuickLaunch: false }
  );

  if (b.created) {
    const fields = sp.web.lists.getByTitle(LIST_ADDONS).fields;

    await fields.addDateTime("RecordDate", { DisplayFormat: 0, Required: true });
    await fields.addText("UserCode", 50, { Required: true });
    await fields.addChoice("AddonCode", {
      Choices: ["送迎往", "送迎復", "食事提供", "入浴", "延長", "初期", "欠席対応"],
      Required: true,
    });
    await fields.addNumber("AddonValue");
    await fields.addText("LinkedEntryHash", 255); // Attendance.EntryHash 参照用
    await fields.addText("EntryHash", 255, { Required: true }); // RecordDate:UserCode:AddonCode

    const listB = sp.web.lists.getByTitle(LIST_ADDONS);
    await listB.fields
      .getByInternalNameOrTitle("EntryHash")
      .update({ EnforceUniqueValues: true, Indexed: true });
    await listB.fields
      .getByInternalNameOrTitle("LinkedEntryHash")
      .update({ Indexed: true });
  }

  return { attendance: { created: a.created }, addons: { created: b.created } };
}
