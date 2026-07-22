import { useEffect, useState } from 'react';
import { Boxes, Package } from 'lucide-react';
import {
  resolveInventoryPhotoDisplayUrl,
  type InventoryPhotoKind,
} from '../../utils/inventory-photo';

interface InventoryPhotoThumbProps {
  kind: InventoryPhotoKind;
  itemId: number;
  name: string;
  photoUrl: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizePx = { sm: 40, md: 72, lg: 120 };

export function InventoryPhotoThumb({
  kind,
  itemId,
  name,
  photoUrl,
  size = 'sm',
  className = '',
}: InventoryPhotoThumbProps) {
  const px = sizePx[size];
  const src = resolveInventoryPhotoDisplayUrl(kind, itemId, photoUrl);
  const [failed, setFailed] = useState(false);
  const PlaceholderIcon = kind === 'asset' ? Package : Boxes;

  useEffect(() => {
    setFailed(false);
  }, [src, itemId, kind]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        className={`ti-inv-photo ti-inv-photo--${size} ${className}`.trim()}
        width={px}
        height={px}
        onError={() => setFailed(true)}
        decoding="async"
        loading="lazy"
      />
    );
  }

  return (
    <span
      className={`ti-inv-photo ti-inv-photo--placeholder ti-inv-photo--${size} ${className}`.trim()}
      style={{ width: px, height: px }}
      aria-hidden
    >
      <PlaceholderIcon size={size === 'lg' ? 32 : size === 'md' ? 24 : 18} />
    </span>
  );
}

/** Alias para activos */
export function AssetPhotoThumb({
  assetId,
  name,
  photoUrl,
  size,
  className,
}: {
  assetId: number;
  name: string;
  photoUrl: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <InventoryPhotoThumb
      kind="asset"
      itemId={assetId}
      name={name}
      photoUrl={photoUrl}
      size={size}
      className={className}
    />
  );
}
