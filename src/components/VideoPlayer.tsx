/* This file is deprecated and no longer used
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  initialTime?: number;
  onError?: () => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

export default function VideoPlayer({ src, poster, initialTime, onError, onProgress, onEnded }: VideoPlayerProps) {
  return (
    <MediaPlayer
      src={src}
      poster={poster}
      currentTime={initialTime}
      style={{ width: '100%', aspectRatio: '16/9' }}
      onError={onError}
      onTimeUpdate={(detail) => {
        if (detail.currentTime && detail.duration) {
          onProgress?.(detail.currentTime, detail.duration);
        }
      }}
      onEnded={onEnded}
    >
      <MediaProvider />
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  );
}
export {};
*/
