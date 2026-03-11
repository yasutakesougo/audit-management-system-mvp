/**
 * meetingProvisioningScript.ts — PowerShell provisioning scripts and
 * environment variable templates for the Meeting System SharePoint lists.
 *
 * Phase 4C: External Data 布石
 *
 * Extracted from meetingSharePointSchema.ts to separate infrastructure
 * scripting concerns from the list/field schema definitions.
 *
 * @see meetingSpSchema.ts for the JSON schema definitions.
 */

/**
 * PowerShell script generation for SharePoint list creation.
 * Following patterns from scripts/deploy-production-system.ps1
 */
export const MEETING_PROVISIONING_SCRIPT = `
# Meeting System SharePoint Lists Provisioning
# Phase 4C: External Data 布石

function New-MeetingLists {
    Write-DeploymentLog "朝会・夕会システム用SharePointリスト作成を開始..." "INFO"

    try {
        # MeetingSessions リスト
        if (-not (Get-PnPList -Identity "MeetingSessions" -ErrorAction SilentlyContinue)) {
            Write-DeploymentLog "MeetingSessions リスト作成中..." "INFO"
            New-PnPList -Title "MeetingSessions" -Description "朝会・夕会セッション記録" -Template GenericList

            # カスタムフィールド追加
            Add-PnPField -List "MeetingSessions" -DisplayName "セッションキー" -InternalName "SessionKey" -Type Text -Required
            Add-PnPField -List "MeetingSessions" -DisplayName "会議種別" -InternalName "MeetingKind" -Type Choice -Choices "morning","evening" -Required
            Add-PnPField -List "MeetingSessions" -DisplayName "開催日" -InternalName "Date" -Type DateTime -Required
            Add-PnPField -List "MeetingSessions" -DisplayName "開始時刻" -InternalName "StartTime" -Type Text
            Add-PnPField -List "MeetingSessions" -DisplayName "終了時刻" -InternalName "EndTime" -Type Text
            Add-PnPField -List "MeetingSessions" -DisplayName "司会者ID" -InternalName "ChairpersonUserId" -Type Text -Required
            Add-PnPField -List "MeetingSessions" -DisplayName "司会者名" -InternalName "ChairpersonName" -Type Text -Required
            Add-PnPField -List "MeetingSessions" -DisplayName "ステータス" -InternalName "Status" -Type Choice -Choices "scheduled","in-progress","completed","cancelled" -Required
            Add-PnPField -List "MeetingSessions" -DisplayName "参加者数" -InternalName "TotalParticipants" -Type Number -Required
            Add-PnPField -List "MeetingSessions" -DisplayName "完了ステップ数" -InternalName "CompletedSteps" -Type Number -Required
            Add-PnPField -List "MeetingSessions" -DisplayName "総ステップ数" -InternalName "TotalSteps" -Type Number -Required
            Add-PnPField -List "MeetingSessions" -DisplayName "完了率" -InternalName "CompletionRate" -Type Number -Required
            Add-PnPField -List "MeetingSessions" -DisplayName "所要時間" -InternalName "DurationMinutes" -Type Number
            Add-PnPField -List "MeetingSessions" -DisplayName "セッション備考" -InternalName "SessionNotes" -Type Note

            Write-DeploymentLog "MeetingSessions リスト作成完了" "SUCCESS"
        }

        # MeetingStepRecords リスト
        if (-not (Get-PnPList -Identity "MeetingStepRecords" -ErrorAction SilentlyContinue)) {
            Write-DeploymentLog "MeetingStepRecords リスト作成中..." "INFO"
            New-PnPList -Title "MeetingStepRecords" -Description "会議ステップ実行記録" -Template GenericList

            # カスタムフィールド追加（省略 - 詳細は上記スキーマ参照）

            Write-DeploymentLog "MeetingStepRecords リスト作成完了" "SUCCESS"
        }

        # MeetingParticipation リスト
        if (-not (Get-PnPList -Identity "MeetingParticipation" -ErrorAction SilentlyContinue)) {
            Write-DeploymentLog "MeetingParticipation リスト作成中..." "INFO"
            New-PnPList -Title "MeetingParticipation" -Description "会議参加記録" -Template GenericList

            # カスタムフィールド追加（省略 - 詳細は上記スキーマ参照）

            Write-DeploymentLog "MeetingParticipation リスト作成完了" "SUCCESS"
        }

        # MeetingPriorityRecords リスト
        if (-not (Get-PnPList -Identity "MeetingPriorityRecords" -ErrorAction SilentlyContinue)) {
            Write-DeploymentLog "MeetingPriorityRecords リスト作成中..." "INFO"
            New-PnPList -Title "MeetingPriorityRecords" -Description "重点フォロー利用者記録" -Template GenericList

            # カスタムフィールド追加（省略 - 詳細は上記スキーマ参照）

            Write-DeploymentLog "MeetingPriorityRecords リスト作成完了" "SUCCESS"
        }

        Write-DeploymentLog "朝会・夕会システム用SharePointリスト作成が完了しました" "SUCCESS"
        return $true
    }
    catch {
        Write-DeploymentLog "SharePointリスト作成に失敗: $($_.Exception.Message)" "ERROR"
        return $false
    }
}
`;

/**
 * Environment variables for meeting list configuration.
 * Following patterns from existing environment setup.
 * Add contents to `.env` file.
 */
export const MEETING_ENV_CONFIG = `
# Meeting System SharePoint Configuration
# Add to .env file

# Meeting Lists
VITE_SP_LIST_MEETING_SESSIONS=MeetingSessions
VITE_SP_LIST_MEETING_STEPS=MeetingStepRecords
VITE_SP_LIST_MEETING_PARTICIPATION=MeetingParticipation
VITE_SP_LIST_MEETING_PRIORITY=MeetingPriorityRecords

# Meeting Feature Flags
VITE_MEETING_PERSISTENCE_ENABLED=true
VITE_MEETING_AUTO_SYNC_ENABLED=true
VITE_MEETING_OFFLINE_MODE_ENABLED=false
`;
