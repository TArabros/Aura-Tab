import { useState, useEffect } from 'react';

interface ClockProps {
  userName: string;
}

export default function Clock({ userName }: ClockProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');

  const dateStr = time.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const hour = time.getHours();
  const greeting = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = userName.trim();

  return (
    <div className="text-center mb-4 animate-fade-in select-none" style={{ animationDelay: '0.1s' }}>
      <div
        className="text-[96px] font-extralight tracking-[-4px] leading-none mb-2"
        style={{
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--color-text-primary)',
        }}
      >
        <span className="opacity-95">{hours}</span>
        <span className="opacity-40 mx-1">:</span>
        <span className="opacity-95">{minutes}</span>
      </div>
      <p
        className="text-lg font-light"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {dateStr}
      </p>
      <p
        className="text-base font-light mt-1"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {name ? `${greeting}, ${name}` : greeting}
      </p>
    </div>
  );
}
