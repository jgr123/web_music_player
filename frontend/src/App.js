import React, { useRef, useState, useEffect, useCallback } from 'react';
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
  // NOVOS ESTADOS PARA PLAYLISTS CUSTOMIZADAS
  const [customPlaylists, setCustomPlaylists] = useState([]);
  const [selectedCustomPlaylistId, setSelectedCustomPlaylistId] = useState(null);
  const [showCustomPlaylistSongs, setShowCustomPlaylistSongs] = useState(false); // Flag para mostrar músicas da playlist customizada
  const [customPlaylistSongs, setCustomPlaylistSongs] = useState([]); // Músicas da playlist customizada selecionada

// NOVOS ESTADOS PARA UPLOAD M3U8
  const [m3u8File, setM3u8File] = useState(null);
  const fileInputRef = useRef(null); // Referência para o input de arquivo para limpá-lo
  const [selectedM3u8File, setSelectedM3u8File] = useState(null);

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


  // App.txt - NOVO: Função para determinar a lista de reprodução ativa
const getCurrentActiveList = () => {
  if (showOfflineTracks) {
    return offlineTracks;
  }
  if (favoritesOnly) {
    return favoriteTracks;
  }
  if (showCustomPlaylistSongs) {
    return customPlaylistSongs;
  }
  return playlists; // Retorna a playlist diária (original) como padrão
};

const nextTrack = () => {
  const activeList = getCurrentActiveList(); // Usa a nova função
  if (activeList.length === 0) return;
  let attempts = 0;
  const tryNext = () => {
    let newIndex;
    if (shuffleMode) {
      newIndex = Math.floor(Math.random() * activeList.length);
    } else {
      newIndex = (currentTrackIndex + 1) % activeList.length;
    }

    const nextTrackCandidate = activeList[newIndex];

    // Verifica se a música é válida (tem URL de áudio ou dados de blob para offline)
    if (nextTrackCandidate && (nextTrackCandidate.audio_url || nextTrackCandidate.isOffline)) {
      setCurrentTrackIndex(newIndex);
      setCurrentTrack(nextTrackCandidate);
      setIsPlaying(true);
    } else if (attempts < activeList.length) {
      attempts++;
      // Se a música não for válida, tenta a próxima para evitar loops infinitos com faixas inválidas
      tryNext();
    } else {
      // Se todas as músicas da lista foram tentadas e nenhuma é válida
      setIsPlaying(false);
      setCurrentTrack(null);
    }
  };
  tryNext();
};

const prevTrack = () => {
  const activeList = getCurrentActiveList(); // Usa a nova função
  if (activeList.length === 0) return;

  const newIndex = (currentTrackIndex - 1 + activeList.length) % activeList.length;
  setCurrentTrackIndex(newIndex);
  setCurrentTrack(activeList[newIndex]);
  setIsPlaying(true);
};

  // Extrair fetchCustomPlaylists para que possa ser chamado explicitamente
  const fetchCustomPlaylists = useCallback(async () => {
    try {
      const res = await axios.get('http://170.233.196.50:5202/api/custom-playlists');
      setCustomPlaylists(res.data);
      if (res.data.length > 0 && !selectedCustomPlaylistId) {
        setSelectedCustomPlaylistId(res.data[0].id);
      }
    } catch (err) {
      console.error("Erro ao carregar playlists customizadas:", err);
    }
  }, [selectedCustomPlaylistId]); // Adiciona selectedCustomPlaylistId como dependência

