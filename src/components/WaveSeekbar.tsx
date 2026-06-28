import { useCallback, useEffect, useRef, useState } from 'react';

interface SeekbarProps {
  progress: number;
  buffered: number;
  duration: number;
  onSeek: (ratio: number) => void;
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

export default function WaveSeekbar({ progress, buffered, duration, onSeek }: SeekbarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [hoverRatio, setHoverRatio] = useState(0);
  const [localProgress, setLocalProgress] = useState(progress);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      setContainerW(entries[0].contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!dragging) setLocalProgress(progress);
  }, [progress, dragging]);

  const getRatio = useCallback((clientX: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const r = getRatio(e.clientX);
    setDragging(true);
    setLocalProgress(r);
    onSeek(r);
  }, [getRatio, onSeek]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const r = getRatio(e.clientX);
    setHoverRatio(r);
    if (dragging) {
      setLocalProgress(r);
      onSeek(r);
    }
  }, [dragging, getRatio, onSeek]);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      e.preventDefault();
      const r = getRatio(e.clientX);
      setLocalProgress(r);
      onSeek(r);
    };
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging, getRatio, onSeek]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const r = getRatio(e.touches[0].clientX);
    setDragging(true);
    setLocalProgress(r);
    onSeek(r);
  }, [getRatio, onSeek]);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: TouchEvent) => {
      e.preventDefault();
      const r = getRatio(e.touches[0].clientX);
      setLocalProgress(r);
      onSeek(r);
    };
    const up = () => setDragging(false);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, [dragging, getRatio, onSeek]);

  const H = 28;
  const CY = H / 2;
  const AMP = 4.5;
  const PERIOD = 36;
  const SW = 2.5;
  const playedPx = localProgress * containerW;
  const bufferedPx = buffered * containerW;
  const hoverPx = hoverRatio * containerW;
  const thumbBaseR = 5;
  const thumbScale = dragging ? 1.7 : hovering ? 1.4 : 1;

  let wavePath = '';
  if (containerW > 0 && playedPx < containerW) {
    wavePath = `M ${playedPx} ${CY}`;
    for (let x = playedPx; x <= containerW; x += 2.5) {
      const y = CY + AMP * Math.sin((x / PERIOD) * Math.PI * 2);
      wavePath += ` L ${x.toFixed(1)} ${y.toFixed(2)}`;
    }
  }

  let bufferWavePath = '';
  if (containerW > 0 && bufferedPx > playedPx + 2) {
    bufferWavePath = `M ${playedPx} ${CY}`;
    for (let x = playedPx; x <= bufferedPx; x += 2.5) {
      const y = CY + AMP * Math.sin((x / PERIOD) * Math.PI * 2);
      bufferWavePath += ` L ${x.toFixed(1)} ${y.toFixed(2)}`;
    }
  }

  const active = dragging || hovering;

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height: 36, cursor: 'pointer', touchAction: 'none' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onTouchStart={handleTouchStart}
    >
      {containerW > 0 && (
        <svg
          width={containerW}
          height={H}
          style={{ position: 'absolute', top: '50%', left: 0, transform: 'translateY(-50%)', overflow: 'visible' }}
        >
          {bufferWavePath && (
            <path
              d={bufferWavePath}
              fill="none"
              stroke="rgba(255,255,255,0.32)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {wavePath && (
            <path
              d={wavePath}
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {hovering && !dragging && hoverPx > playedPx && (
            <line
              x1={playedPx}
              y1={CY}
              x2={hoverPx}
              y2={CY}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={SW}
              strokeLinecap="round"
            />
          )}
          {playedPx > 0 && (
            <line
              x1={0}
              y1={CY}
              x2={playedPx}
              y2={CY}
              stroke="var(--md-sys-color-primary)"
              strokeWidth={active ? SW + 0.5 : SW}
              strokeLinecap="round"
              style={{
                filter: active ? 'drop-shadow(0 0 4px rgba(61,217,224,0.55))' : 'none',
                transition: 'stroke-width 0.15s',
              }}
            />
          )}
          {active && (
            <circle
              cx={playedPx}
              cy={CY}
              r={thumbBaseR * thumbScale + 6}
              fill="rgba(61,217,224,0.10)"
            />
          )}
          <circle
            cx={playedPx}
            cy={CY}
            r={thumbBaseR}
            fill="var(--md-sys-color-primary)"
            stroke="rgba(10,12,20,0.85)"
            strokeWidth={1.5}
            style={{
              transformOrigin: `${playedPx}px ${CY}px`,
              transform: `scale(${thumbScale})`,
              filter: active ? 'drop-shadow(0 0 5px rgba(61,217,224,0.7))' : 'none',
              transition: 'transform 0.12s cubic-bezier(0.4,0,0.2,1), filter 0.15s',
            }}
          />
        </svg>
      )}
      {hovering && containerW > 0 && (
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: 'calc(100% + 8px)',
            left: `${hoverRatio * 100}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="bg-black/80 border border-white/10 text-white text-[11px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap backdrop-blur-sm">
            {formatTime(hoverRatio * duration)}
          </div>
        </div>
      )}
    </div>
  );
}
