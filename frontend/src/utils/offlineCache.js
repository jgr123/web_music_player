// utils/offlineCache.js
const DB_NAME = 'PlayerCache';
const STORE_NAME = 'musicas';

export async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2); // Versão incrementada
//    req.deleteDatabase(DB_NAME);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Cria a store com keyPath explícito
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_metadata', 'metadata');
      }
    };
    
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function saveTrack(id, blob, metadata = {}) {
  if (!(blob instanceof Blob)) {
    console.error('Tentativa de salvar blob inválido:', blob);
    return false;
  }
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  
  const data = {
    id: id.toString(), // Garante que o ID é string
    blob,
    metadata: {
      ...metadata,
      cachedAt: new Date().toISOString()
    }
  };
  
  tx.objectStore(STORE_NAME).put(data);
  return tx.complete;
}

export async function getTrack(id) {
  if (!id) {
    console.warn("Tentativa de acessar track sem ID");
    return null;
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id.toString());
      
      req.onsuccess = () => {
        if (req.result) {
          console.log("Track encontrada no IndexedDB:", req.result);
          resolve(req.result);
        } else {
          console.log("Track não encontrada no IndexedDB para ID:", id);
          resolve(null);
        }
      };
      
      req.onerror = (e) => {
        console.error("Erro no IndexedDB:", e.target.error);
        resolve(null);
      };
    });
  } catch (err) {
    console.error("Erro ao acessar IndexedDB:", err);
    return null;
  }
}

export async function cacheTracks(tracks) {
  for (let track of tracks) {
    if (!track?.id || !track.audio_url) {
      console.warn("Track inválida para cache:", track);
      continue;
    }

    const trackId = track.id.toString(); // Garante ID como string
    try {
      const exists = await getTrack(trackId);
      if (!exists) {
        const res = await fetch(track.audio_url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (!(blob instanceof Blob)) {
          throw new Error('Resposta não é um Blob válido');
        }
        await saveTrack(trackId, blob, {
          nome_cantor_musica_hunterfm: track.nome_cantor_musica_hunterfm,
          originalUrl: track.audio_url
        });
      }
    } catch (err) {
      console.error(`Erro ao cachear track ${trackId}:`, err);
    }
  }
}

export const getCachedTracks = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      
      req.onsuccess = () => {
        const tracks = req.result.map(item => ({
          id: item.id,
          id_musica: item.id, // Para compatibilidade
          audio_url: URL.createObjectURL(item.blob),
          nome_cantor_musica_hunterfm: item.metadata.nome_cantor_musica_hunterfm || `Música ${item.id}`,
          isOffline: true,
          metadata: item.metadata
        }));
        
        console.log("Músicas recuperadas do cache:", tracks);
        resolve(tracks);
      };
      
      req.onerror = () => {
        console.warn("Erro ao recuperar músicas do cache");
        resolve([]);
      };
    });
  } catch (err) {
    console.error("Erro fatal ao acessar IndexedDB:", err);
    return [];
  }
};

// NOVO: Função para remover uma track específica pelo ID
export async function removeTrack(id) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.delete(id.toString()); // Garante que o ID é string para a remoção

    request.onsuccess = () => {
      console.log(`Track ${id} removida do cache.`);
      resolve();
    };
    request.onerror = (event) => {
      console.error(`Erro ao remover track ${id}:`, event.target.error);
      reject(event.target.error);
    };
  });
}

// NOVO: Função para limpar todas as tracks do cache
export async function clearAllTracks() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.clear();

    request.onsuccess = () => {
      console.log("Todas as tracks foram limpas do cache.");
      resolve();
    };
    request.onerror = (event) => {
      console.error("Erro ao limpar todas as tracks:", event.target.error);
      reject(event.target.error);
    };
  });
}