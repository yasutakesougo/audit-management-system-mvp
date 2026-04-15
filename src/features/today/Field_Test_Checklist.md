# Field Test Checklist: Peace-of-Mind UX

Use this checklist during the "Phase 5: Field Optimization" to validate that the new "Simple Mode" behavior achieves operational closure for front-line staff.

## 1. Submission Flow (Emotional Validation)
- [ ] **Closure Signal**: Does the user react positively to the "✨ お疲れ様です" block after submission?
- [ ] **Confidence Level**: If asked "Is your work for today finished?", do they answer "Yes" without checking other screens?
- [ ] **Post-Save Action**: Does the user put the device away or start physical handoff immediately after seeing the success message?

## 2. Navigation & Context
- [ ] **Context Retention**: Does the user seem confused about being returned to the Today Hub (instead of the previous analysis screen)?
- [ ] **Recursive Entry**: If they need to edit a record they just saved, can they find it easily in the User List (ZONE C1)?
- [ ] **No Dead Ends**: Verify that no "Admin-only" buttons are visible that lead to 403 or empty pages for field staff.

## 3. Resilience & Trust
- [ ] **Retry Reaction**: If a submission fails (test with airplane mode), is the "サーバーへの保存に失敗しました" message clear enough to prevent panic?
- [ ] **Async Sync**: Verify that the "All Done" hero state appears only after the background refetch completes (avoiding flicker).

## 4. Auditor/Admin Perspective
- [ ] **Observability**: Verify that an Admin user *still* sees the PDCA analysis screen after submission to ensure data integrity checks.
- [ ] **Diagnostic Integrity**: Confirm that high-priority system alerts (e.g., vital drift) are still visible to Admins even when "Simple Mode" is active for others.