// --- FUNÇÃO PARA LIDAR COM O UPLOAD DO ARQUIVO M3U8 ---
  const handleM3u8Upload = async () => {
    if (!selectedM3u8File) {
      alert("Por favor, selecione um arquivo .m3u8 para upload.");
      return;
    }
    if (!user?.id) {
      alert("Você precisa estar logado para criar playlists.");
      return;
    }

    const formData = new FormData();
    formData.append('m3u8File', selectedM3u8File); // 'm3u8File' deve corresponder ao nome do campo no Multer no backend
    formData.append('userId', user.id); // Envia o ID do usuário logado

    try {
      const response = await axios.post('http://170.233.196.50:5202/api/upload-m3u8', formData, {
        headers: {
          'Content-Type': 'multipart/form-data', // Importante para enviar arquivos
        },
      });
      alert(response.data.message);
      setSelectedM3u8File(null); // Limpa o arquivo selecionado no estado
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Limpa o campo de input de arquivo na UI
      }
      fetchCustomPlaylists(); // Recarrega as playlists customizadas para mostrar a nova
    } catch (error) {
      console.error("Erro ao fazer upload do arquivo .m3u8:", error);
      alert("Erro ao fazer upload do arquivo .m3u8: " + (error.response?.data?.error || error.message || "Erro desconhecido"));
    }
  };

// App.txt - NOVO useEffect para carregar playlists customizadas
useEffect(() => {
  const fetchCustomPlaylists = async () => {
    try {
      const res = await axios.get('http://170.233.196.50:5202/api/custom-playlists');
      setCustomPlaylists(res.data);
      // Opcional: seleciona automaticamente a primeira playlist customizada se houver alguma
      if (res.data.length > 0 && !selectedCustomPlaylistId) {
        setSelectedCustomPlaylistId(res.data[0].id);
      }
    } catch (err) {
      console.error("Erro ao carregar playlists customizadas:", err);
    }
  };
  fetchCustomPlaylists();
}, [selectedCustomPlaylistId]); // Roda uma vez na montagem do componente

// App.txt - NOVO useEffect para carregar as músicas da playlist customizada selecionada
useEffect(() => {
  const fetchCustomPlaylistSongs = async () => {
    if (selectedCustomPlaylistId && showCustomPlaylistSongs) {
      try {
        const res = await axios.get(`http://170.233.196.50:5202/api/custom-playlists/${selectedCustomPlaylistId}/songs`);
        const data = res.data.map(t => ({
          ...t,
          id_musica: t.id_musica ?? t.id // Garante que 'id_musica' esteja sempre presente para o player
        }));
        setCustomPlaylistSongs(data);
        if (data.length > 0 && !currentTrack) {
          setCurrentTrack(data[0]);
          cacheTracks(data.slice(0, 10)); // Cacheia as primeiras músicas da playlist
        }
      } catch (err) {
        console.error("Erro ao carregar músicas da playlist customizada:", err);
      }
    } else if (!showCustomPlaylistSongs) {
      setCustomPlaylistSongs([]); // Limpa a lista se não estiver mostrando playlists customizadas
    }
  };
  fetchCustomPlaylistSongs();
}, [selectedCustomPlaylistId, showCustomPlaylistSongs]); // Depende da playlist selecionada e da flag de exibição


// NOVO useEffect para carregar playlists customizadas (agora usa useCallback)
  useEffect(() => {
    fetchCustomPlaylists();
  }, [fetchCustomPlaylists]); // Adiciona fetchCustomPlaylists como dependência

  // App.txt - NOVO useEffect para carregar as músicas da playlist customizada selecionada
  useEffect(() => {
    const fetchCustomPlaylistSongs = async () => {
      if (selectedCustomPlaylistId && showCustomPlaylistSongs) {
        try {
          const res = await axios.get(`http://170.233.196.50:5202/api/custom-playlists/${selectedCustomPlaylistId}/songs`);
          const data = res.data.map(t => ({
            ...t,
            id_musica: t.id_musica ?? t.id
          }));
          setCustomPlaylistSongs(data);
          if (data.length > 0 && !currentTrack) {
            setCurrentTrack(data[0]);
            cacheTracks(data.slice(0, 10));
          }
        } catch (err) {
          console.error("Erro ao carregar músicas da playlist customizada:", err);
        }
      } else if (!showCustomPlaylistSongs) {
        setCustomPlaylistSongs([]);
      }
    };
    fetchCustomPlaylistSongs();
  }, [selectedCustomPlaylistId, showCustomPlaylistSongs]);

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
    const listToSearch = getCurrentActiveList(); // Use a função auxiliar

    if (listToSearch.length > 0 && currentTrack) {  // Encontra a música atual na lista ativa, usando id ou id_musica
    const index = listToSearch.findIndex(t =>
      (t.id && currentTrack.id && t.id.toString() === currentTrack.id.toString()) ||
      (t.id_musica && currentTrack.id_musica && t.id_musica.toString() === currentTrack.id_musica.toString())
    );

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
  }, [currentTrack, playlists, favoriteTracks, offlineTracks, customPlaylistSongs, showOfflineTracks, favoritesOnly, showCustomPlaylistSongs]);
