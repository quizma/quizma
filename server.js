const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const dbFile = path.join(dataDir, 'db.json');

function ensureDb() {
  if (!fs.existsSync(dbFile)) {
    fs.mkdirSync(dataDir, { recursive: true });
    const seed = {
      users: [
        {
          id: 'user-ava',
          username: 'Ava',
          displayName: 'Ava Chen',
          avatar: 'https://api.dicebear.com/7.x/thumbs/svg?seed=Ava',
          platform: 'google',
          bio: 'Loves math and daily streaks.',
          score: 1840,
          streak: 6,
          joinedAt: '2026-07-01T10:15:00.000Z',
          progress: {
            bestScore: 1840,
            quizzesPlayed: 14,
            lastPlayed: '2026-07-09T08:00:00.000Z',
            achievements: ['First 1000', 'Quizbot Fan']
          }
        },
        {
          id: 'user-noah',
          username: 'Noah',
          displayName: 'Noah Rivera',
          avatar: 'https://api.dicebear.com/7.x/thumbs/svg?seed=Noah',
          platform: 'discord',
          bio: 'Speed quiz challenger.',
          score: 1620,
          streak: 4,
          joinedAt: '2026-07-02T17:20:00.000Z',
          progress: {
            bestScore: 1620,
            quizzesPlayed: 11,
            lastPlayed: '2026-07-09T06:30:00.000Z',
            achievements: ['Fast Starter']
          }
        },
        {
          id: 'user-leah',
          username: 'Leah',
          displayName: 'Leah Brooks',
          avatar: 'https://api.dicebear.com/7.x/thumbs/svg?seed=Leah',
          platform: 'github',
          bio: 'Builds custom study rooms.',
          score: 1430,
          streak: 8,
          joinedAt: '2026-07-03T11:05:00.000Z',
          progress: {
            bestScore: 1430,
            quizzesPlayed: 9,
            lastPlayed: '2026-07-09T09:10:00.000Z',
            achievements: ['Consistency King']
          }
        },
        {
          id: 'user-dex',
          username: 'Dex',
          displayName: 'Dex Carter',
          avatar: 'https://api.dicebear.com/7.x/thumbs/svg?seed=Dex',
          platform: 'local',
          bio: 'Loves real-time competition.',
          score: 1280,
          streak: 3,
          joinedAt: '2026-07-04T14:40:00.000Z',
          progress: {
            bestScore: 1280,
            quizzesPlayed: 7,
            lastPlayed: '2026-07-08T20:20:00.000Z',
            achievements: ['Daily Player']
          }
        }
      ]
    };
    fs.writeFileSync(dbFile, JSON.stringify(seed, null, 2));
  }
}

function loadDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
}

