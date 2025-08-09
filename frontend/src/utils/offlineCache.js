// utils/offlineCache.js
const DB_NAME = 'PlayerCache';
const STORE_NAME = 'musicas';

export async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2); // Versão incrementada
    
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
        const blob = await res.blob();
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