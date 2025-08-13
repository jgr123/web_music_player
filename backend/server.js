const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer'); // Importa Multer para lidar com upload de arquivos
const fs = require('fs-extra');   // Importa fs-extra para operações de sistema de arquivos (copy, pathExists)
const path = require('path');     // Importa Path para manipular caminhos de arquivos
const glob = require('fast-glob'); // Importa Fast-Glob para busca recursiva de arquivos

const app = express();
app.use(cors());
app.use(express.json());
//const PORT = 5000;
const PORT = 5202;

// Configura o multer para armazenar arquivos temporariamente no diretório 'uploads/'
const upload = multer({ dest: 'uploads/' });

// --- Definição dos diretórios para gerenciamento de músicas ---
// Caminho de destino onde as músicas devem estar para serem acessíveis pelo player
const MUSIC_DEST_DIR = 'D:\Downloads\wpp-node\radio-player\frontend\public\music';
// Caminho base onde o servidor irá procurar as músicas caso não estejam no diretório de destino
const MUSIC_SEARCH_BASE_DIR = 'D:\deezer-downloader\playlists';

// --- Função Auxiliar: Encontrar e Copiar Arquivo de Música ---
/**
 * Verifica se um arquivo de música existe no diretório de destino.
 * Se não existir, tenta encontrá-lo recursivamente no diretório de busca e copiá-lo.
 * @param {string} fileName O nome completo do arquivo de música (e.g., "Artista - Nome da Musica.mp3").
 * @returns {Promise<boolean>} True se o arquivo foi encontrado/copiado com sucesso, false caso contrário.
 */
async function findAndCopyMusicFile(fileName) {
  const targetPath = path.join(MUSIC_DEST_DIR, fileName);

  // 1. Verifica se o arquivo já existe no diretório de destino
  if (await fs.pathExists(targetPath)) {
    console.log(`🎵 Arquivo '${fileName}' já existe em '${MUSIC_DEST_DIR}'.`);
    return true; // Arquivo já existe, nada a fazer
  }

  // 2. Se não existe no destino, procura recursivamente no diretório de busca
  console.log(`🔍 Procurando '${fileName}' em '${MUSIC_SEARCH_BASE_DIR}'...`);
  try {
    // Usa fast-glob para buscar o arquivo recursivamente
    const entries = await glob(`**/${fileName}`, { cwd: MUSIC_SEARCH_BASE_DIR, unique: true });

    if (entries.length > 0) {
      const sourcePath = path.join(MUSIC_SEARCH_BASE_DIR, entries[0]); // Pega o primeiro resultado
      console.log(`✅ Arquivo '${fileName}' encontrado em '${sourcePath}'. Copiando para '${MUSIC_DEST_DIR}'...`);
      await fs.copy(sourcePath, targetPath); // Copia o arquivo
      console.log(`👍 Arquivo '${fileName}' copiado com sucesso!`);
      return true;
    } else {
      console.warn(`⚠️ Arquivo '${fileName}' NÃO encontrado em '${MUSIC_SEARCH_BASE_DIR}' ou subdiretórios.`);
      return false;
    }
  } catch (searchOrCopyErr) {
    console.error(`❌ Erro ao procurar ou copiar o arquivo '${fileName}':`, searchOrCopyErr);
    return false;
  }
}

// Conecta ao banco de dados SQLite
//const db = new sqlite3.Database('./musicas_hunterfm.db', sqlite3.OPEN_READONLY, (err) => {
const db = new sqlite3.Database('./musicas_hunterfm.db', sqlite3.READWRITE, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
    } else {
        console.log('Conectado ao banco de dados SQLite');
    }
});

