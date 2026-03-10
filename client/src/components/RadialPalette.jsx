import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Copic-ish Color Data Structure
const COLOR_RINGS = [
    // Ring 0: Inner Grays
    [
        '#FFFFFF', '#F2F2F2', '#E5E5E5', '#D9D9D9', '#CCCCCC', '#BFBFBF', '#B3B3B3', '#999999',
        '#808080', '#666666', '#4D4D4D', '#333333', '#1A1A1A', '#000000'
    ],
    // Ring 1: Vibrant / Core
    [
        '#FF0000', '#FF4D00', '#FF9900', '#FFCC00', '#FFFF00', '#CCFF00', '#66FF00', '#00FF00',
        '#00FF66', '#00FFCC', '#00FFFF', '#00CCFF', '#0099FF', '#0000FF', '#6600FF', '#CC00FF', '#FF00CC'
    ],
    // Ring 2: Pastels / Tints
    [
        '#FFCCCC', '#FFDBCC', '#FFEBCC', '#FFF5CC', '#FFFFCC', '#F5FFCC', '#EBFFCC', '#DBFFCC',
        '#CCFFDB', '#CCFFEB', '#CCFFFF', '#CCEBFF', '#CCDBFF', '#CCCCFF', '#DBCCFF', '#EBCCFF'
    ],
    // Ring 3: Deep / Shades
    [
        '#800000', '#802600', '#804D00', '#806600', '#808000', '#668000', '#338000', '#008000',
        '#008033', '#008066', '#008080', '#006680', '#004D80', '#000080', '#330080', '#660080'
    ]
];

export const RadialPalette = ({ activeColor, onChange, onClose }) => {
    const [rotation, setRotation] = useState(0);
    const wheelRef = useRef(null);

    // Geometry
    const innerRadius = 50;
    const ringThickness = 32;
    const gap = 2;

    const handleWheel = (e) => {
        // e.stopPropagation(); // Let it bubble if we want weird behavior? No, we want to capture it.
        // Actually, preventing default is good to stop page scroll, though overlay prevents that too.
        // e.preventDefault(); 
        const delta = e.deltaY;
        setRotation(prev => prev - delta * 0.2);
    };

    // Attach wheel listener to the entire overlay
    useEffect(() => {
        const handleGlobalWheel = (e) => {
            e.preventDefault();
            const delta = e.deltaY;
            setRotation(prev => prev - delta * 0.2);
        };

        window.addEventListener('wheel', handleGlobalWheel, { passive: false });
        // Also capture keyboard?
        return () => window.removeEventListener('wheel', handleGlobalWheel);
    }, []);

    const renderRing = (colors, ringIndex) => {
        const count = colors.length;
        const radius = innerRadius + (ringIndex * (ringThickness + gap));
        const angleStep = 360 / Math.max(count, 12);

        return colors.map((color, i) => {
            const angle = i * angleStep;
            // -90 deg is top visual
            const rad = (angle * Math.PI) / 180;
            const x = Math.cos(rad - Math.PI / 2) * radius;
            const y = Math.sin(rad - Math.PI / 2) * radius;
            const isActive = activeColor === color;

            return (
                <motion.div
                    key={`${ringIndex}-${i}-${color}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onChange(color); // This will trigger close in parent
                    }}
                    whileHover={{ scale: 1.2, zIndex: 100, boxShadow: '0 0 10px rgba(0,0,0,0.3)' }}
                    style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: `${ringThickness}px`,
                        height: `${ringThickness * 0.8}px`,
                        backgroundColor: color,
                        // We translate to position, then rotate to align tangent
                        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${angle}deg)`,
                        border: isActive ? '2px solid white' : '1px solid rgba(0,0,0,0.1)',
                        boxShadow: isActive ? '0 0 0 2px #0066FF' : 'none',
                        zIndex: ringIndex,
                        cursor: 'pointer',
                        borderRadius: '4px'
                    }}
                />
            );
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: 'rgba(0, 0, 0, 0.4)', // Dimmed background
                backdropFilter: 'blur(2px)', // Optional blur
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'default' // Or none?
            }}
            onClick={onClose} // Modal dismiss on backdrop click
        >
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                style={{
                    position: 'relative',
                    width: '400px',
                    height: '400px',
                    pointerEvents: 'none' // Inner container logic
                }}
            >
                {/* Center Preview */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'white',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 200,
                    pointerEvents: 'auto'
                }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: activeColor }} />
                </div>

                {/* Rotating Container */}
                <motion.div
                    animate={{ rotate: rotation }}
                    transition={{ type: 'spring', stiffness: 100, damping: 20, mass: 0.5 }} // Smooth momentum feel
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: 0,
                        height: 0,
                        pointerEvents: 'auto'
                    }}
                >
                    {COLOR_RINGS.map((ringColors, i) => (
                        <div key={i}>
                            {renderRing(ringColors, i)}
                        </div>
                    ))}
                </motion.div>

                {/* Top Indicator */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    // Move up by outer radius approx (50 + 4*34 = ~186)
                    transform: 'translate(-50%, -190px)',
                    width: 0,
                    height: 0,
                    borderLeft: '8px solid transparent',
                    borderRight: '8px solid transparent',
                    borderTop: '12px solid white',
                    filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))',
                    zIndex: 200
                }} />

            </motion.div>
        </motion.div>
    );
};