// Adicione todas as novas dependências

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
{/* --- NOVO BLOCO PARA UPLOAD DE M3U8 --- */}
        <div className="m3u8-upload-section" style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc', borderRadius: '8px' }}>
          <h3>Importar Playlist (.m3u8)</h3>
          <input
            type="file"
            accept=".m3u8"
            onChange={(e) => setSelectedM3u8File(e.target.files[0])}
            ref={fileInputRef} // Anexa a referência para limpar o input
            style={{ marginBottom: '10px', display: 'block' }}
          />
          <button
            onClick={handleM3u8Upload}
            disabled={!user?.id || !selectedM3u8File} // Desabilita se não estiver logado ou nenhum arquivo selecionado
            style={{ padding: '8px 15px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            Carregar Playlist
          </button>
          {!user?.id && <p style={{ color: 'red', fontSize: '0.9em' }}>Faça login para importar playlists.</p>}
        </div>
        {/* --- FIM DO NOVO BLOCO PARA UPLOAD DE M3U8 --- */}



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
      {/* NOVOS CONTROLES PARA PLAYLISTS CUSTOMIZADAS */}
        {customPlaylists.length > 0 && (
          <>
            <select
              value={selectedCustomPlaylistId || ''}
              onChange={(e) => {
                setSelectedCustomPlaylistId(e.target.value);
                // Quando seleciona uma custom playlist, ativa sua visualização e desativa outros modos
                setShowCustomPlaylistSongs(true);
                setFavoritesOnly(false);
                setShowOfflineTracks(false);
              }}
              // Desativa se não há playlists customizadas para selecionar
              disabled={customPlaylists.length === 0}
            >
              <option value="">Selecione uma Playlist Customizada</option>
              {customPlaylists.map(playlist => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setShowCustomPlaylistSongs(!showCustomPlaylistSongs);
                // Se alterna a visualização da playlist customizada, desativa outros modos
                if (!showCustomPlaylistSongs) {
                  setFavoritesOnly(false);
                  setShowOfflineTracks(false);
                  // Se não houver playlist selecionada, mas há playlists customizadas, seleciona a primeira
                  if (selectedCustomPlaylistId === null && customPlaylists.length > 0) {
                    setSelectedCustomPlaylistId(customPlaylists[0].id);
                  }
                }
              }}
              className={showCustomPlaylistSongs ? 'active' : ''}
              disabled={customPlaylists.length === 0} // Desativa se não há playlists customizadas
            >
              {showCustomPlaylistSongs ? "Ocultar Playlists Customizadas" : "Mostrar Playlists Customizadas"}
            </button>
          </>
        )}

      </div>

      {/* App.txt - Dentro da div "playlist" */}
      <div className="playlist">
        <h2>
          {showOfflineTracks
            ? "Músicas Offline"
            : favoritesOnly
            ? "Favoritas"
            : showCustomPlaylistSongs // NOVA CONDIÇÃO
            ? `Playlist: ${customPlaylists.find(p => p.id == selectedCustomPlaylistId)?.name || 'Carregando...'}`
            : `Playlist (${selectedDate})` // Padrão: playlist diária do rádio
          }
        </h2>

        {showOfflineTracks ? (
          /* ... Lista de músicas offline (código existente) ... */
          offlineTracks.length > 0 ? (
            <ul>
              {offlineTracks.map((track, index) => (
                <li
                  key={track.id}
                  onClick={() => {
                    const trackToPlay = {
                      ...track,
                      id: track.id.toString(), // Garante string
                      id_musica: track.id_musica || track.id.toString() // Fallback
                    };
                    setCurrentTrack(trackToPlay);
                    setCurrentTrackIndex(index);
                    setIsPlaying(true);
                  }}
                  style={{ backgroundColor: (currentTrack?.id === track.id) ? '#e3f2fd' : 'transparent' }}
                >
                  <strong>{track.nome_cantor_musica_hunterfm}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma música disponível offline.</p>
          )
        ) : favoritesOnly ? ( // CONDIÇÃO PARA FAVORITAS (poderia ser o original filteredPlaylists, mas explícito é mais claro)
          favoriteTracks.length > 0 ? (
            <ul>
              {favoriteTracks.map((track, index) => (
                <li
                  key={track.id}
                  onClick={() => {
                    setCurrentTrack(track);
                    setCurrentTrackIndex(index);
                    setIsPlaying(true);
                    if (!track.isOffline) { // Se não for uma música offline já, cacheie
                      // Como favoritesOnly é uma lista filtrada, talvez você queira cachear do original playlists
                      // Ou, apenas ignore o cache aqui, já que são favoritas.
                      // Para o exemplo, vamos supor que você não quer cachear favoritas automaticamente, a menos que venham da playlist principal.
                      // Ou, você pode cachear as favoritas também, o que é uma boa ideia.
                      // cacheTracks(favoriteTracks.slice(index, index + 10));
                    }
                  }}
                  style={{ backgroundColor: (currentTrack?.id === track.id) ? '#e3f2fd' : 'transparent' }}
                >
                  <strong>{track.nome_cantor_musica_hunterfm}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma música favorita encontrada.</p>
          )
        ) : showCustomPlaylistSongs ? ( // NOVA CONDIÇÃO PARA PLAYLISTS CUSTOMIZADAS
          customPlaylistSongs.length > 0 ? (
            <ul>
              {customPlaylistSongs.map((track, index) => (
                <li
                  key={track.id}
                  className={`${track.audio_url.length < 35 ? 'no-audio' : ''}`}
                  onClick={() => {
                    setCurrentTrack(track);
                    setCurrentTrackIndex(index);
                    setIsPlaying(true);
                    // Cacheia as músicas da playlist customizada, se não forem já offline
                    if (!track.isOffline) {
                      cacheTracks(customPlaylistSongs.slice(index, index + 10));
                    }
                  }}
                  style={{ backgroundColor: (currentTrack?.id === track.id) ? '#e3f2fd' : 'transparent' }}
                >
                  <strong>{track.nome_cantor_musica_hunterfm}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma música encontrada nesta playlist customizada.</p>
          )
        ) : (
          /* Lista normal de músicas (online do rádio diário) */
          /* Note: 'filteredPlaylists' no seu código original era (favoritesOnly ? favoriteTracks : playlists). */
          /* Agora, como favoritesOnly tem sua própria condição, esta seção é apenas para 'playlists' (rádio diário). */
          playlists.length > 0 ? (
            <ul>
              {playlists.map((track, index) => (
                <li
                  key={track.id}
                  className={`${track.audio_url.length < 35 ? 'no-audio' : ''}`}
                  onClick={() => {
                    setCurrentTrack(track);
                    setCurrentTrackIndex(index);
                    setIsPlaying(true);
                    if (!track.isOffline) { // Se não for uma música offline já, cacheie
                      cacheTracks(playlists.slice(index, index + 10));
                    }
                  }}
                  style={{ backgroundColor: (currentTrack?.id === track.id) ? '#e3f2fd' : 'transparent' }}
                >
                  <span className="time">{track.horario} - </span>
                  <strong>{track.nome_cantor_musica_hunterfm}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma música encontrada para a data/rádio selecionada.</p>
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