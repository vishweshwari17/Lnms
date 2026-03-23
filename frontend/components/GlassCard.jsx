function GlassCard({ children, className = "" }) {
  return (
    <div
      className={`bg-white/5 backdrop-blur-xl border border-white/10
      shadow-lg rounded-2xl p-6 transition-all ${className}`}
    >
      {children}
      
    </div>
  );
}

export default GlassCard;