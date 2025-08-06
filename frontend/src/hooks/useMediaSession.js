import { useEffect } from 'react';

const useMediaSession = ({ track, isPlaying, onPlayPause, onNext, onPrev }) => {
    useEffect(() => {
        if (!('mediaSession' in navigator)) return;

        if (track) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.nome_cantor_musica_hunterfm,
                artist: 'Jonathan Music =D',
                artwork: [
                    { src: '/media-artwork/artwork-96x96.png', sizes: '96x96', type: 'image/png' },
                    { src: '/media-artwork/artwork-512x512.png', sizes: '512x512', type: 'image/png' }
                ]
            });
        }

        const setupActionHandler = (action, handler) => {
            try {
                navigator.mediaSession.setActionHandler(action, handler);
            } catch (error) {
                console.warn(`Ação ${action} não suportada:`, error);
            }
        };

        setupActionHandler('play', () => {
            onPlayPause(true);
            navigator.mediaSession.playbackState = "playing";
        });

        setupActionHandler('pause', () => {
            onPlayPause(false);
            navigator.mediaSession.playbackState = "paused";
        });

        setupActionHandler('previoustrack', onPrev);
        setupActionHandler('nexttrack', onNext);

        navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

        return () => {
            navigator.mediaSession.metadata = null;
            ['play', 'pause', 'previoustrack', 'nexttrack'].forEach(action => {
                navigator.mediaSession.setActionHandler(action, null);
            });
        };
    }, [track, isPlaying, onPlayPause, onNext, onPrev]);
};

export default useMediaSession;