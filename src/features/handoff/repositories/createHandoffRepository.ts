import type { HandoffRepository } from "@/domain/HandoffRepository";
import { LocalHandoffRepository } from "@/infra/sharepoint/repos/localHandoffRepository";
import { SPHandoffRepository } from "@/infra/sharepoint/repos/spHandoffRepository";
import { SP_ENABLED } from "@/lib/env";
import type { UseSP } from "@/lib/spClient";

/**
 * 環境変数 `VITE_SP_ENABLED` に応じて
 * SharePoint用のレポジトリか、ローカルMock用のレポジトリを出し分ける Factory
 */
export const createHandoffRepository = (
  spClient: UseSP
): HandoffRepository => {
  if (SP_ENABLED) {
    return new SPHandoffRepository(spClient);
  } else {
    return new LocalHandoffRepository();
  }
};
