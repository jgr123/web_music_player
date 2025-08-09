import React, { useRef, useEffect, useState } from 'react';
import {
  FaPlay,
  FaPause,
  FaStepForward,
  FaStepBackward,
  FaRandom,
  FaVolumeUp,
  FaVolumeMute,
  FaThumbsUp,
  FaThumbsDown
} from 'react-icons/fa';
import useMediaSession from '../hooks/useMediaSession';
import { getTrack } from '../utils/offlineCache';
import axios from 'axios';

const PlayerControls = ({
  track,
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
  shuffleMode,
  toggleShuffle,
  user
}) => {
  const audioRef = useRef(null);
  const [volume, setVolume] = useState(0.7);
  const [lastVolume, setLastVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioSrc, setAudioSrc] = useState(track?.audio_url);
  const [rating, setRating] = useState(null);

  const userId = user?.id;
// usar teclas de multimidia para passar musicas
  useMediaSession({ track, isPlaying, onPlayPause, onNext, onPrev });
// fim teclas de multimidia para passar musicas

  const getTrackIdMusica = () => {
    return track?.id_musica || track?.id;
  };

  const rateTrack = async (newRating) => {
    const id_musica = getTrackIdMusica();
    if (!id_musica) return;

    try {
      await axios.post('http://170.233.196.50:5202/api/rate', {
        id_musica,
        user_id: userId,
        rating: newRating
      });
      console.log(`🎵 Avaliação salva: ${id_musica} - ${track.nome_cantor_musica_hunterfm} = ${newRating}`);
      setRating(newRating);
    } catch (err) {
      console.error("Erro ao salvar avaliação:", err);
    }
  };

  // 🔄 Atualiza o src quando a faixa mudar
  // No useEffect que carrega a música
useEffect(() => {
  const loadAndMaybePlay = async () => {
    if (!track?.id) {
      console.warn("Track inválida - sem ID");
      return;
    }

    console.log("Preparando para tocar:", { 
      id: track.id, 
      type: typeof track.id,
      isOffline: track.isOffline
    });
 
    try {
      let audioSource;
      
      // Verifica se já é uma URL de blob (offline)
      if (track.audio_url?.startsWith('blob:')) {
        audioSource = track.audio_url;
      } 
      // Tenta carregar do cache
      else {
        const cachedData = await getTrack(track.id.toString()); // Garante ID como string
        
        if (cachedData?.blob instanceof Blob) {
          audioSource = URL.createObjectURL(cachedData.blob);
          console.log(`🎵 Reproduzindo do cache: ${track.nome_cantor_musica_hunterfm}`);
        } else {
          // Fallback para URL online
          audioSource = track.audio_url;
          console.log("ℹ️ Usando versão online, cache não encontrado");
        }
      }

      setAudioSrc(audioSource);

      // Reprodução automática
      if (isPlaying && audioRef.current) {
        setTimeout(() => {
          audioRef.current.play().catch(e => {
            console.warn("Autoplay bloqueado:", e);
          });
        }, 100);
      }
    } catch (err) {
      console.error("Erro no carregamento:", err);
      setAudioSrc(track.audio_url); // Fallback final
    }
  };
  loadAndMaybePlay();
}, [track]);

  // ▶️⏸️ Controla play/pause sem alterar o src
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const tryPlay = async () => {
      try {
        if (isPlaying) {
          await audio.play();
        } else {
          audio.pause();
        }
      } catch (e) {
      console.warn("Navegador bloqueou autoplay:", e);
      }
    };

    tryPlay();
  }, [isPlaying]);

useEffect(() => {
  return () => {
    // Limpa URLs de objeto quando o componente desmonta
    if (audioSrc && audioSrc.startsWith('blob:')) {
      URL.revokeObjectURL(audioSrc);
    }
  };
}, [audioSrc]);

  // 🔍 Buscar avaliação
  useEffect(() => {
    const fetchRating = async () => {
      const id_musica = getTrackIdMusica();
      if (!id_musica) return;

      try {
        const res = await axios.get(`http://170.233.196.50:5202/api/ratings/${userId}`);
        const found = res.data.find(r => r.id_musica === id_musica);
        setRating(found?.rating ?? null);
      } catch (err) {
        console.error("Erro ao buscar avaliação:", err);
      }
    };
    fetchRating();
  }, [track]);

  // 🎧 Atualiza progresso, duração, lida com fim do áudio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const setAudioData = () => {
      setDuration(audio.duration);
    };

    const handleError = () => {
      console.warn(`Erro ao carregar: ${track?.audio_url}`);
      onNext();
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('ended', onNext);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('ended', onNext);
      audio.removeEventListener('error', handleError);
    };
  }, [track, onNext]);

  const handleProgressChange = (e) => {
    const newTime = (e.target.value / 100) * audioRef.current.duration;
    audioRef.current.currentTime = newTime;
    setProgress(e.target.value);
  };

  const toggleMute = () => {
    if (isMuted) {
      setVolume(lastVolume);
    } else {
      setLastVolume(volume);
      setVolume(0);
    }
    setIsMuted(!isMuted);
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const formatTime = (time) => {
    if (!time) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

// No PlayerControls.js, antes do return
console.log('Current audio source:', {
  src: audioSrc,
  trackId: track?.id,
  isBlob: audioSrc?.startsWith('blob:')
});

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
          onChange={(e) => setVolume(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
};

export default PlayerControls;
