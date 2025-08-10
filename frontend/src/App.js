import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import PlayerControls from './components/PlayerControls';
import './App.css';
import { cacheTracks, getCachedTracks } from './utils/offlineCache'; // Importe a função getCachedTracks
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
  const [user, setUser] = useState(null);
  const [offlineTracks, setOfflineTracks] = useState([]); // Novo estado para músicas offline
  const [showOfflineTracks, setShowOfflineTracks] = useState(false); // Estado para controlar a exibição


  const userId = user?.id;
  const activeItemRef = useRef(null);
  const isOnline = useNetworkStatus();

// Função para carregar músicas offline do cache
const loadOfflineTracks = async () => {
  try {
    const cachedData = await getCachedTracks();
    const offlineTracksWithUrls = cachedData.map(track => ({
      ...track,
      // Marca como offline para o player saber como tratar
      isOffline: true
    }));
    setOfflineTracks(offlineTracksWithUrls);
  } catch (err) {
    console.error("Erro ao carregar músicas offline:", err);
  }
};

  // Carregar músicas offline quando o componente montar ou quando o usuário mudar
  useEffect(() => {
    if (user) {
      loadOfflineTracks();
    }
  }, [user]);

useEffect(() => {
  const checkCache = async () => {
    const tracks = await getCachedTracks();
    console.log("Conteúdo atual do cache:", tracks);
  };
  checkCache();
}, []);

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
  const activeList = showOfflineTracks ? offlineTracks : filteredPlaylists;
  if (activeList.length === 0) return;
  let attempts = 0;
  const tryNext = () => {
    let newIndex;
    if (shuffleMode) {
      newIndex = Math.floor(Math.random() * activeList.length);
    } else {
      newIndex = (currentTrackIndex + 1) % activeList.length;
    }
    
    const nextTrack = activeList[newIndex];
    
    if (nextTrack && (nextTrack.audio_url || nextTrack.blobData)) {
      setCurrentTrackIndex(newIndex);
      setCurrentTrack(nextTrack);
      setIsPlaying(true);
    } else if (attempts < activeList.length) {
      attempts++;
      setTimeout(tryNext, 100);
    } else {
      setIsPlaying(false);
    }
  };

  tryNext();
};

  const prevTrack = () => {
  //  const activeList = filteredPlaylists;
    const activeList = showOfflineTracks ? offlineTracks : filteredPlaylists; // <-- NOVA LINHA
    if (activeList.length === 0) return;

    const newIndex = (currentTrackIndex - 1 + activeList.length) % activeList.length;
    setCurrentTrackIndex(newIndex);
    setCurrentTrack(activeList[newIndex]);
    setIsPlaying(true);
  };

  // manter estado do login
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

useEffect(() => {
  console.log('Músicas offline:', offlineTracks);
}, [offlineTracks]);

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

  // App.txt (NOVO BLOCO - Sincronização correta do índice da música)
  useEffect(() => {
    // A lista a ser pesquisada deve depender do modo atual (online/favoritas ou offline)
    const listToSearch = showOfflineTracks ? offlineTracks : filteredPlaylists;

    if (listToSearch.length > 0 && currentTrack) {
      const index = listToSearch.findIndex(t => t.id === currentTrack.id || t.id_musica === currentTrack.id);

      // Se a música atual for encontrada na lista correta, atualize o índice
      if (index >= 0) {
        // Apenas atualize se o índice for diferente para evitar re-renderizações desnecessárias
        if (currentTrackIndex !== index) {
          setCurrentTrackIndex(index);
          console.log(`Debug: currentTrackIndex atualizado para ${index} na lista ativa.`);
        }
      } else {
        // Se a música atual NÃO for encontrada na lista (ex: trocou de online para offline e a música não existe na lista offline),
        // ou se o ID não corresponde, podemos querer resetar o índice para 0 e ir para a primeira música da nova lista.
        console.warn("Debug: Música atual não encontrada na lista ativa. Resetando para a primeira música da lista.");
        setCurrentTrackIndex(0);
        setCurrentTrack(listToSearch[0] || null); // Definir para a primeira música da lista, ou null se vazia
      }
    } else if (listToSearch.length > 0 && !currentTrack) {
        // Cenário: A lista tem músicas, mas currentTrack ainda não foi definido (ex: primeira carga da lista offline)
        // Define a primeira música da lista como a atual.
        console.log("Debug: Lista ativa populada, mas currentTrack não definido. Configurando a primeira música.");
        setCurrentTrackIndex(0);
        setCurrentTrack(listToSearch[0]);
    }
  }, [currentTrack, filteredPlaylists, offlineTracks, showOfflineTracks]); // IMPORTANTE: Adicione todas as dependências relevantes aqui!

  const handleToggleFavorites = () => {
    const newState = !favoritesOnly;
    setFavoritesOnly(newState);
    if (newState) {
      fetchFavorites();
    }
  };


  if (!user) {
    return (
      <div className="login-form">
        <h2>Login</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const username = e.target.username.value;
          const password = e.target.password.value;
          try {
            const res = await axios.post('http://170.233.196.50:5202/api/login', { username, password });
            setUser(res.data);
            localStorage.setItem('user', JSON.stringify(res.data));
          } catch (err) {
            alert("Erro no login: " + err.response?.data?.error);
          }
        }}>
          <input name="username" placeholder="Usuário" required />
          <input name="password" type="password" placeholder="Senha" required />
          <button type="submit">Entrar</button>
        </form>
        <p>Ou registre-se:</p>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const username = e.target.username.value;
          const password = e.target.password.value;
          try {
            await axios.post('http://170.233.196.50:5202/api/register', { username, password });
            alert("Usuário criado com sucesso. Faça o login.");
          } catch (err) {
            alert("Erro no registro: " + err.response?.data?.error);
          }
        }}>
          <input name="username" placeholder="Novo usuário" required />
          <input name="password" type="password" placeholder="Senha" required />
          <button type="submit">Registrar</button>
        </form>
      </div>
    );
  }


