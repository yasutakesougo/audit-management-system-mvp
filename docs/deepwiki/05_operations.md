# Operations Guide

This document describes deployment, runtime, observability, and operational procedures for the Audit Management System.

## Environments

### Development
- **Purpose**: Local development and testing
- **URL**: `http://localhost:5173` (Vite dev server)
- **Authentication**: Optional (can use `VITE_SKIP_LOGIN=1`)
- **Data**: Demo mode (in-memory) or test SharePoint site
- **Monitoring**: Console logging only
- **Feature Flags**: All features enabled for testing

### Staging / UAT
- **Purpose**: User acceptance testing, pre-production validation
- **URL**: Configured per deployment (e.g., SharePoint site or Azure Static Web App)
- **Authentication**: Azure AD (test tenant or isolated prod app registration)
- **Data**: Separate SharePoint site with test data
- **Monitoring**: Sentry (staging environment)
- **Feature Flags**: Mirror production configuration

### Production
- **Purpose**: Live system for actual operations
- **URL**: Configured per deployment (typically SharePoint-hosted or dedicated domain)
- **Authentication**: Azure AD (production tenant)
- **Data**: Production SharePoint site (`/sites/welfare` or similar)
- **Monitoring**: Sentry, Lighthouse CI, Azure Monitor
- **Feature Flags**: Controlled via config, conservative enabling

## Deployment process

### Prerequisites

1. **Azure AD App Registration**
   - Client ID and Tenant ID configured
   - Redirect URIs registered
   - API permissions granted:
     - `Sites.Read.All` (minimum)
     - `Sites.FullControl.All` (for provisioning)
   - Admin consent granted

2. **SharePoint Site**
   - Site created (e.g., `/sites/welfare`)
   - Appropriate permissions assigned to app
   - Site accessible to target users

3. **GitHub Repository Secrets** (if using GitHub Actions)
   - `AAD_TENANT_ID`
   - `AAD_APP_ID`
   - `SPO_RESOURCE` (SharePoint tenant URL)
   - `SPO_CLIENT_SECRET` or `SPO_CERT_BASE64` + `SPO_CERT_PASSWORD`

### Provisioning SharePoint schema

**Before first deployment or schema changes:**

1. **Update schema definition**
   - Edit `provision/schema.json`
   - Define lists, fields, choices
   - Follow schema conventions (see `docs/provisioning.md`)

2. **Run WhatIf (dry run)**
   ```bash
   # Via GitHub Actions
   # Trigger workflow: provision-sharepoint.yml
   # Inputs: whatIf=true
   ```
   - Review the change summary in workflow output
   - Check for unexpected modifications

3. **Apply schema**
   ```bash
   # Via GitHub Actions
   # Trigger workflow: provision-sharepoint.yml
   # Inputs: whatIf=false, applyFieldUpdates=true
   ```
   - Lists and fields created/updated
   - Existing data preserved (unless `recreateExisting=true`)

4. **Verify schema**
   - Log into SharePoint site
   - Check lists exist with correct fields
   - Smoke test: Create/read/update sample record

**Important**: Never use `recreateExisting=true` in production without full backup.

See [Provisioning Guide](../provisioning.md) for detailed schema management procedures.

### Application deployment

#### Option 1: SharePoint-hosted (Static Bundle)

**Steps:**

1. **Build production bundle**
   ```bash
   npm run build
   ```
   - Generates optimized bundle in `dist/`
   - Assets hashed and minified
   - Source maps generated (upload to Sentry separately)

2. **Configure runtime environment**
   - Create `dist/env.runtime.json`:
   ```json
   {
     "VITE_MSAL_CLIENT_ID": "<production-client-id>",
     "VITE_MSAL_TENANT_ID": "<production-tenant-id>",
     "VITE_SP_RESOURCE": "https://<tenant>.sharepoint.com",
     "VITE_SP_SITE_RELATIVE": "/sites/welfare",
     "VITE_SP_SCOPE_DEFAULT": "https://<tenant>.sharepoint.com/AllSites.Read"
   }
   ```

3. **Upload to SharePoint**
   - Navigate to SharePoint site
   - Open Site Contents → "Site Assets" or create "App" document library
   - Upload all files from `dist/` folder
   - Set `index.html` as the site's home page or create a page with embed

4. **Test deployment**
   - Navigate to deployed URL
   - Verify login works
   - Check data loads from SharePoint
   - Test create/update operations

**Pros**: No external hosting needed, integrated with SharePoint permissions  
**Cons**: Limited control over caching, CDN, HTTP headers

#### Option 2: External Static Host (Azure Static Web Apps, Netlify, etc.)

**Steps:**

1. **Build production bundle** (same as above)

2. **Configure hosting service**
   - Set build command: `npm run build`
   - Set output directory: `dist`
   - Configure custom domain (optional)

