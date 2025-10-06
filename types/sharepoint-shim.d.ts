export {};

declare global {
  interface SpItemBase {
    Id: number;
    Title?: string | null;
    Created?: string;
    Modified?: string;
  }

  interface SpUserItem extends SpItemBase {
    UserID?: string | null;
    FullName?: string | null;
    Furigana?: string | null;
    FullNameKana?: string | null;
    ContractDate?: string | null;
    ServiceStartDate?: string | null;
    ServiceEndDate?: string | null;
    IsHighIntensitySupportTarget?: boolean | null;
    severeFlag?: boolean | null;
    IsActive?: boolean | null;
    TransportToDays?: string[] | string | null;
    TransportFromDays?: string[] | string | null;
    AttendanceDays?: string[] | string | null;
    RecipientCertNumber?: string | null;
    RecipientCertExpiry?: string | null;
  }
}
