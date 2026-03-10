import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutGrid,
    FileText,
    Settings,
    LogOut,
    Plus,
    Search,
    Home
} from 'lucide-react';
import { useContext } from 'react';
import AuthContext from '../context/AuthContext';

const SidebarItem = ({ icon: Icon, active, onClick, tooltip }) => (
    <div
        onClick={onClick}
        title={tooltip}
        style={{
            padding: '12px',
            borderRadius: '12px',
            marginBottom: '8px',
            cursor: 'pointer',
            backgroundColor: active ? '#EBF5FF' : 'transparent',
            color: active ? '#0066FF' : '#666',
            transition: 'all 0.2s'
        }}
    >
        <Icon size={24} strokeWidth={active ? 2.5 : 2} />
    </div>
);

const MainLayout = ({ children }) => {
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div style={{ marginBottom: '40px' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        background: '#0066FF',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '20px'
                    }}>
                        DW
                    </div>
                </div>

                <SidebarItem
                    icon={Home}
                    active={location.pathname === '/'}
                    onClick={() => navigate('/')}
                    tooltip="Home"
                />

                <SidebarItem
                    icon={LayoutGrid}
                    active={location.pathname === '/boards'} // Future expanded route
                    onClick={() => navigate('/')}
                    tooltip="Boards"
                />

                <SidebarItem
                    icon={FileText}
                    onClick={() => { }}
                    tooltip="Documents"
                />

                <div style={{ flex: 1 }} />

                <SidebarItem
                    icon={Settings}
                    onClick={() => { }}
                    tooltip="Settings"
                />

                <SidebarItem
                    icon={LogOut}
                    onClick={logout}
                    tooltip="Logout"
                />
            </aside>
            <main className="main-content">
                {children}
            </main>
        </div>
    );
};

export default MainLayout;