3. **Set environment variables**
   - In hosting platform's settings, add:
     - `VITE_MSAL_CLIENT_ID`
     - `VITE_MSAL_TENANT_ID`
     - `VITE_SP_RESOURCE`
     - `VITE_SP_SITE_RELATIVE`
     - etc.
   - Or use `env.runtime.json` approach

4. **Configure redirect rules**
   - For SPA routing, ensure all routes return `index.html`
   - Example (Azure Static Web Apps - `staticwebapp.config.json`):
   ```json
   {
     "navigationFallback": {
       "rewrite": "/index.html",
       "exclude": ["/assets/*", "/env.runtime.json"]
     }
   }
   ```

5. **Deploy**
   - Push to connected Git branch (automatic deployment), or
   - Manual upload via CLI
   - Monitor deployment logs

6. **Update Azure AD redirect URIs**
   - Add deployed URL to app registration
   - Format: `https://<your-domain>` and `https://<your-domain>/`

**Pros**: Better performance (CDN), more control, easier rollback  
**Cons**: Requires external service, additional configuration

### CI/CD Pipeline (GitHub Actions)

**Workflow file**: `.github/workflows/deploy.yml` (example)

```yaml
name: Deploy Production

on:
  push:
    branches: [main]  # Adjust to match your default branch

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test:ci
      
      - name: Build
        run: npm run build
        env:
          VITE_MSAL_CLIENT_ID: ${{ secrets.PROD_MSAL_CLIENT_ID }}
          # ... other env vars
      
      - name: Deploy to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/"
          output_location: "dist"
```

**Pipeline stages:**
1. ✅ Lint and type check
2. ✅ Run unit tests (Vitest)
3. ✅ Build production bundle
4. ✅ Assert bundle size limits
5. ✅ Deploy to hosting
6. ✅ Run smoke tests (Playwright)
7. ✅ Upload source maps to Sentry

## Runtime configuration

### Environment variable precedence

1. **Runtime JSON** (`/env.runtime.json`): Highest priority
2. **Window global** (`window.__ENV__`): Injected before app load
3. **Build-time variables** (`import.meta.env`): Fallback

### Updating configuration post-deployment

**To change MSAL client ID without rebuild:**

1. Edit `env.runtime.json` in deployed environment:
   ```json
   {
     "VITE_MSAL_CLIENT_ID": "<new-client-id>"
   }
   ```

2. No app restart needed; users get new config on next page load

**Alternatively, inline script in `index.html`:**
```html
<script>
  window.__ENV__ = {
    VITE_MSAL_CLIENT_ID: '<dynamic-client-id>'
  };
</script>
<script type="module" src="/src/main.tsx"></script>
```

## Monitoring and observability

### Application monitoring (Sentry)

**Setup:**
1. Create Sentry project
2. Add DSN to environment config:
   ```bash
   VITE_SENTRY_DSN=https://...@sentry.io/...
   ```
3. Initialize in `src/main.tsx`:
   ```typescript
   if (import.meta.env.PROD && config.sentryDsn) {
     Sentry.init({ dsn: config.sentryDsn, /* ... */ });
   }
   ```

**What's captured:**
- Unhandled JavaScript errors
- Unhandled promise rejections
- React component errors (via Error Boundary)
- Manual error reports
- Breadcrumbs (user actions, API calls)

**Alerts:**
- Configure Sentry alerts for:
  - Error rate > threshold
  - New error types
  - Performance degradation

### Performance monitoring (Lighthouse CI)

**Setup:**
1. Configure `.lighthouserc.json`
2. Add GitHub Action:
   ```yaml
   - name: Run Lighthouse CI
     run: |
       npm install -g @lhci/cli
       lhci autorun
   ```

**Metrics tracked:**
- Performance score (target: ≥97)
- Accessibility score (target: 100)
- Best practices score
- SEO score
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Time to Interactive (TTI)

**Thresholds:**
- Performance: ≥95 (warn), ≥97 (pass)
- Accessibility: 100 (required)
- Bundle size: <500KB (critical chunks)

### Logging

#### Development
- Console logging enabled
- Redux DevTools (if applicable)
- Verbose error messages

#### Production
- Console logging minimized
- Errors sent to Sentry
- Audit logs to SharePoint + LocalStorage
- No sensitive data in logs (scrubbed)

### Audit log monitoring

**Audit log exports:**
- **Frequency**: Daily (automated via cron or Power Automate)
- **Format**: CSV (RFC 4180 compliant)
- **Storage**: OneDrive or file server (30-day retention minimum)
- **Review**: Weekly spot-checks by admin

**Key metrics to monitor:**
- Total actions per day
- Failed operations count
- Unauthorized access attempts
- Data modification frequency
- Sync failures (LocalStorage → SharePoint)

## Backup and recovery

### Data backup

