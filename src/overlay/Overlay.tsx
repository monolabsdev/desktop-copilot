export function Overlay() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-transparent m-0 p-0 overflow-hidden">
      <div className="backdrop-blur-md bg-black/40 rounded-xl p-4 w-96">
        <input
          autoFocus
          placeholder="Ask anything…"
          className="w-full bg-transparent outline-none border-none text-white placeholder-white/50 focus:outline-none focus:ring-0"
        />
      </div>
    </div>
  );
}
