/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { auditLog } from '@/lib/debugLogger';
import { FIELD_MAP } from '@/sharepoint/fields';

/**
 * Users_Master 分割構成へのデータ移行ユーティリティ
 */
export async function migrateUserSplitData(provider: IDataProvider, options: { dryRun?: boolean } = {}): Promise<{
    processed: number;
    transportCreated: number;
    benefitCreated: number;
    errors: string[];
}> {
    const { dryRun = false } = options;
    const stats = {
        processed: 0,
        transportCreated: 0,
        benefitCreated: 0,
        errors: [] as string[]
    };

    if (dryRun) {
        auditLog.info('users:migration', 'Dry run mode: No changes will be saved.');
    }

    try {
        // 1. Users_Master から全データを取得 (現在、すべての列が SharePoint には残っている)
        const fields = FIELD_MAP.Users_Master;
        const allLegacyUsers = await provider.listItems<Record<string, any>>('Users_Master', { top: 1000 });
        stats.processed = allLegacyUsers.length;

        for (const user of allLegacyUsers) {
            const userId = user[fields.userId];
            if (!userId) {
                stats.errors.push(`User ID missing for record with Internal ID: ${user.Id}`);
                continue;
            }

            // 2. Transport データがあるかチェックして保存
            const hasTransport = user[fields.transportToDays] || user[fields.transportCourse] || user[fields.transportSchedule];
            if (hasTransport) {
                try {
                    if (!dryRun) {
                        await provider.createItem('UserTransport_Settings', {
                            UserID: userId,
                            TransportToDays: user[fields.transportToDays],
                            TransportFromDays: user[fields.transportFromDays],
                            TransportCourse: user[fields.transportCourse],
                            TransportSchedule: user[fields.transportSchedule],
                            TransportAdditionType: user[fields.transportAdditionType],
                        });
                    }
                    stats.transportCreated++;
                } catch (te) {
                    stats.errors.push(`Transport migration failed for ${userId}: ${String(te)}`);
                }
            }

            // 3. Benefit データがあるかチェックして保存
            const hasBenefit = user[fields.recipientCertNumber] || user[fields.grantMunicipality] || user[fields.userCopayLimit];
            if (hasBenefit) {
                try {
                    if (!dryRun) {
                        await provider.createItem('UserBenefit_Profile', {
                            UserID: userId,
                            RecipientCertNumber: user[fields.recipientCertNumber],
                            RecipientCertExpiry: user[fields.recipientCertExpiry],
                            GrantMunicipality: user[fields.grantMunicipality],
                            GrantPeriodStart: user[fields.grantPeriodStart],
                            GrantPeriodEnd: user[fields.grantPeriodEnd],
                            DisabilitySupportLevel: user[fields.disabilitySupportLevel],
                            GrantedDaysPerMonth: user[fields.grantedDaysPerMonth],
                            UserCopayLimit: user[fields.userCopayLimit],
                            MealAddition: user[fields.mealAddition],
                            CopayPaymentMethod: user[fields.copayPaymentMethod],
                        });
                    }
                    stats.benefitCreated++;
                } catch (be) {
                    stats.errors.push(`Benefit migration failed for ${userId}: ${String(be)}`);
                }
            }
        }

        auditLog.info('users:migration', 'Users split data migration completed', stats);
    } catch (e) {
        const errorMsg = `Migration aborted due to critical error: ${String(e)}`;
        stats.errors.push(errorMsg);
        auditLog.error('users:migration', errorMsg);
    }

    return stats;
}
