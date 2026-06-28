import { useState, useEffect, useRef } from 'react';

export type SortOption = 'POPULARITY_DESC' | 'POPULARITY' | 'SCORE_DESC' | 'SCORE' | 'TITLE_ENGLISH' | 'TITLE_ENGLISH_DESC';

type BaseSort = 'POPULARITY' | 'SCORE' | 'TITLE_ENGLISH';

const BASE_SORTS: BaseSort[] = ['POPULARITY', 'SCORE', 'TITLE_ENGLISH'];

const SORT_LABELS: Record<BaseSort, string> = {
  POPULARITY: 'Popular',
  SCORE: 'Rate',
  TITLE_ENGLISH: 'Name',
};

interface FilterSortModalProps {
  currentSeason: string;
  currentYear: number;
  currentSort: SortOption;
  seasons: string[];
  years: number[];
  onApply: (season: string, year: number, sort: SortOption) => void;
}

export default function FilterSortModal({
  currentSeason,
  currentYear,
  currentSort,
  seasons,
  years,
  onApply,
}: FilterSortModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Local state for the modal, initialized from current props when opened
  const [tempSeason, setTempSeason] = useState(currentSeason);
  const [tempYear, setTempYear] = useState(currentYear);
  const [tempSort, setTempSort] = useState(currentSort);

  // Touch drag state
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const currentDragY = useRef(0);

  const filteredYears = years.filter(y => y >= 2020);

  useEffect(() => {
    if (isOpen) {
      setTempSeason(currentSeason);
      setTempYear(currentYear);
      setTempSort(currentSort);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, currentSeason, currentYear, currentSort]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 200);
  };

  const handleApply = () => {
    onApply(tempSeason, tempYear, tempSort);
    handleClose();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - dragStartY.current;
    if (diff > 0) { // Only allow dragging down
      currentDragY.current = diff;
      setDragY(diff);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (currentDragY.current > 100) {
      handleClose();
    } else {
      setDragY(0);
    }
    currentDragY.current = 0;
  };



  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center w-10 h-10 rounded-full text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)] hover:text-[var(--md-sys-color-primary)] transition-all"
        aria-label="Filter and Sort"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      </button>

      {(isOpen || isClosing) && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Filter and sort">
          {/* Backdrop */}
          <div 
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'}`} 
            onClick={handleClose} 
          />
          
          {/* Bottom Sheet */}
          <div 
            className={`relative w-full sm:w-[480px] max-h-[60vh] flex flex-col bg-[var(--md-sys-color-surface-container-high)] sm:rounded-2xl rounded-t-3xl shadow-2xl ${isDragging ? '' : 'transition-transform duration-200 ease-[cubic-bezier(0.175,0.885,0.32,1)]'} ${isClosing ? 'translate-y-full sm:translate-y-8 sm:scale-95' : 'translate-y-0 sm:scale-100'}`}
            style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }}
          >
            {/* Drag Handle */}
            <div 
              className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing sm:hidden"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-12 h-1.5 rounded-full bg-white/20"></div>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4 pt-2 sm:pt-6 border-b border-white/5 shrink-0">
              <h3 className="font-bold text-xl text-[var(--md-sys-color-on-surface)]">Filter & Sort</h3>
              <button 
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-[var(--md-sys-color-on-surface-variant)] transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="overflow-y-auto p-6 scrollbar-hide flex flex-col gap-8">
              
              {/* Season Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Season</h4>
                <div className="grid grid-cols-2 gap-2">
                  {seasons.map(s => (
                    <button
                      key={s}
                      onClick={() => setTempSeason(s)}
                      className={`px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 border border-transparent ${
                        tempSeason === s
                          ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-md shadow-[var(--md-sys-color-primary)]/20'
                          : 'bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)] hover:border-[var(--md-sys-color-primary)]/30'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Year Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Year</h4>
                <div className="flex flex-wrap gap-2">
                  {filteredYears.map(y => (
                    <button
                      key={y}
                      onClick={() => setTempYear(y)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 border border-transparent ${
                        tempYear === y
                          ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-md shadow-[var(--md-sys-color-primary)]/20'
                          : 'bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)] hover:border-[var(--md-sys-color-primary)]/30'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort Section */}
              <div className="space-y-3 pb-4">
                <h4 className="text-sm font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Sort By</h4>
                <div className="flex flex-col gap-2">
                  {BASE_SORTS.map(baseKey => {
                    const isActive = tempSort.startsWith(baseKey);
                    // Default behavior: POPULARITY and SCORE default to DESC (down arrow). TITLE defaults to ASC (up arrow).
                    const isDefaultDesc = baseKey !== 'TITLE_ENGLISH';
                    const isDesc = isActive ? tempSort.endsWith('_DESC') : isDefaultDesc;
                    
                    const handleClick = () => {
                      if (isActive) {
                        // Toggle direction
                        const newSort = isDesc ? baseKey : `${baseKey}_DESC`;
                        setTempSort(newSort as SortOption);
                      } else {
                        // Activate with default direction
                        const newSort = isDefaultDesc ? `${baseKey}_DESC` : baseKey;
                        setTempSort(newSort as SortOption);
                      }
                    };

                    return (
                      <button
                        key={baseKey}
                        onClick={handleClick}
                        className={`flex items-center justify-between px-4 py-3.5 rounded-xl text-left font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-[var(--md-sys-color-primary)]/15 text-[var(--md-sys-color-primary)] ring-1 ring-[var(--md-sys-color-primary)]'
                            : 'bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-variant)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {SORT_LABELS[baseKey]}
                          {isActive && (
                            <svg 
                              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                              className={`transition-transform duration-300 ${!isDesc ? 'rotate-180' : ''}`}
                            >
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <polyline points="19 12 12 19 5 12" />
                            </svg>
                          )}
                        </div>
                        {isActive && (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/5 bg-[var(--md-sys-color-surface-container-high)] sm:rounded-b-2xl shrink-0 pb-safe">
              <button
                onClick={handleApply}
                className="w-full py-4 rounded-xl bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-bold text-[15px] uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-[var(--md-sys-color-primary)]/20"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
