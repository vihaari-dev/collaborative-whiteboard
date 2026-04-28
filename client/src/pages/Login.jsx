import { useState, useContext } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();

    const queryParams = new URLSearchParams(location.search);
    const redirectParam = queryParams.get('redirect');
    const fromState = location.state?.from?.pathname ? (location.state.from.pathname + (location.state.from.search || '')) : null;
    const from = redirectParam || fromState || '/';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login({ email, password });
            navigate(from, { replace: true });
        } catch (err) {
            const msg = err?.response?.data?.message || 'Login failed. Please try again.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '80px auto', padding: '0 16px' }}>
            <h2>Login</h2>
            {error && (
                <p style={{ color: '#c0392b', background: '#fdecea', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>
                    {error}
                </p>
            )}
            <form onSubmit={handleSubmit}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ display: 'block', width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box' }}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ display: 'block', width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box' }}
                />
                <button type="submit" disabled={loading} style={{ padding: '10px 20px' }}>
                    {loading ? 'Logging in...' : 'Login'}
                </button>
            </form>
            <p>
                Don't have an account? <Link to="/register">Register</Link>
            </p>
        </div>
    );
};

export default Login;
