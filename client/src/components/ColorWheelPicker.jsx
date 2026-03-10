import React, { useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { COPIC_FAMILIES } from '../utils/copicColors';

export const ColorWheelPicker = ({ activeColor, onChange, onClose }) => {
    const panelRef = useRef(null);

    // --- Click Outside Logic ---
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (panelRef.current && !panelRef.current.contains(event.target)) {
                onClose();
            }
        };
        // Use mousedown to capture quickly, before click triggers other UI
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    // --- Data Prep ---
    const FAMILY_ORDER = [
        'BV', 'V', 'RV', 'R', 'YR', 'Y', 'YG', 'G', 'BG', 'B', 'E',
        'C', 'W', 'N', 'T', 'F', '0', '100'
    ];

    const sortedFamilies = useMemo(() => {
        const keys = Object.keys(COPIC_FAMILIES);
        const ordered = FAMILY_ORDER.filter(k => keys.includes(k));
        const others = keys.filter(k => !FAMILY_ORDER.includes(k));
        return [...ordered, ...others];
    }, []);

    const getContrastColor = (hexColor) => {
        if (!hexColor || hexColor === 'transparent') return 'black';
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? 'black' : 'white';
    };

    return (
        <AnimatePresence>
            <motion.div
                ref={panelRef}
                initial={{ y: 50, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 50, opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                style={{
                    position: 'fixed',
                    bottom: '24px',          // Floating at bottom
                    left: '50%',
                    x: '-50%',               // Center horizontally
                    zIndex: 2000,
                    backgroundColor: 'rgba(25, 25, 25, 0.85)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '8px',
                    maxWidth: '96vw',        // Max width constrained
                    maxHeight: '40vh',       // Keep it reasonably short
                    overflowX: 'auto',       // Scroll horizontally
                    overflowY: 'hidden',
                    pointerEvents: 'auto',   // Self maps events
                    // No full screen overlay wrapper!
                }}
            >
                {sortedFamilies.map(family => {
                    const colors = COPIC_FAMILIES[family];
                    return (
                        <div
                            key={family}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                minWidth: '36px'
                            }}
                        >
                            {/* Simple Header */}
                            <div style={{
                                color: 'rgba(255,255,255,0.4)',
                                fontSize: '9px',
                                fontWeight: '700',
                                textAlign: 'center',
                                marginBottom: '2px',
                                fontFamily: 'Inter, sans-serif'
                            }}>
                                {family}
                            </div>

                            {/* Color Column */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3px',
                                overflowY: 'auto',
                                paddingBottom: '4px',
                                scrollbarWidth: 'none',
                                alignItems: 'center'
                            }}>
                                {colors.map(color => {
                                    const isActive = activeColor === color.hex;
                                    const textColor = getContrastColor(color.hex);

                                    return (
                                        <button
                                            key={color.code}
                                            onClick={() => {
                                                onChange(color.hex);
                                                // Auto-close on selection for speed, as requested ("continue to write")
                                                onClose();
                                            }}
                                            style={{
                                                width: '36px',
                                                height: '24px',
                                                borderRadius: '4px',
                                                border: isActive ? '2px solid white' : 'none',
                                                backgroundColor: color.hex,
                                                color: textColor,
                                                fontSize: '8px',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                outline: 'none',
                                                marginBottom: '1px',
                                                fontFamily: 'Inter, sans-serif',
                                                transition: 'transform 0.1s'
                                            }}
                                            onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
                                            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                                        >
                                            {color.code}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </motion.div>
        </AnimatePresence>
    );
};
