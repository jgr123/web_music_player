import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import PlayerControls from './components/PlayerControls';
import './App.css';
import { cacheTracks } from './utils/offlineCache';
import { useNetworkStatus } from './hooks/useNetworkStatus';

function App() {
    const [playlists, setPlaylists] = useState([]);
    const [selectedRadio, setSelectedRadio] = useState('2');
    const [selectedDate, setSelectedDate] = useState('2025-03-23');
    const [currentTrack, setCurrentTrack] = useState(null);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [shuffleMode, setShuffleMode] = useState(false);

    // Dentro do componente App
    const playlistRef = useRef(null);
    const activeItemRef = useRef(null);
    const isOnline = useNetworkStatus();

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
  if (playlists.length === 0) return;

  let newIndex;
  
  if (shuffleMode) {
    // Lógica para modo aleatório
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * playlists.length);
    } while (randomIndex === currentTrackIndex && playlists.length > 1);
    
    newIndex = randomIndex;
  } else {
    // Lógica para modo sequencial
    newIndex = (currentTrackIndex + 1) % playlists.length;
  }
    console.log("newIndex= " + newIndex);
  // Verifica se a próxima música tem áudio
  let attempts = 0;
  while (!playlists[newIndex]?.audio_url && attempts < playlists.length) {
    newIndex = shuffleMode 
      ? Math.floor(Math.random() * playlists.length)
      : (newIndex + 1) % playlists.length;
    attempts++;
  }

  if (playlists[newIndex]?.audio_url) {
    setCurrentTrackIndex(newIndex);
    setCurrentTrack(playlists[newIndex]);
    setIsPlaying(true);    
    // Atualiza cache das próximas 10 músicas a partir da atual
    const nextFive = playlists.slice(newIndex, newIndex + 10);
    cacheTracks(nextFive);
  } else {
    setIsPlaying(false);
    console.log("Nenhuma música disponível encontrada");
  }
};

    const prevTrack = () => {
        if (playlists.length === 0) return;
        
        const newIndex = (currentTrackIndex - 1 + playlists.length) % playlists.length;
        setCurrentTrackIndex(newIndex);
        setCurrentTrack(playlists[newIndex]);
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
        if (playlists.length > 0 && currentTrack) {
            const index = playlists.findIndex(t => t.id === currentTrack.id);
            setCurrentTrackIndex(index >= 0 ? index : 0);
        }
    }, [currentTrack, playlists]);

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
            </div>

            <div className="playlist">
                <h2>Playlist ({selectedDate})</h2>
                {playlists.length > 0 ? (
                    <ul>
                        {playlists.map((track, index) => {
                            const isActive = currentTrack?.id === track.id; // remover
                            return (
                                <li 
                                key={`${track.id}-${track.horario}`}
                                ref={isActive ? activeItemRef : null}  // remover                               
                                className={`
                                    ${!track.audio_url ? 'no-audio' : ''}
                                `}
                                onClick={() => {
                                    setCurrentTrack(track);
                                    setCurrentTrackIndex(index);
                                    setIsPlaying(true);
                                }}
                                style={{
                                    backgroundColor: currentTrack?.id === track.id ? '#e3f2fd' : 'transparent'
                                }}
                                >                                
                                <span className="time">{track.horario} - </span>                            
                                {!track.audio_url && (
                                    <span>? ? ? </span>
                                )}
                                <strong>{track.nome_cantor_musica_hunterfm}</strong>                            
                                {currentTrack?.id === track.id && (
                                    <span className="playing-indicator">▶ Tocando agora</span>
                                )}
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