#### SharePoint lists (Primary data)
- **Frequency**: Daily (automated)
- **Method**: SharePoint export or Power Automate flow
- **Storage**: OneDrive, Azure Blob Storage, or file server
- **Retention**: 30 days rolling + quarterly snapshots
- **Format**: CSV or JSON exports per list

#### Audit logs
- **Frequency**: Daily
- **Method**: Export via application or API
- **Storage**: Separate from primary data (compliance requirement)
- **Retention**: 7 years (minimum)
- **Format**: CSV with immutable hash chain (optional)

### Disaster recovery procedures

#### Scenario 1: Application failure (code bug)

1. **Immediate**: Roll back to previous deployment
   - Revert Git commit
   - Redeploy last stable version
   - Or swap staging/production slots (Azure)

2. **Short-term**: Fix bug in dev, test thoroughly
3. **Deploy fix**: Use normal CI/CD pipeline
4. **Verify**: Smoke tests pass, Sentry errors cleared

**RTO** (Recovery Time Objective): <1 hour  
**RPO** (Recovery Point Objective): 0 (no data loss, code-only issue)

#### Scenario 2: SharePoint data corruption

1. **Immediate**: Restrict write access (if ongoing corruption)
2. **Assess**: Identify corrupted records (timestamp, user)
3. **Restore**: 
   - Option A: Restore entire list from backup (if recent)
   - Option B: Manually correct corrupted records
4. **Verify**: Data integrity checks, user testing
5. **Resume**: Re-enable write access

**RTO**: 2-4 hours  
**RPO**: Last backup (typically 24 hours)

#### Scenario 3: Complete SharePoint site loss (rare)

1. **Immediate**: Contact Microsoft support
2. **Parallel**: Provision new SharePoint site
3. **Restore schema**: Run provisioning scripts
4. **Restore data**: Import from most recent backup (CSV bulk import)
5. **Update configuration**: Point app to new site URL
6. **Verify**: Full system testing before go-live

**RTO**: 1-2 days  
**RPO**: Last backup (typically 24 hours)

#### Scenario 4: Audit log loss (LocalStorage or sync failure)

1. **Assess**: Check LocalStorage on affected devices
2. **Recover**: 
   - Export LocalStorage audit logs manually
   - Attempt batch sync to SharePoint
3. **Fallback**: Manual reconstruction from SharePoint list change history
4. **Prevent**: Implement more aggressive sync frequency

**RTO**: N/A (operational, not blocking)  
**RPO**: Varies (depends on sync frequency and device state)

## Common operational procedures

### User onboarding

1. **Azure AD**: Add user to appropriate security group
2. **SharePoint**: Verify user has access to site and relevant lists
3. **Training**: Provide role-specific training materials
4. **First login**: Guide through initial setup (if any preferences)
5. **Test**: Have user perform common actions under supervision

### User offboarding

1. **Azure AD**: Remove user from security groups
2. **SharePoint**: Verify access revoked (test with private browser)
3. **Audit**: Export audit log for user's actions (compliance)
4. **Data**: Reassign records if needed (change ownership)
5. **Hardware**: Wipe LocalStorage if using shared device

### Adding a new SharePoint field

1. **Update schema**: Edit `provision/schema.json`
   ```json
   {
     "displayName": "New Field",
     "internalName": "cr015_newfield",
     "type": "Text",
     "addToDefaultView": true
   }
   ```

2. **WhatIf check**: Run provisioning with `whatIf: true`
3. **Apply**: Run provisioning with `whatIf: false`
4. **Update code**:
   - Add to `src/sharepoint/fields.ts`:
     ```typescript
     export const FIELD_MAP = {
       // ...
       NEW_FIELD: 'cr015_newfield',
     };
     ```
   - Add to TypeScript types
   - Update UI components as needed
5. **Test**: Create record with new field, verify persistence
6. **Deploy**: Standard deployment process

### Updating choice field options

1. **Update schema**: Edit `provision/schema.json`
   ```json
   {
     "displayName": "Service Type",
     "internalName": "cr013_servicetype",
     "type": "Choice",
     "choices": ["PersonalCare", "Recreation", "Medical", "NewType"],
     "choicesPolicy": "additive"
   }
   ```

2. **Apply**: Run provisioning (additive policy = no data loss)
3. **Update code**: Add new choice to enums/types if needed
4. **Test**: Verify new option appears in dropdowns
5. **Deploy**: Standard deployment process

**Note**: `choicesPolicy: "additive"` only adds missing choices, never removes. To remove a choice, manual SharePoint list settings adjustment required.

### Troubleshooting guide

#### Issue: Users cannot log in

**Symptoms**: Redirect loop, "Redirect URI mismatch" error

**Diagnosis:**
1. Check Azure AD app registration:
   - Redirect URIs configured correctly?
   - Format: `https://domain.com` (no trailing slash sometimes matters)
