import { motion } from 'motion/react'

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F8FAFF]">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-mesh-gradient opacity-30 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-blue/5 rounded-full blur-3xl" />
      
      <div className="relative flex flex-col items-center">
        {/* Animated Logo Container */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ 
            scale: [0.8, 1.1, 1],
            opacity: 1,
            rotate: [0, 0, 10, -10, 0]
          }}
          transition={{ 
            duration: 1.5,
            ease: "easeOut",
            times: [0, 0.4, 0.6, 0.8, 1]
          }}
          className="relative mb-8"
        >
          {/* Outer Ring */}
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-4 border-2 border-dashed border-brand-blue/20 rounded-full"
          />
          
          {/* Inner Glow */}
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-brand-blue/20 blur-xl rounded-full"
          />

          {/* Main Logo Image */}
          <div className="relative w-32 h-32 bg-white rounded-3xl shadow-card-lg flex items-center justify-center border border-navy-100/50 overflow-hidden">
            <img 
              src="/logo.png" 
              alt="ThreatGuardAI Logo" 
              className="w-full h-full object-contain p-2"
              referrerPolicy="no-referrer"
            />
          </div>
        </motion.div>

        {/* Text Content */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-2 text-navy-400 text-sm font-medium">
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              Initializing secure environment
            </motion.span>
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ 
                    duration: 0.6, 
                    repeat: Infinity, 
                    delay: i * 0.1,
                    ease: "easeInOut" 
                  }}
                  className="w-1 h-1 bg-brand-blue rounded-full"
                />
              ))}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Bottom Status */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-12 text-[10px] uppercase tracking-[0.2em] text-navy-300 font-bold"
      >
        Enterprise Grade Intrusion Detection
      </motion.div>
    </div>
  )
}
