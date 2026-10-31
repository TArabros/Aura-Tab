import { useState, useRef } from 'react';
import { Search, X as XIcon } from 'lucide-react';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    // Check if it looks like a URL
    const hasScheme = /^https?:\/\//i.test(trimmed);
    const isLocal = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/\S*)?$/i.test(trimmed);
    const isUrl = (hasScheme && !/\s/.test(trimmed)) || isLocal ||
      /^www\.\S+$/i.test(trimmed) ||
      (/^[a-z0-9]([a-z0-9-]*\.)+[a-z]{2,}(:\d+)?([/?#]\S*)?$/i.test(trimmed));

    if (isUrl) {
      const url = hasScheme ? trimmed : `${isLocal ? 'http' : 'https'}://${trimmed}`;
      window.location.href = url;
    } else {
      window.location.href = `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-[720px] animate-fade-in"
      style={{ animationDelay: '0.2s' }}
    >
      <div
        className={`search-container relative flex items-center px-6 py-5 min-h-[68px] ${focused ? 'focused' : ''}`}
      >
        <Search
          size={23}
          className="mr-4.5 flex-shrink-0 transition-colors duration-200"
          style={{ color: focused ? 'var(--color-accent)' : 'var(--search-icon-color)' }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search Google or type a URL..."
          className="search-input flex-1 bg-transparent border-none outline-none text-[19px] font-normal"
          style={{ color: 'var(--color-text-primary)' }}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="nova-btn-icon ml-2 flex-shrink-0"
            style={{ padding: 6, opacity: 0.5 }}
            title="Clear search"
          >
            <XIcon size={17} />
          </button>
        )}
      </div>
    </form>
  );
}
