import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import PlayerControls from './components/PlayerControls';
import './App.css';
import { cacheTracks } from './utils/offlineCache';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa';

function App() {
  const [playlists, setPlaylists] = useState([]);
  const [selectedRadio, setSelectedRadio] = useState('2');
  const [selectedDate, setSelectedDate] = useState('2025-03-23');
  const [currentTrack, setCurrentTrack] = useState(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [ratings, setRatings] = useState([]);
  const [favoriteTracks, setFavoriteTracks] = useState([]);

  const userId = 1;
  const activeItemRef = useRef(null);
  const isOnline = useNetworkStatus();

  const fetchRatings = async () => {
    try {
      const res = await axios.get(`http://170.233.196.50:5202/api/ratings/${userId}`);
      setRatings(res.data);
    } catch (err) {
      console.error("Erro ao carregar avaliações:", err);
    }
  };

  const fetchFavorites = async () => {
    try {
      const res = await axios.get(`http://170.233.196.50:5202/api/favorites/${userId}`);
      // Adiciona id_musica ao track para avaliações
      const withIdMusica = res.data.map(t => ({ ...t, id_musica: t.id }));
      setFavoriteTracks(withIdMusica);
    } catch (err) {
      console.error("Erro ao carregar músicas favoritas:", err);
    }
  };

  const fetchPlaylists = async () => {
    try {
      const response = await axios.get('http://170.233.196.50:5202/api/playlists', {
        params: {
          id_radio_hunter: selectedRadio,
          data: selectedDate.replace(/-/g, '/')
        }
      });

      const data = response.data.map(t => ({
        ...t,
        id_musica: t.id_musica ?? t.id // garante que id_musica esteja presente
      }));

      setPlaylists(data);

      if (data.length > 0 && !currentTrack) {
        setCurrentTrack(data[0]);
        cacheTracks(data.slice(0, 10));
      }
    } catch (error) {
      console.error('Erro ao buscar playlists:', error);
    }
  };

  const filteredPlaylists = favoritesOnly ? favoriteTracks : playlists;

  const nextTrack = () => {
    const activeList = filteredPlaylists;
    if (activeList.length === 0) return;

    let newIndex;
    if (shuffleMode) {
      do {
        newIndex = Math.floor(Math.random() * activeList.length);
      } while (newIndex === currentTrackIndex && activeList.length > 1);
    } else {
      newIndex = (currentTrackIndex + 1) % activeList.length;
    }

    let attempts = 0;
    while (!activeList[newIndex]?.audio_url && attempts < activeList.length) {
      newIndex = shuffleMode
        ? Math.floor(Math.random() * activeList.length)
        : (newIndex + 1) % activeList.length;
      attempts++;
    }

    if (activeList[newIndex]?.audio_url) {
      setCurrentTrackIndex(newIndex);
      setCurrentTrack(activeList[newIndex]);
      setIsPlaying(true);
      cacheTracks(activeList.slice(newIndex, newIndex + 10));
    } else {
      setIsPlaying(false);
    }
  };

  const prevTrack = () => {
    const activeList = filteredPlaylists;
    if (activeList.length === 0) return;

    const newIndex = (currentTrackIndex - 1 + activeList.length) % activeList.length;
    setCurrentTrackIndex(newIndex);
    setCurrentTrack(activeList[newIndex]);
    setIsPlaying(true);
  };

  // Scroll automático para a música atual
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentTrack]);

  useEffect(() => {
    fetchPlaylists();
    fetchRatings();
  }, [selectedRadio, selectedDate]);

  useEffect(() => {
    const activeList = filteredPlaylists;
    if (activeList.length > 0 && currentTrack) {
      const index = activeList.findIndex(t => t.id === currentTrack.id || t.id_musica === currentTrack.id);
      setCurrentTrackIndex(index >= 0 ? index : 0);
    }
  }, [currentTrack, filteredPlaylists]);

  const handleToggleFavorites = () => {
    const newState = !favoritesOnly;
    setFavoritesOnly(newState);
    if (newState) {
      fetchFavorites();
    }
  };

  return (
    <div className="app-container">
      <h1>Music Player</h1>

      {!isOnline && (
        <div className="offline-status">
          Modo offline - reproduzindo do cache
        </div>
      )}

      <div className="controls">
        <select value={selectedRadio} onChange={(e) => setSelectedRadio(e.target.value)}>
          <option value="1">Pop</option>
          <option value="2">Pop 2K</option>
        </select>

        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />

        <button onClick={handleToggleFavorites}>
          {favoritesOnly ? "Mostrar todas" : "Somente favoritas"}
        </button>
      </div>

      <div className="playlist">
        <h2>Playlist ({favoritesOnly ? "Favoritas" : selectedDate})</h2>
        {filteredPlaylists.length > 0 ? (
          <ul>
            {filteredPlaylists.map((track, index) => {
              const isActive = currentTrack?.id === track.id || currentTrack?.id === track.id_musica;
              const rating = ratings.find(r => r.id_musica === track.id || r.id_musica === track.id_musica)?.rating;

              return (
                <li
                  key={track.id}
                  ref={isActive ? activeItemRef : null}
                  className={`
                      ${track.audio_url.length < 35 ? 'no-audio' : ''}
                  `}
                  onClick={() => {
                    const updatedTrack = {
                      ...track,
                      id_musica: track.id_musica ?? track.id
                    };
                    setCurrentTrack(updatedTrack);
                    setCurrentTrackIndex(index);
                    setIsPlaying(true);
                    cacheTracks(filteredPlaylists.slice(index, index + 10));
                  }}
                  style={{ backgroundColor: isActive ? '#e3f2fd' : 'transparent' }}
                >
                  {!favoritesOnly && <span className="time">{track.horario} - </span>}
                  <strong>{track.nome_cantor_musica_hunterfm}</strong>
                  {rating === 1 && <FaThumbsUp size={16} color="green" style={{ marginLeft: 8 }} />}
                  {rating === -1 && <FaThumbsDown size={16} color="red" style={{ marginLeft: 8 }} />}
                  {isActive && <span className="playing-indicator">▶ Tocando agora</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>Nenhuma música encontrada para esta data.</p>
        )}
      </div>

      {currentTrack && (
        <PlayerControls
          track={currentTrack}
          isPlaying={isPlaying}
          onPlayPause={setIsPlaying}
          onNext={nextTrack}
          onPrev={prevTrack}
          shuffleMode={shuffleMode}
          toggleShuffle={() => setShuffleMode(!shuffleMode)}
        />
      )}
    </div>
  );
}

export default App;
