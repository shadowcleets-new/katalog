import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  aspectClassName?: string;
  priority?: boolean;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = '',
  aspectClassName = 'aspect-[4/3]',
  priority = false,
}) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[var(--m3-surface-container)] text-[var(--m3-on-surface-variant)] p-4 text-center ${aspectClassName} ${className}`}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="h-7 w-7 opacity-60" aria-hidden="true" />
        <span className="mt-2 line-clamp-2 max-w-[180px] text-xs font-medium">{alt}</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-[var(--m3-surface-container)] ${aspectClassName} ${className}`}>
      {!loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[var(--m3-surface-container-high)] opacity-60"
        />
      )}
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover transition-opacity duration-200 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
