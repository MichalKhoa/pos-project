import React from 'react';
import { getPresetIconComponent } from '../../utils/presetIcons';

// Background art for a preset tile: photo, icon watermark, or first-letter watermark.
export default function PresetTileArt({ preset }) {
  if (preset.imageUrl) {
    return <img src={preset.imageUrl} alt="" className="preset-photo" />;
  }
  const IconComponent = getPresetIconComponent(preset.icon);
  const letter = (Array.from((preset.name || '').trim())[0] || '').toUpperCase();
  if (!IconComponent && !letter) return null;
  return (
    <div className="preset-watermark" aria-hidden="true">
      {IconComponent ? <IconComponent /> : letter}
    </div>
  );
}
