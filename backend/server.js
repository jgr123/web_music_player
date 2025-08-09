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


// Rota para músicas mais tocadas
app.get('/api/top-songs', (req, res) => {
    db.all(`
        SELECT musica, COUNT(*) as play_count 
        FROM musica_data_horario 
        GROUP BY musica 
        ORDER BY play_count DESC 
        LIMIT 10
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
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

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://170.233.196.50:${PORT}`);
});