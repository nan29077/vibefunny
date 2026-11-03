import type { CSSProperties } from "react";

export function DesktopMarginImage({ src }: { src: string }) {
  return (
    <div aria-hidden className="vf-desktop-margin" style={{ "--vf-margin-image": `url('${src}')` } as CSSProperties}>
      <div className="vf-desktop-margin-panel" />
      <div className="vf-desktop-margin-panel vf-desktop-margin-panel-right" />
    </div>
  );
}
