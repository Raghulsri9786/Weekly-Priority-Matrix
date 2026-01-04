
import React, { useRef, useEffect } from 'react';

interface EditableCellProps {
  text: string;
  completed: boolean;
  onTextChange: (newText: string) => void;
  onToggleComplete: () => void;
  isReadOnly?: boolean;
  className?: string;
}

export const EditableCell: React.FC<EditableCellProps> = ({ 
  text, 
  completed,
  onTextChange, 
  onToggleComplete,
  isReadOnly = false,
  className = "" 
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current && contentRef.current.innerText !== text) {
      contentRef.current.innerText = text;
    }
  }, [text]);

  const handleInput = () => {
    if (contentRef.current) {
      onTextChange(contentRef.current.innerText);
    }
  };

  return (
    <div className={`relative group h-full min-h-[90px] transition-colors duration-200 border-r border-slate-200/50 last:border-r-0 ${
      completed ? 'bg-emerald-50' : text.trim() ? 'bg-rose-50/40' : 'bg-transparent'
    } ${className}`}>
      <div
        ref={contentRef}
        contentEditable={!isReadOnly}
        onInput={handleInput}
        spellCheck={false}
        className={`cell-content min-h-[90px] p-4 whitespace-pre-wrap outline-none break-words text-[12px] leading-relaxed cursor-text transition-all focus:bg-white/90 focus:shadow-inner ${
          completed ? 'text-emerald-800' : 'text-slate-600'
        } ${isReadOnly ? 'pointer-events-none' : ''}`}
      />
      
      {!isReadOnly && text.trim() && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete();
          }}
          className={`absolute top-2 right-2 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center transition-all z-10
            ${completed 
              ? 'bg-emerald-500 border-emerald-600 text-white opacity-100' 
              : 'bg-white border-slate-200 text-slate-300 opacity-0 group-hover:opacity-100 hover:border-emerald-500 hover:text-emerald-500'
            }
          `}
          title={completed ? 'Mark as Pending' : 'Mark as Completed'}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/>
          </svg>
        </button>
      )}
    </div>
  );
};