2. Check MSAL configuration in app:
   - `VITE_MSAL_CLIENT_ID` matches app registration?
   - `VITE_MSAL_REDIRECT_URI` matches or omitted (defaults to origin)?

**Resolution:**
- Update redirect URIs in Azure AD
- Or update config to match Azure AD
- Clear browser cache/cookies and retry

---

#### Issue: Data not loading from SharePoint

**Symptoms**: Infinite loading, "403 Forbidden" errors

**Diagnosis:**
1. Check API permissions:
   - App registration has `Sites.Read.All` or higher?
   - Admin consent granted?
2. Check user permissions:
   - User has read access to SharePoint lists?
   - Test with admin account to isolate
3. Check CORS:
   - SharePoint CORS settings (rare issue)

**Resolution:**
- Grant necessary permissions in Azure AD
- Assign user to appropriate SharePoint group
- Verify token acquisition in browser DevTools (Network tab)

---

#### Issue: Audit logs not syncing

**Symptoms**: "Pending Sync" badge persists, logs accumulate in LocalStorage

**Diagnosis:**
1. Check network connectivity
2. Check SharePoint API health
3. Check LocalStorage size (>5MB limit?)
4. Review Sentry for sync errors

**Resolution:**
- Manual sync: Click "Sync Now" button in Audit panel
- Export CSV as backup
- Clear old logs if LocalStorage full
- Investigate API errors and retry

---

#### Issue: Schedule conflicts not detecting correctly

**Symptoms**: Double-bookings allowed, no warnings shown

**Diagnosis:**
1. Check conflict detection code: `src/features/schedule/conflictChecker.ts`
2. Verify test data has overlapping times
3. Check timezone handling (all times in UTC internally?)

**Resolution:**
- Bug fix in conflict detection logic
- Add unit tests for specific scenario
- Deploy fix
- Manual review of recent schedules for actual conflicts

---

## Runbook links

- **SharePoint Provisioning**: `docs/provisioning.md`
- **Local Operation Mode**: `docs/local-mode.md`
- **Daily SOP**: `docs/local-mode-sop.md`
- **Go-Live Playbook**: `docs/go-live-playbook.md`
- **Operations Runbook**: `docs/operations-runbook.md`
- **POC Management Guide**: `docs/poc-management-guide.md`

## Health check endpoints

While this is a static SPA without traditional health endpoints, monitoring can verify:

1. **Application load**: Can `index.html` be fetched?
2. **Authentication**: Can MSAL acquire a token?
3. **SharePoint API**: Can a test GET request succeed?

**Manual health check:**
1. Navigate to app URL
2. Sign in
3. Navigate to Dashboard
4. Verify data loads
5. Create a test record (in test environment)
6. Verify audit log entry

**Automated health check (via Playwright):**
```typescript
test('health check', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="dashboard"]');
  await expect(page.getByText('Dashboard')).toBeVisible();
  // Verify critical data loads
  await expect(page.locator('.user-count')).not.toBeEmpty();
});
```

## Performance targets

| Metric | Target | Threshold |
|--------|--------|-----------|
| Lighthouse Performance | ≥97 | ≥95 (warn) |
| Lighthouse Accessibility | 100 | 100 (required) |
| First Contentful Paint | <1.5s | <2.0s |
| Largest Contentful Paint | <2.5s | <3.0s |
| Time to Interactive | <3.0s | <4.0s |
| Bundle size (main chunk) | <300KB | <500KB |
| Page load time (cached) | <500ms | <1s |
| API response time (p95) | <500ms | <1s |

## Scaling considerations

### Current scale
- **Users**: ~50-200 service recipients
- **Staff**: ~20-50 staff members
- **Records**: ~1000-5000 per month
- **Concurrent users**: ~10-30

### Scaling limits (SharePoint)
- **List items**: 30M per list (practically ~100K for performance)
- **View threshold**: 5000 items per view (indexed columns required)
- **API throttling**: ~600 requests/minute per user

### Scale-up strategies
1. **Pagination**: Implement for lists >100 items
2. **Indexing**: Add indexes on frequently queried columns
3. **Archival**: Move old records to archive lists (>1 year old)
4. **Caching**: Aggressive client-side caching with TanStack Query
5. **CDN**: Use CDN for static assets if external hosting

### Monitoring scale issues
- Watch for "List view threshold exceeded" errors
- Monitor API response times (>1s indicates need for optimization)
- Track bundle size growth (warn at 500KB)

## Related documentation

- [System Overview](01_overview.md) — High-level description
- [Architecture](02_architecture.md) — Component structure
- [Workflows](04_workflows.md) — User journeys
- [Security Model](06_security.md) — Security implementation
- [Provisioning Guide](../provisioning.md) — SharePoint schema management
- [Go-Live Playbook](../go-live-playbook.md) — Production launch procedures
