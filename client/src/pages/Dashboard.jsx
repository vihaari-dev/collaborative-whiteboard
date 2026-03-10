import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBoards } from '../services/api';
import MainLayout from '../components/MainLayout';
import AuthContext from '../context/AuthContext';
import { Plus, Search, MoreHorizontal, Layout, FileText, Lock } from 'lucide-react';

const BoardCard = ({ board, onClick }) => (
    <div
        onClick={onClick}
        style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #E5E5E5',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '160px',
            position: 'relative'
        }}
        onMouseEnter={e => {
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            e.currentTarget.style.borderColor = '#D1D5DB';
        }}
        onMouseLeave={e => {
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.borderColor = '#E5E5E5';
        }}
    >
        <div style={{ position: 'absolute', top: '20px', right: '20px', color: '#999' }}>
            <MoreHorizontal size={16} />
        </div>

        <div>
            <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#666',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
            }}>
                {board.mode === 'solo' && <Lock size={12} />}
                {board.mode}
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1A1A1A' }}>{board.title}</h3>
            <p style={{ fontSize: '13px', color: '#999', marginTop: '8px' }}>
                Edited {new Date(board.updatedAt).toLocaleDateString()}
            </p>
        </div>

        <div style={{ display: 'flex', gap: '-8px' }}>
            {/* Avatars placeholder */}
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#E0E0E0', border: '2px solid white' }} />
        </div>
    </div>
);

const Dashboard = () => {
    const { user } = useContext(AuthContext);
    const [boards, setBoards] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchBoards = async () => {
            try {
                const { data } = await getBoards();
                setBoards(data);
            } catch (error) {
                console.error(error);
            }
        };
        fetchBoards();
    }, []);

    const collaborativeBoards = boards.filter(b => b.mode === 'collaboration');
    const soloBoards = boards.filter(b => b.mode === 'solo');
    const documentBoards = boards.filter(b => b.mode === 'document');

    return (
        <MainLayout>
            <div style={{ padding: '0 40px', overflowY: 'auto', height: '100%' }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    height: '100px',
                    borderBottom: '1px solid #F0F0F0',
                    marginBottom: '40px'
                }}>
                    <div>
                        <h1 style={{ fontSize: '24px', marginBottom: '4px' }}>Workspace</h1>
                        <p>Welcome back, {user.name}. Ready for deep work?</p>
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{
                            position: 'relative',
                            width: '300px'
                        }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#999' }} />
                            <input
                                type="text"
                                placeholder="Filter workspaces..."
                                style={{
                                    width: '100%',
                                    padding: '10px 10px 10px 36px',
                                    borderRadius: '8px',
                                    border: '1px solid #E5E5E5',
                                    outline: 'none',
                                    fontSize: '14px'
                                }}
                            />
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={() => navigate('/new')}
                        >
                            <Plus size={16} />
                            New Item
                        </button>
                    </div>
                </div>

                {/* Sections */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px' }}>

                    {/* Collaborative Column */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0066FF' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0066FF' }} />
                                Collaborative
                                <span style={{ color: '#999', fontSize: '12px', fontWeight: '400' }}>{collaborativeBoards.length}</span>
                            </h3>
                            <MoreHorizontal size={16} color="#999" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {collaborativeBoards.map(board => (
                                <BoardCard key={board._id} board={board} onClick={() => navigate(`/board/${board._id}`)} />
                            ))}
                            {collaborativeBoards.length === 0 && <p style={{ fontSize: '12px', color: '#ccc' }}>No active projects</p>}
                        </div>
                    </div>

                    {/* Solo Column */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8E55EA' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8E55EA' }} />
                                Solo
                                <span style={{ color: '#999', fontSize: '12px', fontWeight: '400' }}>{soloBoards.length}</span>
                            </h3>
                            <MoreHorizontal size={16} color="#999" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {soloBoards.map(board => (
                                <BoardCard key={board._id} board={board} onClick={() => navigate(`/board/${board._id}`)} />
                            ))}
                            <button
                                onClick={() => navigate('/new')}
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    borderRadius: '12px',
                                    border: '1px dashed #E5E5E5',
                                    background: 'transparent',
                                    color: '#999',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                <Plus size={14} /> New Board
                            </button>
                        </div>
                    </div>

                    {/* Document Column */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FF9500' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF9500' }} />
                                Documents
                                <span style={{ color: '#999', fontSize: '12px', fontWeight: '400' }}>{documentBoards.length}</span>
                            </h3>
                            <MoreHorizontal size={16} color="#999" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {documentBoards.map(board => (
                                <BoardCard key={board._id} board={board} onClick={() => navigate(`/board/${board._id}`)} />
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </MainLayout>
    );
};

export default Dashboard;
