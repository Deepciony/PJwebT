import { useState } from 'react';

type Props = {
  name: string;
  url: string | null;
  className: string;
  fallbackClassName?: string;
  alt?: string;
};

export function UserAvatar({ name, url, className, fallbackClassName = '', alt = '' }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (url && failedUrl !== url) {
    return <img src={url} alt={alt} className={`${className} object-cover`} onError={() => setFailedUrl(url)} />;
  }

  return (
    <span className={`${className} grid place-items-center rounded-full bg-violet font-display font-bold text-white ${fallbackClassName}`} aria-label={alt || name}>
      {name.slice(0, 1)}
    </span>
  );
}
