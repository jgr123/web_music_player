import React, { useState } from 'react';
import { fakeAuth } from '../utils/auth';

const Login = ({ onLogin }) => {
    const [userId, setUserId] = useState('');

    const handleLogin = () => {
        fakeAuth.login(userId, () => {
            onLogin(userId);
        });
    };

    return (
        <div className="login">
            <input
                type="text"
                placeholder="Digite seu ID de usuário"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
            />
            <button onClick={handleLogin}>Entrar</button>
        </div>
    );
};

export default Login;