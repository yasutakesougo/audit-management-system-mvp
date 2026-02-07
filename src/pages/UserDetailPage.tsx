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
