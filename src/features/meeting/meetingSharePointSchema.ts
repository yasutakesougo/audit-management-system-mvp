/**
 * SharePoint Provisioning Schema for Meeting System
 *
 * Phase 4C: External Data 布石
 *
 * Defines SharePoint list and field schemas for朝会・夕会 meeting data persistence.
 * Following established patterns from provision/schema.json and docs/provisioning.md
 *
 * Usage:
 * 1. Add this schema to provision/schema.json
 * 2. Run provisioning scripts to create SharePoint lists
 * 3. Use with useMeetingData hook for persistence operations
 */

export const MEETING_SHAREPOINT_SCHEMA = {
  "lists": [
    {
      "title": "MeetingSessions",
      "description": "朝会・夕会セッション記録",
      "template": "GenericList",
      "fields": [
        {
          "displayName": "セッションキー",
          "internalName": "SessionKey",
          "type": "Text",
          "required": true,
          "enforceUnique": true,
          "maxLength": 50,
          "description": "一意のセッション識別子（日付#種別形式）",
          "addToDefaultView": true
        },
        {
          "displayName": "会議種別",
          "internalName": "MeetingKind",
          "type": "Choice",
          "required": true,
          "choices": ["morning", "evening"],
          "choicesPolicy": "additive",
          "description": "朝会 (morning) または夕会 (evening)",
          "addToDefaultView": true
        },
        {
          "displayName": "開催日",
          "internalName": "Date",
          "type": "DateTime",
          "required": true,
          "description": "会議開催日",
          "addToDefaultView": true
        },
        {
          "displayName": "開始時刻",
          "internalName": "StartTime",
          "type": "Text",
          "required": false,
          "maxLength": 10,
          "description": "実際の開始時刻 (HH:MM形式)",
          "addToDefaultView": true
        },
        {
          "displayName": "終了時刻",
          "internalName": "EndTime",
          "type": "Text",
          "required": false,
          "maxLength": 10,
          "description": "実際の終了時刻 (HH:MM形式)",
          "addToDefaultView": true
        },
        {
          "displayName": "司会者ID",
          "internalName": "ChairpersonUserId",
          "type": "Text",
          "required": true,
          "maxLength": 50,
          "description": "司会を担当した職員ID",
          "addToDefaultView": true
        },
        {
          "displayName": "司会者名",
          "internalName": "ChairpersonName",
          "type": "Text",
          "required": true,
          "maxLength": 100,
          "description": "司会者の表示名",
          "addToDefaultView": true
        },
        {
          "displayName": "ステータス",
          "internalName": "Status",
          "type": "Choice",
          "required": true,
          "choices": ["scheduled", "in-progress", "completed", "cancelled"],
          "choicesPolicy": "additive",
          "description": "会議の進行状況",
          "addToDefaultView": true
        },
        {
          "displayName": "参加者数",
          "internalName": "TotalParticipants",
          "type": "Number",
          "required": true,
          "description": "参加者の総数",
          "addToDefaultView": true
        },
        {
          "displayName": "完了ステップ数",
          "internalName": "CompletedSteps",
          "type": "Number",
          "required": true,
          "description": "完了したステップの数",
          "addToDefaultView": true
        },
        {
          "displayName": "総ステップ数",
          "internalName": "TotalSteps",
          "type": "Number",
          "required": true,
          "description": "会議の総ステップ数",
          "addToDefaultView": true
        },
        {
          "displayName": "完了率",
          "internalName": "CompletionRate",
          "type": "Number",
          "required": true,
          "description": "ステップ完了率（パーセンテージ）",
          "addToDefaultView": true
        },
        {
          "displayName": "所要時間",
          "internalName": "DurationMinutes",
          "type": "Number",
          "required": false,
          "description": "会議の所要時間（分）",
          "addToDefaultView": false
        },
        {
          "displayName": "セッション備考",
          "internalName": "SessionNotes",
          "type": "Note",
          "required": false,
          "description": "会議全体に関する備考",
          "addToDefaultView": false
        }
      ]
    },

    {
      "title": "MeetingStepRecords",
      "description": "会議ステップ実行記録",
      "template": "GenericList",
      "fields": [
        {
          "displayName": "セッションID",
          "internalName": "SessionId",
          "type": "Number",
          "required": true,
          "description": "関連するMeetingSessionsのID",
          "addToDefaultView": true
        },
        {
          "displayName": "セッションキー",
          "internalName": "SessionKey",
          "type": "Text",
          "required": true,
          "maxLength": 50,
          "description": "関連するセッションの識別子",
          "addToDefaultView": true
        },
        {
          "displayName": "ステップID",
          "internalName": "StepId",
          "type": "Number",
          "required": true,
          "description": "ステップテンプレートのID",
          "addToDefaultView": true
        },
        {
          "displayName": "ステップタイトル",
          "internalName": "StepTitle",
          "type": "Text",
          "required": true,
          "maxLength": 200,
          "description": "ステップの表示タイトル",
          "addToDefaultView": true
        },
        {
          "displayName": "完了フラグ",
          "internalName": "Completed",
          "type": "Boolean",
          "required": true,
          "description": "ステップが完了したかどうか",
          "addToDefaultView": true
        },
        {
          "displayName": "完了日時",
          "internalName": "CompletedAt",
          "type": "DateTime",
          "required": false,
          "description": "ステップが完了した日時",
          "addToDefaultView": true
        },
        {
          "displayName": "完了者ID",
          "internalName": "CompletedByUserId",
          "type": "Text",
          "required": false,
          "maxLength": 50,
          "description": "ステップを完了した職員ID",
          "addToDefaultView": false
        },
        {
          "displayName": "所要時間",
          "internalName": "TimeSpentMinutes",
          "type": "Number",
          "required": true,
          "description": "ステップにかかった時間（分）",
          "addToDefaultView": true
        },
        {
          "displayName": "ステップ備考",
          "internalName": "StepNotes",
          "type": "Note",
          "required": false,
          "description": "ステップ固有の備考",
          "addToDefaultView": false
        }
      ]
    },

    {
      "title": "MeetingParticipation",
      "description": "会議参加記録",
      "template": "GenericList",
      "fields": [
        {
          "displayName": "セッションID",
          "internalName": "SessionId",
          "type": "Number",
          "required": true,
          "description": "関連するMeetingSessionsのID",
          "addToDefaultView": true
        },
        {
          "displayName": "セッションキー",
          "internalName": "SessionKey",
          "type": "Text",
          "required": true,
          "maxLength": 50,
          "description": "関連するセッションの識別子",
          "addToDefaultView": true
        },
        {
          "displayName": "参加者ID",
          "internalName": "ParticipantUserId",
          "type": "Text",
          "required": true,
          "maxLength": 50,
          "description": "参加者の職員ID",
          "addToDefaultView": true
        },
        {
          "displayName": "参加者名",
          "internalName": "ParticipantName",
          "type": "Text",
          "required": true,
          "maxLength": 100,
          "description": "参加者の表示名",
          "addToDefaultView": true
        },
        {
          "displayName": "役割",
          "internalName": "Role",
          "type": "Choice",
          "required": true,
          "choices": ["chairperson", "staff", "observer", "trainee"],
          "choicesPolicy": "additive",
          "description": "会議での役割",
          "addToDefaultView": true
        },
        {
          "displayName": "出席状況",
          "internalName": "AttendanceStatus",
          "type": "Choice",
          "required": true,
          "choices": ["present", "remote", "absent"],
          "choicesPolicy": "additive",
          "description": "出席の形態",
          "addToDefaultView": true
        },
        {
          "displayName": "参加時刻",
          "internalName": "JoinTime",
          "type": "DateTime",
          "required": false,
          "description": "会議に参加した時刻",
          "addToDefaultView": false
        },
        {
          "displayName": "退席時刻",
          "internalName": "LeaveTime",
          "type": "DateTime",
          "required": false,
          "description": "会議から退席した時刻",
          "addToDefaultView": false
        },
        {
          "displayName": "参加備考",
          "internalName": "Notes",
          "type": "Note",
          "required": false,
          "description": "参加に関する備考",
          "addToDefaultView": false
        }
      ]
    },

    {
      "title": "MeetingPriorityRecords",
      "description": "重点フォロー利用者記録",
      "template": "GenericList",
      "fields": [
        {
          "displayName": "セッションID",
          "internalName": "SessionId",
          "type": "Number",
          "required": true,
          "description": "関連するMeetingSessionsのID",
          "addToDefaultView": true
        },
        {
          "displayName": "セッションキー",
          "internalName": "SessionKey",
          "type": "Text",
          "required": true,
          "maxLength": 50,
          "description": "関連するセッションの識別子",
          "addToDefaultView": true
        },
        {
          "displayName": "利用者ID",
          "internalName": "UserId",
          "type": "Text",
          "required": true,
          "maxLength": 50,
          "description": "対象利用者のID",
          "addToDefaultView": true
        },
        {
          "displayName": "利用者名",
          "internalName": "UserName",
          "type": "Text",
          "required": true,
          "maxLength": 100,
          "description": "対象利用者の表示名",
          "addToDefaultView": true
        },
        {
          "displayName": "優先度",
          "internalName": "Priority",
          "type": "Choice",
          "required": true,
          "choices": ["high", "medium", "low"],
          "choicesPolicy": "additive",
          "description": "フォローアップの優先度",
          "addToDefaultView": true
        },
        {
          "displayName": "フォロー理由",
          "internalName": "FollowUpReason",
          "type": "Note",
          "required": true,
          "description": "なぜフォローが必要か",
          "addToDefaultView": true
        },
        {
          "displayName": "検討内容",
          "internalName": "DiscussionNotes",
          "type": "Note",
          "required": false,
          "description": "会議で話し合われた内容",
          "addToDefaultView": false
        },
        {
          "displayName": "具体的対応",
          "internalName": "ActionItems",
          "type": "Note",
          "required": false,
          "description": "決定された具体的な対応策",
          "addToDefaultView": false
        },
        {
          "displayName": "担当者ID",
          "internalName": "AssignedStaffId",
          "type": "Text",
          "required": false,
          "maxLength": 50,
          "description": "フォローアップ担当者のID",
          "addToDefaultView": true
        },
        {
          "displayName": "期限",
          "internalName": "FollowUpDeadline",
          "type": "DateTime",
          "required": false,
          "description": "フォローアップの期限日",
          "addToDefaultView": true
        },
        {
          "displayName": "解決済み",
          "internalName": "Resolved",
          "type": "Boolean",
          "required": true,
          "description": "課題が解決されたかどうか",
          "addToDefaultView": true
        }
      ]
    }
  ],

  "views": [
    {
      "listTitle": "MeetingSessions",
      "viewName": "Recent Meetings",
      "query": "<OrderBy><FieldRef Name='Date' Ascending='FALSE' /></OrderBy>",
      "rowLimit": 30,
      "fields": ["Title", "MeetingKind", "Date", "ChairpersonName", "Status", "CompletionRate"]
    },
    {
      "listTitle": "MeetingStepRecords",
      "viewName": "Incomplete Steps",
      "query": "<Where><Eq><FieldRef Name='Completed' /><Value Type='Boolean'>0</Value></Eq></Where><OrderBy><FieldRef Name='SessionKey' /><FieldRef Name='StepId' /></OrderBy>",
      "rowLimit": 50,
      "fields": ["Title", "SessionKey", "StepTitle", "Completed", "TimeSpentMinutes"]
    },
    {
      "listTitle": "MeetingPriorityRecords",
      "viewName": "Unresolved Priority Items",
      "query": "<Where><Eq><FieldRef Name='Resolved' /><Value Type='Boolean'>0</Value></Eq></Where><OrderBy><FieldRef Name='Priority' /><FieldRef Name='FollowUpDeadline' /></OrderBy>",
      "rowLimit": 50,
      "fields": ["Title", "UserName", "Priority", "FollowUpReason", "AssignedStaffId", "FollowUpDeadline"]
    }
  ],

  "permissions": [
    {
      "listTitle": "MeetingSessions",
      "permissions": [
        {
          "principal": "会議司会者",
          "permissionLevel": "Contribute"
        },
        {
          "principal": "職員",
          "permissionLevel": "Read"
        }
      ]
    },
    {
      "listTitle": "MeetingStepRecords",
      "permissions": [
        {
          "principal": "会議司会者",
          "permissionLevel": "Contribute"
        },
        {
          "principal": "職員",
          "permissionLevel": "Read"
        }
      ]
    },
    {
      "listTitle": "MeetingParticipation",
      "permissions": [
        {
          "principal": "会議司会者",
          "permissionLevel": "Contribute"
        },
        {
          "principal": "職員",
          "permissionLevel": "Read"
        }
      ]
    },
    {
      "listTitle": "MeetingPriorityRecords",
      "permissions": [
        {
          "principal": "会議司会者",
          "permissionLevel": "Contribute"
        },
        {
          "principal": "職員",
          "permissionLevel": "Contribute"
        }
      ]
    }
  ]
};

/**
 * PowerShell script generation for SharePoint list creation
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
 * Environment variables for meeting list configuration
 * Following patterns from existing environment setup
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

export default MEETING_SHAREPOINT_SCHEMA;