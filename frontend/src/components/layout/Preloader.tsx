interface PreloaderProps {
  visible: boolean;
}

export function Preloader({ visible }: PreloaderProps) {
  if (!visible) return null;

  return (
    <div id="preloader">
      <div className="spinner" />
    </div>
  );
}