// server.js - Rota ajustada
app.get('/api/playlists', (req, res) => {
    const { id_radio_hunter, data } = req.query;
    
    // Converte a data para o formato YYYY/MM/DD
    const formattedDate = data.replace(/-/g, '/');
    
    db.all(
        `SELECT m.id_musica_data_horario as id, m.id_musica, m.horario, mu.nome_cantor_musica_hunterfm, concat("http://170.233.196.50:3000/music/", mu.arquivo) as audio_url
         FROM musica_data_horario m
         JOIN data_tocou d USING (id_data_tocou)
         JOIN musica mu USING (id_musica)
         WHERE m.id_radio_hunter = ? 
         AND d.data_tocou = ?
         ORDER BY m.horario`,
        [id_radio_hunter, formattedDate],
        (err, rows) => {
    console.log(id_radio_hunter);
    console.log(data);
    console.log(rows);
            if (err) {
                console.error("Erro na consulta:", err);
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

// Adicione estas novas rotas para o sistema de likes

app.post('/api/rate', (req, res) => {
  const { user_id, id_musica, rating } = req.body;
  console.log(req.body);
  const query = `
    INSERT INTO music_ratings (user_id, id_musica, rating)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, id_musica)
    DO UPDATE SET rating = excluded.rating
  `;

  db.run(query, [user_id, id_musica, rating], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Rating inserido/atualizado com sucesso' });
  });
});

app.get('/api/ratings/:user_id', (req, res) => {
  const { user_id } = req.params;
  db.all(
    `SELECT id_musica, rating FROM music_ratings WHERE user_id = ?`,
    [user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});


app.get('/api/favorites/:user_id', (req, res) => {
  const { user_id } = req.params;
  console.log("Chegou aqui /api/favorites/:user_id");  
  console.log(req.body);
  db.all(
    `SELECT mu.id_musica as id,
            mu.id_musica, 
            mu.nome_cantor_musica_hunterfm, 
            r.rating,
            concat("http://170.233.196.50:3000/music/", mu.arquivo) as audio_url
     FROM music_ratings r
     JOIN musica mu ON r.id_musica = mu.id_musica
     WHERE r.user_id = ? AND r.rating = 1`,
    [user_id],
    (err, rows) => {
      console.log(rows);
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Criação da tabela de usuários se não existir
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )
`);

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  db.run(
    `INSERT INTO users (username, password) VALUES (?, ?)`,
    [username, password],
    function (err) {
      if (err) {
        return res.status(400).json({ error: 'Usuário já existe.' });
      }
      res.json({ id: this.lastID, username });
    }
  );
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get(
    `SELECT * FROM users WHERE username = ? AND password = ?`,
    [username, password],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(401).json({ error: 'Credenciais inválidas' });
      res.json({ id: row.id, username: row.username });
    }
  );
});

app.get('/api/users', (req, res) => {
  db.all(`SELECT id, username FROM users`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Favoritos de qualquer usuário
app.get('/api/favorites/user/:target_user_id', (req, res) => {
  const { target_user_id } = req.params;    
  console.log("Chegou aqui /api/favorites/user/:target_user_id");  
  console.log(req.body);
  db.all(
    `SELECT mu.id_musica as id,
            mu.id_musica, 
            mu.nome_cantor_musica_hunterfm, 
            r.rating,
            concat("http://170.233.196.50:3000/music/", mu.arquivo) as audio_url
     FROM music_ratings r
     JOIN musica mu ON r.id_musica = mu.id_musica
     WHERE r.user_id = ? AND r.rating = 1`,
    [target_user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});



// server.txt - Rota para criar uma nova playlist customizada
app.post('/api/custom-playlists', (req, res) => {
  const { name, description, created_by } = req.body;
  if (!name || !created_by) {
    return res.status(400).json({ error: 'Nome da playlist e ID do criador são obrigatórios.' });
  }
  db.run(
    `INSERT INTO custom_playlists (name, description, created_by) VALUES (?, ?, ?)`,
    [name, description, created_by],
    function (err) {
      if (err) {
        console.error("Erro ao criar playlist:", err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, name, description, created_by });
    }
  );
});

// server.txt - Rota para adicionar músicas a uma playlist customizada
app.post('/api/custom-playlists/:playlist_id/add-songs', (req, res) => {
  const { playlist_id } = req.params;
  const { musica_ids } = req.body; // Espera um array de IDs de músicas

  if (!musica_ids || !Array.isArray(musica_ids) || musica_ids.length === 0) {
    return res.status(400).json({ error: 'Lista de IDs de música vazia ou inválida.' });
  }

  db.serialize(() => { // Usamos serialize para garantir que as operações ocorram em sequência (quase como uma transação)
    db.run("BEGIN TRANSACTION;");
    let successCount = 0;
    let errorCount = 0;
    let currentOrder = 0; // Inicia a ordem

    // Busca a maior ordem existente na playlist para continuar a numeração
    db.get(`SELECT MAX(order_in_playlist) as max_order FROM custom_playlist_songs WHERE playlist_id = ?`, [playlist_id], (err, row) => {
      if (row && row.max_order !== null) {
        currentOrder = row.max_order + 1;
      }

      const stmt = db.prepare(`INSERT OR IGNORE INTO custom_playlist_songs (playlist_id, musica_id, order_in_playlist) VALUES (?, ?, ?)`);
      musica_ids.forEach(musica_id => {
        stmt.run(playlist_id, musica_id, currentOrder++, function(err) {
          if (err) {
            console.error(`Erro ao adicionar música ${musica_id} à playlist ${playlist_id}:`, err);
            errorCount++;
          } else if (this.changes > 0) { // Se uma linha foi realmente inserida (não era duplicata)
            successCount++;
          }
        });
      });
      stmt.finalize(() => { // Finaliza o statement depois de todas as inserções
        db.run("COMMIT;", (err) => { // Comita a transação
          if (err) {
            console.error("Erro ao comitar transação:", err);
            return res.status(500).json({ error: err.message });
          }
          res.json({ message: `Adicionadas ${successCount} músicas à playlist. ${errorCount} erros/duplicatas (músicas já existentes na playlist).` });
        });
      });
    });
  });
});

// server.txt - Rota para buscar todas as playlists customizadas
app.get('/api/custom-playlists', (req, res) => {
  db.all(`SELECT id, name, description FROM custom_playlists`, (err, rows) => {
    if (err) {
      console.error("Erro ao buscar playlists customizadas:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// server.txt - Rota para buscar as músicas de uma playlist customizada específica
app.get('/api/custom-playlists/:playlist_id/songs', (req, res) => {
  const { playlist_id } = req.params;
  db.all(
    `SELECT m.id_musica as id,
            m.id_musica,
            m.nome_cantor_musica_hunterfm,
            concat("http://170.233.196.50:3000/music/", m.arquivo) as audio_url
     FROM custom_playlist_songs cps
     JOIN musica m ON cps.musica_id = m.id_musica
     WHERE cps.playlist_id = ?
     ORDER BY cps.order_in_playlist`,
    [playlist_id],
    (err, rows) => {
      if (err) {
        console.error("Erro ao buscar músicas da playlist customizada:", err);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});


// server.js - NOVA ROTA para upload de arquivos M3U8
app.post('/api/upload-m3u8', upload.single('m3u8file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo .m3u8 enviado.' });
    }

    const m3u8FilePath = req.file.path;
    // O nome da playlist será o nome do arquivo, removendo a extensão .m3u8
    const playlistName = req.file.originalname.replace(/\.m3u8$/i, '');
    const userId = req.body.user_id; // Recebe o ID do usuário logado do frontend

    if (!userId) {
        fs.unlinkSync(m3u8FilePath); // Limpa o arquivo temporário
        return res.status(400).json({ error: 'ID do usuário não fornecido. Faça login para criar playlists.' });
    }

    // Usa db.serialize() para garantir que as operações do banco de dados ocorram em sequência (similar a uma transação)
    db.serialize(() => {
        db.run("BEGIN TRANSACTION;"); // Inicia uma transação para garantir atomicidade

        // 1. Insere a nova playlist customizada na tabela 'custom_playlists'
        db.run(
            `INSERT INTO custom_playlists (name, created_by) VALUES (?, ?)`,
            [playlistName, userId],
            function (err) {
                if (err) {
                    db.run("ROLLBACK;"); // Reverte a transação em caso de erro
                    fs.unlinkSync(m3u8FilePath); // Limpa o arquivo temporário
                    console.error("Erro ao criar playlist customizada:", err);
                    return res.status(500).json({ error: 'Erro ao criar playlist: ' + err.message });
                }

                const playlistId = this.lastID; // ID da playlist recém-criada
                let orderInPlaylist = 0; // Para manter a ordem das músicas na playlist

                try {
                    // 2. Lê o conteúdo do arquivo .m3u8
                    const m3u8Content = fs.readFileSync(m3u8FilePath, 'utf8');
                    // Filtra linhas vazias e linhas de comentário/diretiva M3U8 (que começam com '#')
                    const lines = m3u8Content.split(/\r?\n/).filter(line => line.trim() !== '' && !line.startsWith('#'));

                    // Prepara statements para inserções otimizadas
                    const stmtMusica = db.prepare(`INSERT INTO musica (id_cantor, nome_musica, nome_cantor_musica_hunterfm, arquivo) VALUES (?, ?, ?, ?)`);
                    const stmtPlaylistSong = db.prepare(`INSERT OR IGNORE INTO custom_playlist_songs (playlist_id, musica_id, order_in_playlist) VALUES (?, ?, ?)`); // INSERT OR IGNORE para evitar duplicatas
                    const stmtCantor = db.prepare(`INSERT INTO cantor (nome_cantor) VALUES (?)`);

                    let processedSongsCount = 0;

                    // Função assíncrona para processar cada linha (música) do arquivo .m3u8
                    const processLine = (line) => {
                        return new Promise((resolve, reject) => {
                            const fileNameWithExt = line.trim(); // Ex: "Cantor - Nome da musica.mp3"
                            if (!fileNameWithExt.endsWith('.mp3')) {
                                console.warn(`Linha ignorada no .m3u8 (não termina com .mp3): ${line}`);
                                return resolve(); // Ignora linhas que não são arquivos .mp3
                            }

                            const fileNameWithoutExt = fileNameWithExt.replace(/\.mp3$/i, ''); // Ex: "Cantor - Nome da musica"
                            const parts = fileNameWithoutExt.split(' - ');
                            let artistName = 'Artista Desconhecido';
                            let songName = fileNameWithoutExt;

                            if (parts.length >= 2) {
                                artistName = parts[0].trim();
                                songName = parts.slice(1).join(' - ').trim(); // Recompõe o nome da música caso tenha " - "
                            } else {
                                songName = fileNameWithoutExt; // Se não houver " - ", a linha toda é o nome da música
                            }

                            let cantorId;
                            let musicaId;

                            // Verifica e insere o cantor
                            db.get(`SELECT id_cantor FROM cantor WHERE nome_cantor = ?`, [artistName], (err, row) => {
                                if (err) { return reject(err); }

                                if (row) {
                                    cantorId = row.id_cantor;
                                    checkAndInsertMusica();
                                } else {
                                    // Insere um novo cantor
                                    stmtCantor.run(artistName, function(err) {
                                        if (err) { return reject(err); }
                                        cantorId = this.lastID; // Pega o ID do cantor recém-inserido
                                        checkAndInsertMusica();
                                    });
                                }
                            });

                            // Verifica e insere a música
                            const checkAndInsertMusica = () => {
                                db.get(`SELECT id_musica FROM musica WHERE nome_musica = ? AND id_cantor = ?`, [songName, cantorId], (err, row) => {
                                    if (err) { return reject(err); }

                                    if (row) {
                                        musicaId = row.id_musica;
                                        insertPlaylistSong();
                                    } else {
                                        // Insere uma nova música
                                        stmtMusica.run(cantorId, songName, fileNameWithoutExt, fileNameWithExt, function(err) {
                                            if (err) { return reject(err); }
                                            musicaId = this.lastID; // Pega o ID da música recém-inserida
                                            insertPlaylistSong();
                                        });
                                    }
                                });
                            };

                            // Insere a associação música-playlist
                            const insertPlaylistSong = () => {
                                stmtPlaylistSong.run(playlistId, musicaId, orderInPlaylist++, function(err) {
                                    if (err) { return reject(err); }
                                    if (this.changes > 0) { // Verifica se a linha foi realmente inserida (não ignorada)
                                        processedSongsCount++;
                                    }
                                    resolve();
                                });
                            };
                        });
                    };

                    // Processa todas as linhas sequencialmente para garantir a ordem e IDs corretos
                    const processAllLines = async () => {
                        for (const line of lines) {
                            await processLine(line).catch(e => {
                                console.error(`Erro ao processar linha '${line}' (continuando para a próxima):`, e);
                                // A transação pode ser revertida aqui, ou podemos optar por continuar e logar o erro
                                // Neste caso, optamos por logar e continuar, mas uma falha completa pode ser desejável dependendo da regra de negócio.
                            });
                        }

                        // Finaliza os statements preparados
                        stmtMusica.finalize();
                        stmtPlaylistSong.finalize();
                        stmtCantor.finalize();

                        // Comita a transação se tudo deu certo
                        db.run("COMMIT;", (err) => {
                            if (err) {
                                db.run("ROLLBACK;");
                                console.error("Erro ao comitar transação:", err);
                                return res.status(500).json({ error: 'Erro ao finalizar a criação da playlist: ' + err.message });
                            }
                            fs.unlinkSync(m3u8FilePath); // Limpa o arquivo temporário
                            res.json({ message: `Playlist "${playlistName}" criada com sucesso com ${processedSongsCount} música(s).`, playlistId: playlistId });
                        });
                    };

                    processAllLines(); // Inicia o processamento

                } catch (readErr) {
                    db.run("ROLLBACK;"); // Reverte a transação se houver erro na leitura do arquivo
                    fs.unlinkSync(m3u8FilePath); // Limpa o arquivo temporário
                    console.error("Erro ao ler arquivo .m3u8:", readErr);
                    return res.status(500).json({ error: 'Erro ao ler arquivo .m3u8: ' + readErr.message });
                }
            }
        );
    });
});


// server.txt - Criação da tabela de playlists customizadas
db.run(`
  CREATE TABLE IF NOT EXISTS custom_playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )
`);

// server.txt - Criação da tabela de junção playlist-músicas
db.run(`
  CREATE TABLE IF NOT EXISTS custom_playlist_songs (
    playlist_id INTEGER,
    musica_id INTEGER,
    order_in_playlist INTEGER,
    PRIMARY KEY (playlist_id, musica_id), -- Garante que uma música não seja adicionada duas vezes na mesma playlist
    FOREIGN KEY (playlist_id) REFERENCES custom_playlists(id),
    FOREIGN KEY (musica_id) REFERENCES musica(id_musica)
  )
`);

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://170.233.196.50:${PORT}`);
});