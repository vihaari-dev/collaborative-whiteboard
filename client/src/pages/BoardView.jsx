import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getBoard } from '../services/api';
import StandardBoard from './StandardBoard';
import DocumentBoard from './DocumentBoard';

const BoardView = () => {
    const { id } = useParams();
    const [boardMode, setBoardMode] = useState(null);

    useEffect(() => {
        const fetchMode = async () => {
            try {
                const { data } = await getBoard(id);
                setBoardMode(data.mode);
            } catch (error) {
                console.error("Failed to load board mode", error);
            }
        };
        fetchMode();
    }, [id]);

    if (!boardMode) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading Space...</div>;

    if (boardMode === 'document') {
        return <DocumentBoard boardId={id} />;
    }

    // Default to Standard (Solo / Collaboration)
    return <StandardBoard />;
};

export default BoardView;
