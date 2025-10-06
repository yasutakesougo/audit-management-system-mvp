export type SPItem<T extends object = object> = {
  Id: number;
  Title?: string | null;
  '@odata.etag'?: string;
  Created?: string;
  Modified?: string;
} & T;
