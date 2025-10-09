import React from 'react';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { useAuth } from '@/auth/useAuth';

const SignInButton: React.FC = () => {
	const { isAuthenticated, account, signIn, signOut } = useAuth();

	if (!isAuthenticated) {
		return (
			<Button
				color="inherit"
				variant="outlined"
				size="small"
				onClick={signIn}
				aria-label="サインイン"
			>
				サインイン
			</Button>
		);
	}

	const tooltip = account?.name || account?.username || 'Signed in';

	return (
		<Tooltip title={tooltip}>
			<Button
				color="inherit"
				variant="outlined"
				size="small"
				onClick={signOut}
				aria-label="サインアウト"
			>
				サインアウト
			</Button>
		</Tooltip>
	);
};

export default SignInButton;
