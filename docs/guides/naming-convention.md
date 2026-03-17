# 命名規約ガイド

> Support Operations OS — Phase 5 で確立された命名原則

## 基本原則

このシステムでは、すべてのデータは **「誰のデータか」** に帰着します。
利用者・職員の識別子は、以下のルールで統一します。

## 識別子の標準名

| 対象 | 識別子 | 表示名 | コード | 用途 |
|------|--------|--------|--------|------|
| **利用者** | `userId` | `userName` | `userCode` | 全ドメインで使用 |
| **職員** | `staffId` | `staffName` | `staffCode` | 全ドメインで使用 |

## 禁止される命名

| 廃止名 | 代替 | 理由 |
|--------|------|------|
| `personId` | `userId` | Phase 5 で統一済み |
| `personName` | `userName` | Phase 5 で統一済み |

> **例外**: SharePoint 内部名 (`cr013_personId`, `cr014_personId` 等) は
> infra / mapper / adapter 層でのみ使用可能です。Domain と Features では使用禁止です。

## レイヤーごとの適用ルール

### Domain 層 (`src/domain/`)

- `userId` / `userName` のみ使用
- SharePoint 列名を知ってはならない

### Features 層 (`src/features/`)

- `userId` / `userName` を使用
- 例外: `schedules/data/`, `schedules/infra/`, `meeting/` は SharePoint 変換のため `personId` / `personName` を使用可能

### Infra / Mapper 層

- SharePoint 列名 (`cr014_personId` 等) との変換を担当
- `personId` → `userId` の変換はここで吸収する

### テスト

- テストデータも `userId` / `userName` を使用
- モック関数名も統一 (`findByUserId`, NOT `findByPersonId`)

## ESLint ガード

`.eslintrc.cjs` に以下のガードが設定されています:

```
src/domain/**
src/features/** (schedules/data, schedules/infra, meeting を除く)
```

上記のパスで `personId` / `personName` をプロパティとして定義すると **warn** が発生します。

## 参照アーキテクチャとの関係

User 参照アーキテクチャで確立された2パターンとの対応:

| パターン | 用途 | 識別子 |
|----------|------|--------|
| `UserRef` | リアルタイム表示 (Daily 等) | `userId` + `userName` |
| `UserSnapshot` | 監査保全 (ISP, Incident) | `userId` + `userName` + `userCode` + `snapshotAt` |

## 議長名について

`chairpersonName` / `ChairpersonName` は **議長 (chairperson)** の名前であり、
`person` とは別の概念です。これは命名統一の対象外です。

## 制定日

- **Phase 5 完了日**: 2026-03-17
- **ESLint ガード追加日**: 2026-03-17
