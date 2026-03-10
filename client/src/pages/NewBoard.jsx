import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBoard } from '../services/api';
import { MousePointer2, FileText, User } from 'lucide-react';
import MainLayout from '../components/MainLayout';

const ModeCard = ({ icon: Icon, title, description, onClick }) => (
    <div
        onClick={onClick}
        style={{
            background: 'white',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            padding: '40px 30px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            width: '300px',
            height: '320px',
            gap: '20px'
        }}
        onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
            e.currentTarget.style.borderColor = 'var(--color-primary)';
        }}
        onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.borderColor = 'var(--color-border)';
        }}
    >
        <div style={{
            width: '64px',
            height: '64px',
            background: '#F5F5F7',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1A1A1A'
        }}>
            <Icon size={32} />
        </div>
        <div>
            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>{title}</h3>
            <p style={{ fontSize: '14px', color: '#666' }}>{description}</p>
        </div>
    </div>
);

const NewBoard = () => {
    const navigate = useNavigate();
    const [title, setTitle] = useState('');

    const handleCreate = async (mode) => {
        const boardTitle = title || 'Untitled Project';
        try {
            const { data } = await createBoard({ title: boardTitle, mode });
            navigate(`/board/${data._id}`);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <MainLayout>
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                background: 'white' // Or grid bg
            }} className="grid-bg">

                <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                    <h1 style={{ fontSize: '36px', marginBottom: '12px' }}>Select Workspace Mode</h1>
                    <p style={{ fontSize: '16px' }}>Where would you like to think today?</p>
                </div>

                <div style={{ marginBottom: '40px' }}>
                    <input
                        type="text"
                        placeholder="Project Name (Optional)"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        style={{
                            padding: '12px 20px',
                            fontSize: '16px',
                            borderRadius: '8px',
                            border: '1px solid #E5E5E5',
                            width: '300px',
                            textAlign: 'center',
                            outline: 'none'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <ModeCard
                        icon={MousePointer2}
                        title="Collaborative Canvas"
                        description="Multiplayer whiteboard for real-time team synchronization."
                        onClick={() => handleCreate('collaboration')}
                    />
                    <ModeCard
                        icon={FileText}
                        title="Document Notes"
                        description="Linear writing environment with canvas for structured thought."
                        onClick={() => handleCreate('document')}
                    />
                    <ModeCard
                        icon={User}
                        title="Solo Canvas"
                        description="Private infinite canvas for deep focus work."
                        onClick={() => handleCreate('solo')}
                    />
                </div>

                <div style={{ marginTop: '60px', color: '#999', fontSize: '12px' }}>
                    Press <kbd style={{ background: '#eee', padding: '2px 6px', borderRadius: '4px' }}>M</kbd> to toggle mode menu at any time
                </div>

            </div>
        </MainLayout>
    );
};

export default NewBoard;
