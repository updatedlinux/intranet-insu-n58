import { useEffect, useState, type CSSProperties } from 'react';
import { resolveAvatarDisplayUrl } from '../../utils/avatar';

/** Color estable a partir del id del usuario (variante default). */
function avatarHue(userId: number): number {
  return (userId * 47) % 360;
}

export function getInitials(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

const NAVY = 'var(--intranet-navy, #4F2D63)';

interface UserAvatarProps {
  userId: number;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  /** `brand`: fondo navy e iniciales blancas (perfil y header). `default`: paleta suave en tablas. */
  variant?: 'default' | 'brand';
  className?: string;
}

const sizeMap = {
  sm: 36,
  md: 48,
  lg: 72,
};

const radiusMap = {
  sm: 10,
  md: 12,
  lg: 16,
};

export function UserAvatar({
  userId,
  firstName,
  lastName,
  avatarUrl,
  size = 'sm',
  variant = 'default',
  className = '',
}: UserAvatarProps) {
  const px = sizeMap[size];
  const radius = radiusMap[size];
  const initials = getInitials(firstName, lastName);
  const isBrand = variant === 'brand';
  const displaySrc = resolveAvatarDisplayUrl(userId, avatarUrl);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [displaySrc, userId]);

  const style: CSSProperties = {
    width: px,
    height: px,
    fontSize: size === 'lg' ? '1.25rem' : size === 'md' ? '1rem' : '0.8125rem',
    borderRadius: isBrand ? radius : '50%',
  };

  if (displaySrc && !imgFailed) {
    return (
      <img
        src={displaySrc}
        alt=""
        className={`user-avatar user-avatar--img user-avatar--${variant} ${className}`.trim()}
        style={style}
        width={px}
        height={px}
        onError={() => setImgFailed(true)}
        decoding="async"
        loading="lazy"
      />
    );
  }

  const initialsStyle: CSSProperties = isBrand
    ? {
        ...style,
        backgroundColor: NAVY,
        color: '#fff',
        fontWeight: 700,
        letterSpacing: '0.02em',
      }
    : {
        ...style,
        backgroundColor: `hsl(${avatarHue(userId)}, 28%, 88%)`,
        color: `hsl(${avatarHue(userId)}, 35%, 32%)`,
      };

  return (
    <span
      className={`user-avatar user-avatar--initials user-avatar--${variant} ${className}`.trim()}
      style={initialsStyle}
      aria-hidden
    >
      {initials}
    </span>
  );
}
