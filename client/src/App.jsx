import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, default as AuthContext } from './context/AuthContext';
import { useContext } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NewBoard from './pages/NewBoard';
import BoardView from './pages/BoardView';
import MemoryBoard from './pages/MemoryBoard';
import { useLocation } from 'react-router-dom';

// Redirects to /login if not authenticated
const PrivateRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  return user ? children : <Navigate to="/login" replace state={{ from: location }} />;
};

// Redirects logged-in users away from /login and /register
const PublicOnlyRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  return user ? <Navigate to="/" replace /> : children;
};

// Root: shared collab room (no auth needed) OR dashboard (if logged in) OR login
const RootRoute = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const hasRoom = queryParams.has('room');

  // ?room= param → join the shared collab session directly, no login required
  if (hasRoom) {
    return <MemoryBoard />;
  }

  // Logged in → go to Dashboard
  if (user) {
    return <Dashboard />;
  }

  // Not logged in → go to Login
  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <Register />
              </PublicOnlyRoute>
            }
          />

          <Route path="/" element={<RootRoute />} />

          <Route
            path="/new"
            element={
              <PrivateRoute>
                <NewBoard />
              </PrivateRoute>
            }
          />

          <Route
            path="/board/:id"
            element={
              <PrivateRoute>
                <BoardView />
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
