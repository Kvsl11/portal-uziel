
import React from 'react';

// Helper to parse markdown-like syntax into React elements
// Supports: **bold**, *italic*, <c:#hex>color</c>
const renderMarkdownLine = (line: string) => {
  if (!line) return null;

  // Regex breakdown:
  // 1. Color tags: <c:#...>(...)</c>
  // 2. Bold: **...**
  // 3. Italic: *...*
  const regex = /(<c:#[a-fA-F0-9]{3,6}>.*?<\/c>|\*\*.*?\*\*|\*.*?\*)/g;
  
  const segments = line.split(regex).filter(Boolean);
  
  return segments.map((segment, i) => {
    // Color Handler
    if (segment.startsWith('<c:') && segment.endsWith('</c>')) {
        const hexMatch = segment.match(/<c:(#[a-fA-F0-9]{3,6})>/);
        const content = segment.replace(/<c:#[a-fA-F0-9]{3,6}>|<\/c>/g, '');
        const color = hexMatch ? hexMatch[1] : 'inherit';
        
        // Recursive parsing for nested bold/italic inside color
        return (
            <span key={i} style={{ color: color }}>
                {renderMarkdownLine(content)}
            </span>
        );
    }

    // Bold Handler
    if (segment.startsWith('**') && segment.endsWith('**')) {
      return (
        <strong key={i} className="font-extrabold not-italic">
          {segment.substring(2, segment.length - 2)}
        </strong>
      );
    }

    // Italic Handler
    if (segment.startsWith('*') && segment.endsWith('*')) {
        return (
          <em key={i} className="italic font-medium">
            {segment.substring(1, segment.length - 1)}
          </em>
        );
    }

    // Regular Text
    return <React.Fragment key={i}>{segment}</React.Fragment>;
  });
};


const ChordRenderer = ({ text, center = false, showChords = true }: { text: string, center?: boolean, showChords?: boolean }) => {
    if (!text) return null;

    // Remove chords if showChords is false
    const processedText = showChords ? text : text.replace(/\[[^\]]+\]/g, '');

    // Split by newline but keep empty lines
    const lines = processedText.split(/\r\n|\r|\n/);

    return (
        <div className={`font-sans text-lg leading-loose w-full overflow-x-hidden ${center ? 'text-center' : 'text-left'}`}>
            {lines.map((line, lineIdx) => {
                // Handle empty lines explicitly to preserve spacing
                if (!line.trim()) {
                    return (
                        <div key={lineIdx} className="min-h-[1.5em] w-full select-none" aria-hidden="true">
                            &nbsp;
                        </div>
                    );
                }

                // Detect if the line has chords in the format [C]
                if (line.includes('[')) {
                    // Regex to capture [Chord] and the text that follows it
                    const parts = line.split(/(\[[^\]]+\])/g);
                    
                    const blocks: React.ReactNode[] = [];
                    let currentChord = '';

                    parts.forEach((part, i) => {
                        if (part.startsWith('[') && part.endsWith(']')) {
                            // If we had a pending chord without text (e.g., [A][B]), render the previous one
                            if (currentChord) {
                                blocks.push(
                                    <div key={`${lineIdx}-${i}-prev`} className="inline-flex flex-col justify-end mr-2 mb-6 min-w-[1.5rem]">
                                        <span className="text-brand-600 dark:text-brand-400 font-black text-sm h-6 leading-none whitespace-nowrap bg-brand-50 dark:bg-brand-900/30 px-1.5 rounded-md mb-1">{currentChord}</span>
                                        <span className="text-transparent text-lg h-7 leading-normal select-none border-b-2 border-transparent">.</span>
                                    </div>
                                );
                            }
                            // Clean brackets and store the current chord
                            currentChord = part.replace(/[\[\]]/g, '');
                        } else if (part !== '') {
                            // This is text/lyrics
                            const hasLeadingSpace = part.startsWith(' ');
                            // Reduce margin if leading space to keep flow natural
                            const marginClass = hasLeadingSpace ? 'mr-1' : 'mr-0.5';
                            
                            blocks.push(
                                <div key={`${lineIdx}-${i}`} className={`inline-flex flex-col justify-end ${marginClass} mb-6 group relative`}>
                                    {/* Chord (Top) */}
                                    <span className="text-brand-600 dark:text-brand-400 font-black text-sm h-6 leading-none whitespace-nowrap min-w-[1px] text-left">
                                        {currentChord ? (
                                            <span className="bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded-md">{currentChord}</span>
                                        ) : '\u00A0'}
                                    </span>
                                    {/* Lyrics (Bottom) with Rich Text Support */}
                                    <span className="text-slate-800 dark:text-slate-100 font-semibold text-lg leading-normal whitespace-pre text-left border-b-2 border-transparent">
                                        {renderMarkdownLine(part)}
                                    </span>
                                </div>
                            );
                            currentChord = ''; // Chord has been used
                        }
                    });

                    // If a chord is left at the end of the line without text
                    if (currentChord) {
                        blocks.push(
                            <div key={`${lineIdx}-last`} className="inline-flex flex-col justify-end mr-2 mb-6">
                                <span className="text-brand-600 dark:text-brand-400 font-black text-sm h-6 leading-none whitespace-nowrap bg-brand-50 dark:bg-brand-900/30 px-1.5 rounded-md mb-1">{currentChord}</span>
                                <span className="text-transparent text-lg h-7 leading-normal select-none">.</span>
                            </div>
                        );
                    }

                    return (
                        <div key={lineIdx} className={`flex flex-wrap items-end ${center ? 'justify-center' : 'justify-start'}`}>
                            {blocks}
                        </div>
                    );
                }

                // Line without chords (just text with potential formatting)
                return (
                    <div key={lineIdx} className="mb-4 text-slate-700 dark:text-slate-300 font-semibold text-lg whitespace-pre-wrap">
                        {renderMarkdownLine(line)}
                    </div>
                );
            })}
        </div>
    );
};

export default ChordRenderer;
