const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
//const PORT = 5000;
const PORT = 5202;

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