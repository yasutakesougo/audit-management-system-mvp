# CI Runbook: workflow file issue（jobs=0）/ YAML parse error の切り分け

## 即断（最初の10秒）
- **症状**: Actions run が `failure` なのに **jobs が 0**
- **判定**: workflow file issue（YAML パース失敗）
- **即行動**: 対象 workflow を `git show <headSha>:.github/workflows/ci.yml` で取得し、YAML パースで確認
- **禁止**: 再実行の連打（jobs=0 はテスト失敗ではなくパース不正が原因）

## 症状
- GitHub Actions run が `failure` なのに **jobs が 0**（UI に “workflow file issue” などが出る）
- `gh run view <runId> --json jobs | jq '.jobs | length'` が `0`

これは **workflow YAML が GitHub 側で parse できていない** 可能性が高い。

---

## 最短確認（CLI）

### 1) 対象 run を特定
```bash
gh run list -b main -L 1 --json databaseId,status,conclusion,headSha,createdAt
gh run view <runId> --json jobs --jq '.jobs | length'
```

0 なら workflow parse を疑う。

### 2) どの workflow が壊れているか見る
```bash
gh run view <runId> --json workflowName,headSha,headBranch
```

### 3) 壊れている workflow をローカルで YAML パース
（まずは main の該当 sha を取る）
```bash
git show <headSha>:.github/workflows/ci.yml > /tmp/ci.yml
ruby -ryaml -e 'YAML.load_file("/tmp/ci.yml"); puts "YAML OK"'
# 失敗するなら YAML エラーが確定
```

Python でも可：
```bash
python - <<'PY'
import yaml, sys
p="/tmp/ci.yml"
yaml.safe_load(open(p,"r",encoding="utf-8").read())
print("YAML OK")
PY
```

---

## 典型原因

### A) name: に : を含むのにクォートしていない

例（NG）：
```
- name: Guard: no legacy schedule imports
```

例（OK）：
```
- name: "Guard: no legacy schedule imports"
```

GitHub のエラー例：`mapping values are not allowed here`

### B) インデント崩れ / タブ混入 / コピペ由来の不可視文字
- `\t`（タブ）や CRLF 由来の崩れが混入することがある

---

## 修正手順（最短）
1. エラー箇所（多くは `name:` や `run:` 周辺）を修正
2. ローカルで YAML パースが通ることを確認（上記 ruby/python）
3. PR を作って auto-merge
4. main の最新 run で jobs が生成されていることを確認

---

## 再発防止ルール（このリポジトリ）
- workflow の `name:` に `:` を入れる場合は **必ずクォート**
- 可能なら PR で YAML パースチェックを追加する（任意）
- `ruby -ryaml -e 'YAML.load_file(".github/workflows/ci.yml")'`

## 追加コミットの最短手順
```bash
git switch -c docs/runbook-ci-workflow-parse
mkdir -p docs/runbooks
$EDITOR docs/runbooks/ci-workflow-parse.md
git add docs/runbooks/ci-workflow-parse.md
git commit -m "docs(runbook): add workflow parse troubleshooting"
git push -u origin docs/runbook-ci-workflow-parse
gh pr create --title "docs(runbook): workflow parse troubleshooting" --body "Add a runbook for workflow file issue (jobs=0) / YAML parse errors."
gh pr merge --auto --squash
```
