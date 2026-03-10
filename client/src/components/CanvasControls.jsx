import { useState } from 'react';
import { Settings, Palette, Grid, Check } from 'lucide-react';
import '../styles/grids.css';

// --- Radial Color Picker (Simplified High-Fidelity) ---
const COLORS = [
    '#000000', '#4A4A4A', '#808080', '#C0C0C0', '#FFFFFF', // Greyscale
    '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55' // Colors
];

export const RadialColorPicker = ({ activeColor, onChange }) => {
    // In a real robust app, this would be a calculated SVG/Canvas wheel. 
    // Here we implement a beautiful circular selector grid.

    return (
        <div style={{
            padding: '16px',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            width: '240px'
        }}>
            <h4 style={{ fontSize: '12px', color: '#999', marginBottom: '12px', textTransform: 'uppercase' }}>Color Palette</h4>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '8px'
            }}>
                {COLORS.map(c => (
                    <button
                        key={c}
                        onClick={() => onChange(c)}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: c,
                            border: activeColor === c ? '2px solid white' : '1px solid rgba(0,0,0,0.1)',
                            boxShadow: activeColor === c ? '0 0 0 2px #0066FF' : 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'transform 0.1s'
                        }}
                    >
                        {activeColor === c && <Check size={14} color={c === '#FFFFFF' ? 'black' : 'white'} />}
                    </button>
                ))}
            </div>
        </div>
    );
};

// --- Canvas Background Settings ---
const GRID_OPTIONS = [
    { id: 'none', label: 'No Grid', class: '' },
    { id: 'dot', label: 'Dot Grid', class: 'bg-grid-dot' },
    { id: 'graph', label: 'Graph', class: 'bg-grid-graph' },
    { id: 'line', label: 'Lined', class: 'bg-grid-line' }
];

const THEME_OPTIONS = [
    { id: 'standard', label: 'Standard', color: '#ffffff' },
    { id: 'darkprint', label: 'Darkprint', color: '#1a1b1e' },
    { id: 'blueprint', label: 'Blueprint', color: '#0066cc' },
    { id: 'brown', label: 'Brown Paper', color: '#d2b48c' }
];

export const CanvasSettings = ({ activeGrid, onGridChange, activeTheme, onThemeChange }) => {
    return (
        <div style={{
            padding: '16px',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            width: '280px'
        }}>
            <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '12px', color: '#999', marginBottom: '12px', textTransform: 'uppercase' }}>Grid Type</h4>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {GRID_OPTIONS.map(grid => (
                        <div
                            key={grid.id}
                            onClick={() => onGridChange(grid.id)}
                            style={{
                                flexShrink: 0,
                                width: '60px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer'
                            }}
                        >
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                border: activeGrid === grid.id ? '2px solid #0066FF' : '1px solid #E5E5E5',
                                background: '#f5f5f7', // Preview placeholder
                                // We could actually show the grid pattern inside
                            }} className={`${grid.class} theme-standard`} />
                            <span style={{ fontSize: '10px', color: activeGrid === grid.id ? '#0066FF' : '#666' }}>{grid.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h4 style={{ fontSize: '12px', color: '#999', marginBottom: '12px', textTransform: 'uppercase' }}>Theme</h4>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {THEME_OPTIONS.map(theme => (
                        <button
                            key={theme.id}
                            onClick={() => onThemeChange(theme.id)}
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: theme.color,
                                border: activeTheme === theme.id ? '2px solid white' : '1px solid rgba(0,0,0,0.1)',
                                boxShadow: activeTheme === theme.id ? '0 0 0 2px #0066FF' : 'none',
                                cursor: 'pointer'
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
