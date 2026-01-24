
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
    <div className={`relative h-full min-h-[100px] transition-all duration-300 ${
      completed 
        ? 'bg-[#dcfce7]' 
        : text.trim() 
          ? 'bg-[#fee2e2]' 
          : 'bg-transparent'
    }`}>
      {/* Cell Body */}
      <div
        ref={contentRef}
        contentEditable={!isReadOnly}
        onBlur={() => onTextChange(contentRef.current?.innerText || "")}
        spellCheck={false}
        className={`p-4 text-[12px] leading-relaxed outline-none min-h-[100px] break-words transition-all font-medium ${
          completed ? 'text-emerald-900 line-through opacity-50' : 'text-slate-800'
        } ${isReadOnly ? 'cursor-default' : 'cursor-text focus:bg-white focus:shadow-xl focus:z-10 focus:ring-4 focus:ring-blue-100/50'}`}
      />

      {/* Completion Indicator (Checkbox circle like in screenshot) */}
      {!isReadOnly && text.trim() && (
        <button
          onClick={onToggleComplete}
          className={`absolute top-3 right-3 w-6 h-6 rounded-full shadow-sm transition-all flex items-center justify-center border
            ${completed 
              ? 'bg-emerald-500 text-white border-emerald-600' 
              : 'bg-white text-slate-300 hover:text-emerald-500 hover:border-emerald-300 border-slate-200'
            }
          `}
          title={completed ? "Mark Pending" : "Mark Complete"}
        >
          {completed ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
          )}
        </button>
      )}
    </div>
  );
};
