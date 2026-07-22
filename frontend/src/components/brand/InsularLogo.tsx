import {
  BRAND_FULL_NAME,
  BRAND_ISOTYPE_SRC,
  BRAND_LOGO_NEGATIVE_SRC,
  BRAND_LOGO_SRC,
  BRAND_NAME,
  BRAND_TAG,
} from '../../config/brand';

interface InsularLogoProps {
  /** `negative`: logo claro para fondos oscuros (login). `full`: logo color. `default`: isotipo + texto */
  variant?: 'default' | 'compact' | 'full' | 'negative';
  /** Para usos sobre fondo claro u oscuro (solo afecta variantes con texto) */
  theme?: 'light' | 'dark';
}

export function InsularLogo({ variant = 'default', theme = 'light' }: InsularLogoProps) {
  if (variant === 'full' || variant === 'negative') {
    const src = variant === 'negative' ? BRAND_LOGO_NEGATIVE_SRC : BRAND_LOGO_SRC;
    return (
      <div
        className={`insular-logo insular-logo--full insular-logo--${variant}`}
        aria-label={BRAND_FULL_NAME}
      >
        <img src={src} alt={BRAND_FULL_NAME} className="insular-logo__image" />
      </div>
    );
  }

  return (
    <div
      className={`insular-logo insular-logo--${variant} insular-logo--theme-${theme}`}
      aria-label={BRAND_FULL_NAME}
    >
      <span className="insular-logo__mark">
        <img src={BRAND_ISOTYPE_SRC} alt="" className="insular-logo__isotype" aria-hidden />
      </span>
      {variant === 'default' && (
        <div className="insular-logo__text">
          <span className="insular-logo__name">{BRAND_NAME}</span>
          <span className="insular-logo__tag">{BRAND_TAG}</span>
        </div>
      )}
    </div>
  );
}
