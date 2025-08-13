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
const MUSIC_DEST_DIR = 'D:/Downloads/wpp-node/radio-player/frontend/public/music';
// Caminho base onde o servidor irá procurar as músicas caso não estejam no diretório de destino
const MUSIC_SEARCH_BASE_DIR = 'D:/deezer-downloader/playlists';

// --- Função Auxiliar: Encontrar e Copiar Arquivo de Música ---
/**
 * Verifica se um arquivo de música existe no diretório de destino.
 * Se não existir, tenta encontrá-lo recursivamente no diretório de busca e copiá-lo.
 * @param {string} fileName O nome completo do arquivo de música (e.g., "Artista - Nome da Musica.mp3").
 * @returns {Promise<boolean>} True se o arquivo foi encontrado/copiado com sucesso, false caso contrário.
 */
async function findAndCopyMusicFile(fileName) {
  const targetPath = path.join(MUSIC_DEST_DIR, fileName);
  console.log("---- Destino= " + targetPath);
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


// --- Rota API para Upload de Playlist .m3u8 ---
app.post('/api/upload-m3u8', upload.single('m3u8File'), async (req, res) => {
  // Verifica se um arquivo foi realmente enviado
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo .m3u8 foi enviado.' });
  }

  const m3u8FilePath = req.file.path; // Caminho temporário do arquivo uploaded
  const playlistFileName = req.file.originalname; // Ex: "Minha Playlist.m3u8"
  // O nome da playlist é o nome do arquivo sem a extensão .m3u8
  const playlistName = playlistFileName.replace(/\.m3u8$/i, '');

  let userId = req.body.userId; // Espera que o ID do usuário seja enviado no corpo da requisição

  // Caso o userId não seja fornecido (ex: usuário não logado ou em teste), tenta pegar o primeiro usuário do DB
  if (!userId) {
    console.warn("ID de usuário não fornecido para o upload da playlist. Tentando obter um usuário padrão.");
    try {
      const users = await new Promise((resolve, reject) => {
        db.all(`SELECT id FROM users LIMIT 1`, (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        });
      });
      if (users.length > 0) {
        userId = users[0].id;
        console.log(`Usando ID de usuário padrão: ${userId}`);
      } else {
        await fs.remove(m3u8FilePath); // Limpa o arquivo temporário
        return res.status(400).json({ error: 'Nenhum usuário logado ou registrado para criar a playlist. Por favor, faça login ou registre-se.' });
      }
    } catch (dbErr) {
      console.error("Erro ao determinar o criador da playlist:", dbErr);
      await fs.remove(m3u8FilePath); // Limpa o arquivo temporário
      return res.status(500).json({ error: 'Erro interno ao determinar o criador da playlist.' });
    }
  }

  try {
    // Lê o conteúdo do arquivo .m3u8
    const m3u8Content = await fs.readFile(m3u8FilePath, 'utf8');
    const lines = m3u8Content.split('\n');

    let playlistId;
    let orderInPlaylist = 0; // Para manter a ordem das músicas na playlist

    // Usa Promises para lidar com a assincronicidade das operações de banco de dados e arquivo
    await new Promise((resolve, reject) => {
      // Inicia uma transação de banco de dados para garantir atomicidade
      db.serialize(() => { // Garante que as operações SQL ocorram em sequência
        db.run("BEGIN TRANSACTION;");

        // 1. Insere a nova playlist customizada na tabela `custom_playlists`
        db.run(`INSERT INTO custom_playlists (name, description, created_by) VALUES (?, ?, ?)`,
          [playlistName, `Playlist gerada do arquivo ${playlistFileName}`, userId],
          function (err) {
            if (err) {
              console.error("Erro ao inserir playlist customizada:", err);
              db.run("ROLLBACK;"); // Desfaz a transação em caso de erro
              return reject(err);
            }
            playlistId = this.lastID; // Pega o ID da playlist recém-criada
            console.log(`✅ Playlist '${playlistName}' (ID: ${playlistId}) criada com sucesso.`);

            // Filtra apenas as linhas que representam arquivos de música (.mp3)
            const songLines = lines.filter(line => line.trim().endsWith('.mp3'));

            // Função recursiva para processar cada música sequencialmente
            const processSong = (index) => {
              if (index >= songLines.length) {
                // Se todas as músicas foram processadas, comita a transação
                db.run("COMMIT;", (err) => {
                  if (err) {
                    console.error("Erro ao comitar transação:", err);
                    return reject(err);
                  }
                  resolve(); // Resolve a Promise principal
                });
                return;
              }

              const fullFileName = songLines[index].trim(); // Ex: "Artista - Nome da Musica.mp3"
              // Nome da música para exibição e busca no DB, sem a extensão .mp3
              const displayFileName = fullFileName.replace(/\.mp3$/i, '');

              let artistName = 'Unknown Artist'; // Valor padrão
              let songName = displayFileName;    // Valor padrão (caso não haja ' - ')

              // Tenta extrair Artista e Nome da Música do padrão "Artista - Nome da Musica"
              const firstDashIndex = displayFileName.indexOf(' - ');
              if (firstDashIndex !== -1) {
                artistName = displayFileName.substring(0, firstDashIndex).trim();
                songName = displayFileName.substring(firstDashIndex + 3).trim(); // +3 para pular ' - '
              }

              console.log(`Processando música: '${fullFileName}'`);

              // 2. Gerenciamento do arquivo de áudio: busca e cópia se necessário
              findAndCopyMusicFile(fullFileName)
                .then(() => {
                  // 3. Verifica/Insere o Cantor
                  db.get(`SELECT id_cantor FROM cantor WHERE nome_cantor = ?`, [artistName], function (err, row) {
                    if (err) { console.error(`Erro ao buscar/inserir cantor '${artistName}':`, err); processSong(index + 1); return; }

                    let artistId;
                    if (row) {
                      artistId = row.id_cantor;
                    } else {
                      // Insere o cantor se não existir
                      db.run(`INSERT INTO cantor (nome_cantor) VALUES (?)`, [artistName], function (err) {
                        if (err) { console.error(`Erro ao inserir cantor '${artistName}':`, err); processSong(index + 1); return; }
                        artistId = this.lastID;
                        console.log(`➕ Cantor '${artistName}' (ID: ${artistId}) inserido.`);
                      });
                    }

                    // 4. Verifica/Insere a Música
                    // Usa `nome_cantor_musica_hunterfm` para buscar/garantir unicidade
                    db.get(`SELECT id_musica FROM musica WHERE nome_cantor_musica_hunterfm = ?`, [displayFileName], function (err, row) {
                      if (err) { console.error(`Erro ao buscar/inserir música '${displayFileName}':`, err); processSong(index + 1); return; }

                      let musicaId;
                      if (row) {
                        musicaId = row.id_musica;
                      } else {
                        // Insere a música se não existir
                        // `arquivo` armazena o nome completo do arquivo com extensão .mp3
                        db.run(`INSERT INTO musica (id_cantor, nome_musica, nome_cantor_musica_hunterfm, arquivo) VALUES (?, ?, ?, ?)`,
                          [artistId, songName, displayFileName, fullFileName],
                          function (err) {
                            if (err) { console.error(`Erro ao inserir música '${displayFileName}':`, err); processSong(index + 1); return; }
                            musicaId = this.lastID;
                            console.log(`➕ Música '${displayFileName}' (ID: ${musicaId}) inserida.`);
                          });
                      }

                      // 5. Insere o relacionamento entre a playlist e a música
                      // `INSERT OR IGNORE` evita duplicatas caso a música já esteja na playlist
                      db.run(`INSERT OR IGNORE INTO custom_playlist_songs (playlist_id, musica_id, order_in_playlist) VALUES (?, ?, ?)`,
                        [playlistId, musicaId, orderInPlaylist++],
                        function (err) {
                          if (err) { console.error("Erro ao inserir em custom_playlist_songs:", err); }
                          // Continua para a próxima música, independentemente do sucesso/falha desta inserção
                          processSong(index + 1);
                        }
                      );
                    });
                  });
                })
                .catch(err => {
                  console.error("Erro durante busca/cópia de arquivo, continuando para próxima música:", err);
                  processSong(index + 1); // Continua mesmo se a cópia do arquivo falhar
                });
            }; // Fim da definição de `processSong`

            processSong(0); // Inicia o processamento da primeira música
          }
        );
      });
    });

    res.json({ message: `Playlist '${playlistName}' e suas músicas processadas com sucesso! Arquivo .m3u8 carregado.` });
  } catch (error) {
    console.error("Erro ao processar arquivo M3U8:", error);
    res.status(500).json({ error: `Erro ao processar arquivo M3U8: ${error.message}` });
  } finally {
    // Garante que o arquivo temporário de upload seja removido
    if (m3u8FilePath) {
      await fs.remove(m3u8FilePath);
      console.log(`🗑️ Arquivo temporário '${m3u8FilePath}' removido.`);
    }
  }
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