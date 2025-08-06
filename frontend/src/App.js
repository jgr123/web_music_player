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
    const [favorites, setFavorites] = useState([]);
    const [favoriteTracks, setFavoriteTracks] = useState([]);
    const [ratings, setRatings] = useState([]);
    const userId = 1; // ID do usuário


    // Dentro do componente App
    const playlistRef = useRef(null);
    const activeItemRef = useRef(null);
    const isOnline = useNetworkStatus();


    
  const fetchRatings = async () => {
    try {
      const res = await axios.get(`http://170.233.196.50:5202/api/ratings/${userId}`);
      setRatings(res.data);
      setFavorites(res.data.filter(r => r.rating === 1).map(r => r.musica_id));
    } catch (err) {
      console.error("Erro ao carregar avaliações:", err);
    }
  };

    const fetchFavorites = async () => {
    try {
        const res = await axios.get(`http://170.233.196.50:5202/api/favorites/${userId}`);
        setFavoriteTracks(res.data);
    } catch (err) {
        console.error("Erro ao carregar músicas favoritas:", err);
    }
    };

    const fetchPlaylists = async () => {
        try {
         //   const response = await axios.get('http://192.168.1.232:5000/api/playlists', {
            const response = await axios.get('http://170.233.196.50:5202/api/playlists', {
                params: {
                    id_radio_hunter: selectedRadio,
                    data: selectedDate.replace(/-/g, '/')
                }
            });
            setPlaylists(response.data);
            if (response.data.length > 0) {
                setCurrentTrack(response.data[0]);
                // Cache as primeiras 10 músicas
                cacheTracks(response.data.slice(0, 10));
            }
            if (response.data.length > 0 && !currentTrack) {
                setCurrentTrack(response.data[0]);
            }
        } catch (error) {
            console.error('Erro ao buscar playlists:', error);
        }
    };

const nextTrack = () => {
  const activeList = favoritesOnly ? favoriteTracks : playlists;
  if (activeList.length === 0) return;

  let newIndex;
  if (shuffleMode) {
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * activeList.length);
    } while (randomIndex === currentTrackIndex && activeList.length > 1);
    newIndex = randomIndex;
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
  const activeList = favoritesOnly ? favoriteTracks : playlists;
  if (activeList.length === 0) return;

  const newIndex = (currentTrackIndex - 1 + activeList.length) % activeList.length;
  setCurrentTrackIndex(newIndex);
  setCurrentTrack(activeList[newIndex]);
  setIsPlaying(true);
};


    
    // Efeito para rolagem automática
    useEffect(() => {
    if (activeItemRef.current) {
        activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
        });
    }
    }, [currentTrack]);

    useEffect(() => {
        fetchPlaylists();
    }, [selectedRadio, selectedDate]);

useEffect(() => {
  const activeList = favoritesOnly ? favoriteTracks : playlists;
  if (activeList.length > 0 && currentTrack) {
    const index = activeList.findIndex(t => t.id === currentTrack.id);
    setCurrentTrackIndex(index >= 0 ? index : 0);
  }
}, [currentTrack, playlists, favoriteTracks, favoritesOnly]);

    useEffect(() => {
        async function loadFavorites() {
            try {
            const res = await axios.get(`http://170.233.196.50:5202/api/ratings/${userId}`);
            const liked = res.data.filter(r => r.rating === 1).map(r => r.musica_id);
            setFavorites(liked);
            } catch (err) {
            console.error("Erro ao carregar favoritos:", err);
            }
        }
        loadFavorites();
    }, [currentTrack]);


    const filteredPlaylists = favoritesOnly ? favoriteTracks : playlists;

    return (
        <div className="app-container">
            <h1>Player de Rádio Hunter</h1>
            
            {!isOnline && (
                <div className="offline-status">
                Modo offline - reproduzindo do cache
                </div>
            )}
            
            <div className="controls">
                <select 
                    value={selectedRadio} 
                    onChange={(e) => setSelectedRadio(e.target.value)}
                >
                    <option value="1">Pop</option>
                    <option value="2">Pop 2K</option>
                </select>
                
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                />

                <button onClick={() => {
                    const newState = !favoritesOnly;
                    setFavoritesOnly(newState);
                    if (newState) {
                        fetchFavorites();
                    }
                    }}>
                    {favoritesOnly ? "Mostrar todas" : "Somente favoritas"}
                </button>

            </div>


            <div className="playlist">
                <h2>Playlist ({selectedDate})</h2>
                {filteredPlaylists.length > 0 ? (
                    <ul>
                        {filteredPlaylists.map((track, index) => {
                            const isActive = currentTrack?.id === track.id; // remover
                            return (
                                <li 
                                key={track.id}
                                ref={isActive ? activeItemRef : null}                              
                                className={`
                                    ${!track.audio_url ? 'no-audio' : ''}
                                `}
                                onClick={() => {
                                    setCurrentTrack(track);
                                    setCurrentTrackIndex(index);
                                    setIsPlaying(true);

                                    const activeList = favoritesOnly ? favoriteTracks : playlists;
                                    const startIndex = index;
                                    cacheTracks(activeList.slice(startIndex, startIndex + 10)); // 🔥 Faz buffer das próximas 10
                                }}
                                style={{
                                    backgroundColor: isActive ? '#e3f2fd' : 'transparent'
                                }}
                                >                                
                                {!favoritesOnly && <span className="time">{track.horario} - </span>}                            
                                {!track.audio_url && (
                                    <span>? ? ? </span>
                                )}
                                <strong>{track.nome_cantor_musica_hunterfm}</strong>  
                                {(() => {
                                    const trackRating = ratings.find(r => r.musica_id === track.id)?.rating;
                                    if (trackRating === 1) return <FaThumbsUp size={16} color="green" style={{ marginLeft: '8px' }} />;
                                    if (trackRating === -1) return <FaThumbsDown size={16} color="red" style={{ marginLeft: '8px' }} />;
                                    return null;
                                })()}                          
                                {isActive && <span className="playing-indicator">▶ Tocando agora</span>}
                                </li>
                            )
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