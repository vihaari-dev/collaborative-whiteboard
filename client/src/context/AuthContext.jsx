import { createContext, useState, useEffect } from 'react';
import { login as loginApi, register as registerApi } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem('user');
        return storedUser ? JSON.parse(storedUser) : null;
    });

    const login = async (formData) => {
        const { data } = await loginApi(formData);
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
    };

    const register = async (formData) => {
        const { data } = await registerApi(formData);
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
