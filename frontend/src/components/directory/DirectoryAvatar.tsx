import { useEffect, useState, type CSSProperties } from 'react';
import { getInitials } from '../admin/UserAvatar';

const API_BASE = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '');

/** Color estable por área (directorio público). */
function areaHue(areaId: number): number {
  return (areaId * 53) % 360;
}

function resolveAvatarSrc(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl?.trim()) return null;
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }
  if (avatarUrl.startsWith('/')) {
    return avatarUrl;
  }
  return `${API_BASE}/${avatarUrl.replace(/^\//, '')}`;
}

interface DirectoryAvatarProps {
  firstName: string;
  lastName: string;
  areaId: number;
  avatarUrl?: string | null;
  size?: 'md' | 'lg';
  className?: string;
}

const sizeMap = { md: 72, lg: 96 };

export function DirectoryAvatar({
  firstName,
  lastName,
  areaId,
  avatarUrl,
  size = 'md',
  className = '',
}: DirectoryAvatarProps) {
  const px = sizeMap[size];
  const initials = getInitials(firstName, lastName);
  const displaySrc = resolveAvatarSrc(avatarUrl);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [displaySrc]);

  const style: CSSProperties = {
    width: px,
    height: px,
    fontSize: size === 'lg' ? '1.5rem' : '1.125rem',
  };

  if (displaySrc && !imgFailed) {
    return (
      <img
        src={displaySrc}
        alt=""
        className={`directory-avatar directory-avatar--img ${className}`.trim()}
        style={style}
        width={px}
        height={px}
        onError={() => setImgFailed(true)}
        decoding="async"
        loading="lazy"
      />
    );
  }

  const hue = areaHue(areaId);
  return (
    <span
      className={`directory-avatar directory-avatar--initials ${className}`.trim()}
      style={{
        ...style,
        backgroundColor: `hsl(${hue}, 32%, 86%)`,
        color: `hsl(${hue}, 42%, 28%)`,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