return (
    <div className="app-container">
      <h1>Music Player</h1>
      <p>Usuário logado: {user.username}</p>
      <button
        onClick={() => {
          setUser(null);
          localStorage.removeItem('user');
        }}    
      >
        Sair
      </button>

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

        {/* Botão para mostrar/ocultar músicas offline */}
        <button 
          onClick={() => {
            setShowOfflineTracks(!showOfflineTracks);
            if (!showOfflineTracks) {
              loadOfflineTracks();
            }
          }}
          className={showOfflineTracks ? 'active' : ''}
        >
          {showOfflineTracks ? "Mostrar todas" : "Mostrar offline"}
        </button>
      </div>

      {/* Playlist principal (código existente) */}
      <div className="playlist">
        <h2>{showOfflineTracks ? "Músicas Offline" : `Playlist (${favoritesOnly ? "Favoritas" : selectedDate})`}</h2>
        
        {showOfflineTracks ? (
          /* Lista de músicas offline */
          offlineTracks.length > 0 ? (
            <ul>
              {offlineTracks.map((track, index) => (
                <li
                  key={track.id}
                  // No mapeamento das músicas offline
                  onClick={() => {
                    if (!track?.id) {
                      console.error("Música inválida - sem ID:", track);
                      return;
                    }

                    const trackToPlay = {
                      ...track,
                      id: track.id.toString(), // Garante string
                      id_musica: track.id_musica || track.id.toString() // Fallback
                    };

                    console.log("Reproduzindo track:", trackToPlay); // Debug

                    setCurrentTrack(trackToPlay);
                    setCurrentTrackIndex(index);
                    setIsPlaying(true);
                  }}
                  style={{ 
                    backgroundColor: (currentTrack?.id === track.id) ? '#e3f2fd' : 'transparent' 
                  }}
                >
                  <strong>{track.nome_cantor_musica_hunterfm}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma música disponível offline.</p>
          )
        ) : (
          /* Lista normal de músicas (online) */
          filteredPlaylists.length > 0 ? (
            <ul>
              {filteredPlaylists.map((track, index) => (
                <li
                  key={track.id}
                  onClick={() => {
                    setCurrentTrack(track);
                    setCurrentTrackIndex(index);
                    setIsPlaying(true);
                    cacheTracks(filteredPlaylists.slice(index, index + 10));
                  }}
                  style={{ 
                    backgroundColor: (currentTrack?.id === track.id) ? '#e3f2fd' : 'transparent' 
                  }}
                >
                  {!favoritesOnly && <span className="time">{track.horario} - </span>}
                  <strong>{track.nome_cantor_musica_hunterfm}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma música encontrada.</p>
          )
        )}
      </div>

      {currentTrack && (
        <PlayerControls
          track={currentTrack}
          isPlaying={isPlaying}
          onPlayPause={setIsPlaying}
          showOfflineTracks={showOfflineTracks}
          onNext={nextTrack}
          onPrev={prevTrack}
          shuffleMode={shuffleMode}
          toggleShuffle={() => setShuffleMode(!shuffleMode)}
          user={user}
        />
      )}
    </div>
  );
}

export default App;