import React, { useRef, useEffect, useState } from 'react';
import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaRandom, FaVolumeUp, FaVolumeMute, FaThumbsUp, FaThumbsDown  } from 'react-icons/fa';
import useMediaSession from '../hooks/useMediaSession'; // Importe o hook
import { getTrack } from '../utils/offlineCache';
import axios from 'axios';

const PlayerControls = ({ 
  track, 
  isPlaying, 
  onPlayPause,
  onNext,
  onPrev,
  shuffleMode,
  toggleShuffle
}) => {
  const audioRef = useRef(null);
    const [volume, setVolume] = useState(0.7); // Volume padrão 70%
    const [lastVolume, setLastVolume] = useState(0.7);
    const [isMuted, setIsMuted] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [audioSrc, setAudioSrc] = useState(track?.audio_url);

    const userId = 1; // ID do usuário, pode ser dinâmico no futuro
    const [rating, setRating] = useState(null); // null = ainda não carregado

    const rateTrack = async (rating) => {
    if (!track) return;
    console.log("track.id_musica = " + track.id_musica);
    try {
        await axios.post('http://170.233.196.50:5202/api/rate', {
        id_musica: track.id_musica,
        user_id: userId,
        rating
        });
        console.log(`🎵 Avaliação salva: ${track.nome_cantor_musica_hunterfm} = ${rating}`);
    } catch (err) {
        console.error("Erro ao salvar avaliação:", err);
    }
    };

    // usar teclas de multimidia para passar musicas
    useMediaSession({ track, isPlaying, onPlayPause, onNext, onPrev });
    // fim teclas de multimidia

    useEffect(() => {
    if (!track) return;

    const fetchRating = async () => {
        try {
        const res = await axios.get(`http://170.233.196.50:5202/api/ratings/${userId}`);
        const found = res.data.find(r => r.musica_id === track.id);
        setRating(found?.rating || null);
        } catch (err) {
        console.error("Erro ao buscar avaliação:", err);
        }
    };

    fetchRating();
    }, [track]);

    useEffect(() => {
    async function loadTrack() {
        if (!track) return;
        const offlineBlob = await getTrack(track.id);
        if (offlineBlob) {
        setAudioSrc(URL.createObjectURL(offlineBlob));
        console.log(`🎧 Tocando versão offline: ${track.nome_cantor_musica_hunterfm}`);
        } else {
        setAudioSrc(track.audio_url);
        }
    }
    loadTrack();
    }, [track]);

    // controlar volume
        // Efeito para controlar o volume do áudio
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (newVolume > 0 && isMuted) {
            setIsMuted(false);
        }
    };

    const toggleMute = () => {
        if (isMuted) {
            // Restaura o volume anterior ao desmutar
            setVolume(lastVolume);
        } else {
            // Salva o volume atual antes de mutar
            setLastVolume(volume);
            setVolume(0);
        }
        setIsMuted(!isMuted);
    };
    // fim controle volume

  useEffect(() => {
  if (!audioRef.current) return;

  const audio = audioRef.current;

  const tryPlay = async () => {
    try {
      if (isPlaying) {
        await audio.play();
      }
    } catch (e) {
      console.warn("Navegador bloqueou autoplay:", e);
    }
  };

  audio.src = audioSrc; // Garante que o src seja atualizado antes
  if (isPlaying) {
    tryPlay();
  } else {
    audio.pause();
  }
}, [audioSrc, isPlaying]);

  useEffect(() => {
        if (!audioRef.current) return;

        const audio = audioRef.current;
        
        const updateProgress = () => {
            setCurrentTime(audio.currentTime);
            setProgress((audio.currentTime / audio.duration) * 100);
        };

        const setAudioData = () => {
            setDuration(audio.duration);
        };

        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('loadedmetadata', setAudioData);
        audio.addEventListener('ended', onNext);

        return () => {
            audio.removeEventListener('timeupdate', updateProgress);
            audio.removeEventListener('loadedmetadata', setAudioData);
            audio.removeEventListener('ended', onNext);
        };
    }, [onNext]);

useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    
    const handleError = () => {
        console.warn(`Erro ao carregar: ${track?.audio_url}`);
        onNext(); // Chama nextTrack automaticamente
    };

    audio.addEventListener('error', handleError);
    
    return () => {
        audio.removeEventListener('error', handleError);
    };
}, [track, onNext]);

    const handleProgressChange = (e) => {
        if (!audioRef.current) return;
        const newTime = (e.target.value / 100) * audioRef.current.duration;
        audioRef.current.currentTime = newTime;
        setProgress(e.target.value);
    };

    const formatTime = (time) => {
        if (!time) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

  return (
        <div className="player-controls">

            <audio 
                ref={audioRef} 
                src={audioSrc} 
                onError={(e) => console.error("Erro no áudio:", e)}     
            />
            
            <div className="progress-container">
                <span className="time-display">{formatTime(currentTime)}</span>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={progress || 0}
                    onChange={handleProgressChange}
                    className="progress-bar"
                />
                <span className="time-display">{formatTime(duration)}</span>
            </div>
            
            <div className="controls-container">
                <button onClick={onPrev} className="control-btn">
                    <FaStepBackward />
                </button>
                
                <button onClick={() => onPlayPause(!isPlaying)} className="control-btn play-btn">
                    {isPlaying ? <FaPause /> : <FaPlay />}
                </button>
                
                <button onClick={onNext} className="control-btn">
                    <FaStepForward />
                </button>
                
                <button 
                    onClick={toggleShuffle} 
                    className={`control-btn ${shuffleMode ? 'active' : ''}`}
                >
                    <FaRandom />
                </button>
            </div>
            
            <div className="now-playing">
                {track?.nome_cantor_musica_hunterfm || 'Nenhuma música selecionada'}
            </div>

            <div className="like-controls">
                {rating === null && (
                    <>
                    <button onClick={() => rateTrack(1)} className="like-btn"><FaThumbsUp size={32} /></button>
                    <button onClick={() => rateTrack(-1)} className="dislike-btn"><FaThumbsDown size={32} /></button>
                    </>
                )}
                {rating === 1 && <FaThumbsUp size={32} color="green" />}
                {rating === -1 && <FaThumbsDown size={32} color="red" />}
            </div>

            <div className="volume-controls">
                <button onClick={toggleMute} className="volume-btn">
                    {isMuted || volume === 0 ? <FaVolumeMute /> : <FaVolumeUp />}
                </button>
                
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="volume-slider"
                />
            </div>
        </div>
    );
};

export default PlayerControls;