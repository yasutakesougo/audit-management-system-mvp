/**
 * UserDetailPage — Deep-link redirect to the users list view.
 *
 * ## Design Decision
 * Users module uses a **list-integrated UI** pattern:
 * - `/users?tab=list&selected=:userId` is the **canonical** URL for viewing a user.
 * - `/users/:userId` is **NOT canonical** — it exists ONLY as a deep-link entry point.
 * - It normalizes the URL by redirecting to the list with the `selected` param.
 *
 * ## Benefits of this approach
 * - Single source of truth: selection state lives in UsersList + useUsersPanel.
 * - No state duplication between a "list page" and "detail page".
 * - Right pane (embedded variant) and list stay in sync automatically.
 * - Full editing is handled via dialog (onEdit), not a separate route.
 *
 * ## URL Parameter: `selected`
 * - Value: `user.UserID` (e.g., "U-001") if available, otherwise `String(user.Id)`.
 * - Resolved by `resolveUserIdentifier()` in UserDetailSections/helpers.tsx.
 * - ⚠️ Caveat: "U-001" and "123" can both appear as selected values.
 *   Future evolution: consider splitting to `selectedUserId` / `selectedSpId`.
 */
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const UserDetailPage: React.FC = () => {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (userId) {
      navigate(`/users?tab=list&selected=${encodeURIComponent(userId)}`, { replace: true });
    } else {
      navigate('/users', { replace: true });
    }
  }, [navigate, userId]);

  return null;
};

export default UserDetailPage;
