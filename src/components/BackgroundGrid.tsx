
import { useEffect, useRef } from "react";
import { motion, useAnimation, useInView } from "framer-motion";

export const BackgroundGrid = () => {
    return (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            {/* Base Gradient */}
            <div className="absolute inset-0 bg-slate-50/50" />

            {/* Animated Grid */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.5 }}
                className="absolute inset-0"
                style={{
                    backgroundImage: `
            linear-gradient(to right, rgba(148, 163, 184, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(148, 163, 184, 0.05) 1px, transparent 1px)
          `,
                    backgroundSize: "40px 40px",
                }}
            >
                <motion.div
                    animate={{
                        backgroundPosition: ["0px 0px", "40px 40px"],
                    }}
                    transition={{
                        repeat: Infinity,
                        duration: 20,
                        ease: "linear",
                    }}
                    className="absolute inset-0"
                    style={{
                        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.15) 1px, transparent 0)",
                        backgroundSize: "40px 40px",
                    }}
                />
            </motion.div>

            {/* Floating Medical Elements (Abstract) */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
                {[...Array(5)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute bg-blue-100/20 rounded-full blur-3xl"
                        initial={{
                            x: Math.random() * 100 + "%",
                            y: Math.random() * 100 + "%",
                            scale: Math.random() * 0.5 + 0.5,
                        }}
                        animate={{
                            x: [
                                Math.random() * 100 + "%",
                                Math.random() * 100 + "%",
                                Math.random() * 100 + "%",
                            ],
                            y: [
                                Math.random() * 100 + "%",
                                Math.random() * 100 + "%",
                                Math.random() * 100 + "%",
                            ],
                        }}
                        transition={{
                            duration: Math.random() * 20 + 20,
                            repeat: Infinity,
                            ease: "linear",
                        }}
                        style={{
                            width: `${Math.random() * 400 + 200}px`,
                            height: `${Math.random() * 400 + 200}px`,
                        }}
                    />
                ))}
            </div>

            {/* Vignette for depth */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(255,255,255,0.8)_100%)]" />
        </div>
    );
};
