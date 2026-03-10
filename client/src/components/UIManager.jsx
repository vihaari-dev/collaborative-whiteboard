import React from 'react';

const UIManager = ({ children }) => {
    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none', // Allow clicks to pass through to canvas where there are no UI elements
            zIndex: 10,
            overflow: 'hidden'
        }}>
            {/* 
                All direct children of UIManager must have pointerEvents: 'auto' 
                to be clickable.
            */}
            {children}
        </div>
    );
};

export default UIManager;
