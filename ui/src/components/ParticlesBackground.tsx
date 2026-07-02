import { motion } from 'framer-motion';

export default function ParticlesBackground() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: Math.random() * 10,
    duration: 8 + Math.random() * 12,
    size: 2 + Math.random() * 4,
    opacity: 0.2 + Math.random() * 0.5,
  }));

  return (
    <div className="particles-container">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.id % 3 === 0 
              ? 'rgba(139, 92, 246, 0.5)' 
              : p.id % 3 === 1 
                ? 'rgba(34, 211, 238, 0.4)' 
                : 'rgba(16, 185, 129, 0.3)',
            opacity: p.opacity,
          }}
          animate={{
            y: ['100vh', '-10vh'],
            x: [0, (Math.random() - 0.5) * 100],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}
