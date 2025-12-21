# System Overview

This document describes what the Audit Management System does at a high level.

## What is this system?

The Audit Management System is a React-based Single Page Application (SPA) that provides comprehensive management and tracking capabilities for disability support services. It serves as a unified platform for:

- Recording and tracking daily support activities
- Managing user (service recipient) information and attendance
- Scheduling and resource allocation
- Compliance monitoring and audit trail management
- Meeting facilitation and handoff communication

## Primary user roles

### Staff (Support Workers)
- Record daily support activities and observations
- Track attendance and health observations
- Participate in handoff communication between shifts
- Access user support procedures and guidelines

### Managers/Administrators
- Review and analyze support records
- Manage schedules and resource allocation
- Monitor compliance requirements
- Access dashboards and reports
- Configure templates and procedures

### Nurses
- Record medication administration
- Track health observations
- Manage medical notes and observations

### Administrative Staff
- Manage user master data
- Configure system settings
- Export audit logs and reports

## Primary capabilities

### 1. User Management
- Maintain master list of service recipients (`Users_Master`)
- Track user details, contact information, and support requirements
- View individual user profiles and support history
- Monitor monthly usage and attendance patterns

### 2. Daily Recording
- Record support activities with timestamp precision
- Track attendance and presence
- Record health observations and vital signs
- Document medication administration (nursing module)
- Capture incident reports and special notes

### 3. Scheduling
- Create and manage service schedules
- Allocate staff, rooms, and vehicle resources
- Detect conflicts and suggest alternatives
- Track plan vs actual execution (PvsA)
- Support multiple calendar views (day, week, month)

### 4. Audit & Compliance
- Maintain comprehensive audit trail of all actions
- Export audit logs to CSV for external review
- Local storage persistence with batch synchronization
- Compliance checklist tracking

### 5. Meeting & Handoff Support
- Structured meeting guide with step-by-step checklists
- Handoff timeline for shift transitions
- Priority follow-up user tracking
- Briefing panels for quick status overview

### 6. Dashboard & Analytics
- Role-based dashboard views
- Activity summaries and KPIs
- Attendance and usage statistics
- Cross-module alerts and warnings

## Key constraints and assumptions

### Infrastructure
- **Backend**: Microsoft SharePoint Online as the primary data store
- **Authentication**: Azure AD (Entra ID) via MSAL
- **Offline Support**: LocalStorage for temporary audit log persistence with later synchronization
- **Browser Requirements**: Modern browsers with ES2020+ support

### Data model
- SharePoint Lists serve as the primary data storage mechanism
- Schema is externalized in `provision/schema.json` for infrastructure-as-code
- Field mappings centralized in `src/infra/sharepoint/fields.ts` to prevent hardcoding
- All SharePoint fields should be treated as nullable

### Operational constraints
- **Target Environment**: Local LAN operation mode for on-premise facility use
- **Device Support**: Tablet-first design (iPad primary target) with touch-friendly UI
- **Network**: Designed for occasional connectivity with offline-first capabilities
- **Backup**: Daily CSV export and SharePoint list backup (30+ day retention)

### Quality gates
- **Coverage**: Lines ≥70%, Functions ≥70%, Statements ≥70%, Branches ≥65%
- **Accessibility**: Lighthouse A11y score = 100
- **Performance**: Lighthouse Performance ≥97
- **Error Rate**: <0.1% per month

### Development constraints
- **TypeScript**: Strict mode enabled, avoid `any` types
- **React**: v18, functional components with hooks
- **State Management**: Custom hooks + `useSyncExternalStore` (demo mode) / TanStack Query (production)
- **UI Framework**: Material UI (MUI) v5
- **Testing**: Vitest for unit tests, Playwright for E2E

### Security constraints
- Data must remain within Microsoft 365 tenant and facility file server
- No data export outside LAN without explicit authorization
- MSAL configuration uses production tenant app registration
- Minimum necessary permissions principle

## System boundaries

### In scope
- Web-based SPA accessible via modern browsers
- SharePoint Online data storage and REST API integration
- Azure AD authentication and authorization
- Local audit log management with CSV export
- Responsive UI for tablets and desktop browsers

### Out of scope
- Native mobile applications (uses responsive web instead)
- Direct database access (all data through SharePoint)
- Real-time collaboration features (polling-based updates)
- Advanced reporting/BI (uses CSV export for external tools)
- Multi-tenancy (single organization deployment)

## Technology stack

### Frontend
- **Framework**: React 18 with TypeScript 5+
- **Build Tool**: Vite 5
- **UI Library**: Material UI (MUI) v5
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod validation
- **Date/Time**: date-fns + FullCalendar
- **Charts**: Recharts
- **Testing**: Vitest + Playwright + Testing Library

### Backend Integration
- **Data Storage**: SharePoint Online Lists
- **API**: SharePoint REST API
- **Authentication**: MSAL (@azure/msal-browser, @azure/msal-react)
- **Provisioning**: PnP.PowerShell via GitHub Actions

### Development Tools
- **Package Manager**: npm
- **Linting**: ESLint + TypeScript ESLint
- **Formatting**: Prettier
- **Git Hooks**: Husky
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry (error tracking)

## Deployment model

The application follows a hybrid deployment approach:

1. **Build**: Static SPA bundle generated via Vite
2. **Hosting**: Can be hosted on any static file server or SharePoint site
3. **Configuration**: Runtime environment variables via `/env.runtime.json` or inline script
4. **Provisioning**: SharePoint lists created/updated via GitHub Actions workflow
5. **Updates**: Blue-green style deployment with versioned releases

See `05_operations.md` for detailed deployment procedures.

## Related documentation

- [Architecture Details](02_architecture.md) — Component structure and data flow
- [Domain Model](03_domain.md) — Key entities and business rules
- [Workflows](04_workflows.md) — Common user journeys
- [Operations Guide](05_operations.md) — Deployment and maintenance
- [Security Model](06_security.md) — Authentication and authorization
