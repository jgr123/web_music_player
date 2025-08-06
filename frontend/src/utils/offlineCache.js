// utils/offlineCache.js
const DB_NAME = 'PlayerCache';
const STORE_NAME = 'musicas';

export async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function saveTrack(id, blob) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(blob, id);
  return tx.complete;
}

export async function getTrack(id) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function cacheTracks(tracks) {
  for (let track of tracks) {
    if (!track?.audio_url) continue;
    const exists = await getTrack(track.id);
    if (!exists) {
      try {
        const res = await fetch(track.audio_url);
        const blob = await res.blob();
        await saveTrack(track.id, blob);
        console.log(`🎵 Música ${track.nome_cantor_musica_hunterfm} salva offline`);
      } catch (err) {
        console.error('Erro ao salvar música offline:', err);
      }
    }
  }
}
