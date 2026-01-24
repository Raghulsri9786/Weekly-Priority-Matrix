
import React, { useRef, useEffect } from 'react';

interface EditableCellProps {
  text: string;
  completed: boolean;
  onTextChange: (newText: string) => void;
  onToggleComplete: () => void;
  isReadOnly?: boolean;
}

export const EditableCell: React.FC<EditableCellProps> = ({ 
  text, 
  completed,
  onTextChange, 
  onToggleComplete,
  isReadOnly = false
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current && contentRef.current.innerText !== text) {
      contentRef.current.innerText = text;
    }
  }, [text]);

  return (
    <div className={`relative h-full min-h-[120px] transition-all duration-300 ${
      completed 
        ? 'bg-emerald-100' 
        : text.trim() 
          ? 'bg-rose-100' 
          : 'bg-transparent'
    }`}>
      {/* Cell Body */}
      <div
        ref={contentRef}
        contentEditable={!isReadOnly}
        onBlur={() => onTextChange(contentRef.current?.innerText || "")}
        spellCheck={false}
        className={`p-5 text-[12px] leading-relaxed outline-none min-h-[120px] break-words transition-all font-medium ${
          completed ? 'text-emerald-900 line-through opacity-60' : 'text-slate-900'
        } ${isReadOnly ? 'cursor-default' : 'cursor-text focus:bg-white focus:shadow-2xl focus:z-10 focus:ring-4 focus:ring-blue-50/50'}`}
      />

      {/* Completion Checkmark - Always visible if there is text */}
      {!isReadOnly && text.trim() && (
        <button
          onClick={onToggleComplete}
          className={`absolute top-4 right-4 w-7 h-7 rounded-xl shadow-lg transition-all flex items-center justify-center border
            ${completed 
              ? 'bg-emerald-600 text-white border-emerald-700 scale-110' 
              : 'bg-white text-slate-300 hover:text-emerald-600 hover:border-emerald-300 border-slate-200'
            }
          `}
          title={completed ? "Mark as Not Completed" : "Mark as Completed"}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/>
          </svg>
        </button>
      )}
    </div>
  );
};