function saveDb(db) {
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function getDefaultProgress() {
  return {
    bestScore: 0,
    quizzesPlayed: 0,
    lastPlayed: null,
    achievements: ['First Login']
  };
}

function createUserRecord(username, extras = {}) {
  const safeName = String(username || 'Guest').trim();
  const now = new Date().toISOString();
  return {
    id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    username: safeName,
    displayName: safeName,
    avatar: extras.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(safeName)}`,
    platform: extras.platform || 'local',
    authMethod: extras.authMethod || (extras.isOAuth ? 'oauth' : 'local'),
    isOAuth: Boolean(extras.isOAuth),
    bio: extras.bio || 'New Quizma member.',
    score: 0,
    streak: 0,
    joinedAt: now,
    lastLoginAt: now,
    progress: getDefaultProgress()
  };
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    platform: user.platform,
    authMethod: user.authMethod || (user.isOAuth ? 'oauth' : 'local'),
    isOAuth: Boolean(user.isOAuth),
    bio: user.bio,
    score: user.score || 0,
    streak: user.streak || 0,
    joinedAt: user.joinedAt,
    lastLoginAt: user.lastLoginAt,
    progress: user.progress || getDefaultProgress()
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8'
  };
  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*'
  });
  fs.createReadStream(filePath).pipe(res);
}

function generateQuiz(topic, difficulty = 'medium') {
  const safeTopic = String(topic || 'general knowledge').trim() || 'general knowledge';
  const normalized = safeTopic.toLowerCase();
  let questions = [];

  if (normalized.includes('math')) {
    questions = [
      { q: `Quick math warmup: what is ${Math.floor(Math.random() * 10) + 2} × ${Math.floor(Math.random() * 8) + 3}?`, options: ['18', '21', '24', '27'], correct: 2 },
      { q: 'Which fraction is equivalent to 1/2?', options: ['2/4', '3/4', '1/4', '4/8'], correct: 0 },
      { q: 'What is 25% of 80?', options: ['15', '20', '25', '30'], correct: 1 },
      { q: 'What is the next number: 2, 4, 8, 16, ?', options: ['24', '32', '40', '48'], correct: 1 },
      { q: 'What is 3/5 + 1/5?', options: ['2/5', '4/5', '1/5', '3/5'], correct: 1 }
    ];
  } else if (normalized.includes('science')) {
    questions = [
      { q: 'What planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Mercury', 'Jupiter'], correct: 1 },
      { q: 'What gas do plants absorb from the air?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correct: 2 },
      { q: 'What force pulls objects toward Earth?', options: ['Magnetism', 'Gravity', 'Friction', 'Sound'], correct: 1 },
      { q: 'What is the center of an atom called?', options: ['Electron', 'Nucleus', 'Orbital', 'Shell'], correct: 1 },
      { q: 'What is the hardest natural substance on Earth?', options: ['Quartz', 'Diamond', 'Gold', 'Steel'], correct: 1 }
    ];
  } else if (normalized.includes('history')) {
    questions = [
      { q: 'Who was the first president of the United States?', options: ['Thomas Jefferson', 'George Washington', 'Abraham Lincoln', 'John Adams'], correct: 1 },
      { q: 'Which ancient civilization built Machu Picchu?', options: ['Romans', 'Inca', 'Greeks', 'Maya'], correct: 1 },
      { q: 'In what year did the first moon landing happen?', options: ['1965', '1969', '1971', '1973'], correct: 1 },
      { q: 'What wall was built to separate East and West Berlin?', options: ['Great Wall', 'Berlin Wall', 'Hadrian Wall', 'Maginot Line'], correct: 1 },
      { q: 'Which empire was ruled by Julius Caesar?', options: ['Ottoman', 'Roman', 'Persian', 'Mongol'], correct: 1 }
    ];
  } else {
    questions = [
      { q: `What is the best way to study ${safeTopic}?`, options: ['Practice daily', 'Ignore it', 'Memorize once', 'Avoid questions'], correct: 0 },
      { q: `Which skill improves fastest when you review ${safeTopic} each day?`, options: ['Focus', 'Confusion', 'Sleepiness', 'Distraction'], correct: 0 },
      { q: `If you were building a quiz around ${safeTopic}, which format fits best?`, options: ['Short bursts', 'Random guesses', 'No review', 'Long reading only'], correct: 0 },
      { q: `Which habit helps most with ${safeTopic}?`, options: ['Consistent practice', 'Skipping notes', 'Leaving it late', 'Avoiding feedback'], correct: 0 },
      { q: `What makes a quiz more fun for ${safeTopic}?`, options: ['Friendly competition', 'No timers', 'No answers', 'Zero challenge'], correct: 0 }
    ];
  }

  if (difficulty === 'hard') {
    questions = questions.map((item, index) => ({
      ...item,
      q: `${item.q} (Challenge ${index + 1})`
    }));
  }

  return {
    title: `Quizbot • ${safeTopic}`,
    questions
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (pathname === '/api/health') {
    sendJson(res, 200, { ok: true, message: 'Quizma server is running.' });
    return;
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const username = body.username || body.displayName || 'Guest';
      const db = loadDb();
      const normalized = normalizeUsername(username);
      let user = db.users.find(item => normalizeUsername(item.username) === normalized);

      if (!user) {
        user = createUserRecord(username, {
          avatar: body.avatar,
          platform: body.platform || 'local',
          authMethod: body.authMethod || (body.isOAuth ? 'oauth' : 'local'),
          isOAuth: Boolean(body.isOAuth),
          bio: body.bio || 'New Quizma member.'
        });
        db.users.push(user);
      } else {
        user.avatar = body.avatar || user.avatar;
        user.platform = body.platform || user.platform;
        user.displayName = body.displayName || user.displayName || user.username;
        user.bio = body.bio || user.bio;
      }

      user.authMethod = body.authMethod || (body.isOAuth ? 'oauth' : user.authMethod || 'local');
      user.isOAuth = Boolean(body.isOAuth || user.authMethod === 'oauth');
      user.lastSeen = new Date().toISOString();
      user.lastLoginAt = new Date().toISOString();
      user.progress = user.progress || getDefaultProgress();
      saveDb(db);
      sendJson(res, 200, { ok: true, user: sanitizeUser(user) });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (pathname === '/api/users' && req.method === 'GET') {
    const db = loadDb();
    sendJson(res, 200, { users: db.users.map(sanitizeUser) });
    return;
  }

  if (pathname === '/api/users/search' && req.method === 'GET') {
    const db = loadDb();
    const query = (url.searchParams.get('q') || '').trim().toLowerCase();
    const users = db.users.filter(user => {
      if (!query) return true;
      return [user.username, user.displayName, user.bio].some(value => String(value).toLowerCase().includes(query));
    });
    sendJson(res, 200, { users: users.map(sanitizeUser) });
    return;
  }

  if (pathname.startsWith('/api/users/') && req.method === 'GET') {
    const db = loadDb();
    const userId = pathname.split('/').filter(Boolean)[2];
    const user = db.users.find(item => item.id === userId);
    if (!user) {
      sendJson(res, 404, { ok: false, error: 'User not found.' });
      return;
    }
    sendJson(res, 200, { user: sanitizeUser(user) });
    return;
  }

  if (pathname.startsWith('/api/users/') && pathname.endsWith('/progress') && req.method === 'POST') {
    try {
      const db = loadDb();
      const userId = pathname.split('/').filter(Boolean)[2];
      const body = await readBody(req);
      const user = db.users.find(item => item.id === userId);
      if (!user) {
        sendJson(res, 404, { ok: false, error: 'User not found.' });
        return;
      }

      const incomingScore = Number(body.score || 0);
      const previousBest = Number(user.progress?.bestScore || 0);
      const nextBest = Math.max(previousBest, incomingScore);
      const quizzesPlayed = Number(user.progress?.quizzesPlayed || 0) + 1;
      user.score = Math.max(Number(user.score || 0), incomingScore);
      user.progress = {
        bestScore: nextBest,
        quizzesPlayed,
        lastPlayed: new Date().toISOString(),
        achievements: Array.from(new Set([...(user.progress?.achievements || []), incomingScore >= 500 ? 'High Scorer' : 'Practice Completed']))
      };
      saveDb(db);
      sendJson(res, 200, { ok: true, user: sanitizeUser(user) });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (pathname === '/api/leaderboard' && req.method === 'GET') {
    const db = loadDb();
    const users = [...db.users].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 6);
    sendJson(res, 200, { users: users.map(sanitizeUser) });
    return;
  }

  if (pathname === '/api/quizbot/generate' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const quiz = generateQuiz(body.topic || body.prompt, body.difficulty || 'medium');
      sendJson(res, 200, { ok: true, quiz });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  const requestedFile = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(requestedFile).replace(/^([.][/\\])+/g, '');
  const filePath = path.join(rootDir, safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    sendFile(res, filePath);
  } else {
    sendJson(res, 404, { ok: false, error: 'Not found.' });
  }
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Quizma server running on http://localhost:${port}`);
});
