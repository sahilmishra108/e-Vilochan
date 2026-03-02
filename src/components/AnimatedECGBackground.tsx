import React from 'react';
import { motion } from 'framer-motion';

export const AnimatedECGBackground = () => {
    const width = 2000;
    const baseline = 50;
    let path = `M 0 ${baseline} `;
    let x = 0;

    while (x < width) {
        x += 40; path += `L ${x} ${baseline} `; // Isoelectric line
        x += 15; path += `L ${x} ${baseline - 5} `; // P wave 
        x += 15; path += `L ${x} ${baseline} `; // P wave end
        x += 15; path += `L ${x} ${baseline} `; // PR segment
        x += 8; path += `L ${x} ${baseline + 8} `; // Q wave
        x += 12; path += `L ${x} ${baseline - 45} `; // R wave peak
        x += 12; path += `L ${x} ${baseline + 15} `; // S wave dip
        x += 8; path += `L ${x} ${baseline} `; // S wave end
        x += 20; path += `L ${x} ${baseline} `; // ST segment
        x += 25; path += `L ${x} ${baseline - 10} `; // T wave peak
        x += 25; path += `L ${x} ${baseline} `; // T wave end
        x += 40; path += `L ${x} ${baseline} `; // TP segment
    }

    return (
        <div className="absolute inset-x-0 top-20 h-[60vh] z-0 overflow-hidden pointer-events-none opacity-[0.25] mix-blend-multiply">
            <svg
                className="w-full h-full"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 100`}
            >
                <motion.path
                    d={path}
                    fill="transparent"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{
                        duration: 8,
                        ease: "linear",
                        repeat: Infinity,
                    }}
                />
            </svg>
        </div>
    );
};
