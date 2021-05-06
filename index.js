const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const volleyball = require('volleyball');
const multer = require('multer');
const path = require("path");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, {
    cors: {
        // origin: "http://localhost:3000",
        methods: ["GET", "POST"]
      }
});
const db = require('./db/connection');
const messages = db.get('messages');

const auth = require('./auth');
const middlewares = require('./auth/middlewares');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },

    // By default, multer removes file extensions so let's add them back
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype == 'image/jpeg' || file.mimetype == 'image/png') {
        cb(null, true);
    } else {
        cb(null, false);
    }
}
const upload = multer({ storage: storage, fileFilter: fileFilter });

app.use(cors());
app.use(volleyball);
app.use(express.json());
app.use(middlewares.checkTokenSetUser);

app.use('/auth', auth);

app.get('/', (req, res) => {
    res.json({
        message: 'Hallo'
    });
});

// Everything that comes after here is only accessable with a account
app.use(middlewares.isLoggedIn);

app.get('/messages', (req, res, next) => {
    messages
        .find()
        .then(messages => {
            res.json(messages);
        }).catch(next);
});

app.get('/v2/messages', (req, res, next) => {
    let { skip = 0, limit = 10 } = req.query;
    skip = Number(skip);
    limit = Number(limit);

    Promise.all([
        messages.count(),
        messages
            .find({}, {
                skip,
                limit,
                orderBy: {
                    created: -1
                }
            })
    ])
        .then(([total, messages]) => {
            res.json({
                messages,
                meta: {
                    total,
                    skip,
                    limit,
                    has_more: total - (skip + limit) > 0,
                }
            });
        }).catch(next);
});


function isValidMessage(messageOb) {
    if (messageOb.message && messageOb.message.toString().trim() !== '') {
        return true;
    } else if (messageOb.img) {
        return true;
    } else {
        return false;
    }
}

// Todo Uncomment
// app.use(rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 100 // limit each IP to 100 requests per windowMs
// }));

app.post('/messages', upload.single('file-input'), (req, res, next) => {
    const msg = { message: req.body.message, img: req.file };
    if (isValidMessage(msg)) {
        const rec = {
            name: req.user.username.toString(),
            message: msg.message ? msg.message.toString() : "",
            img: msg.img ? msg.img.filename.toString() : "",
            created: new Date()
        }
        messages
            .insert(rec)
            .then(createdMessage => {
                res.json(createdMessage);
            }).catch(next);
    } else {
        res.status(422);
        res.json({
            message: 'Hey, a Message or a Image are required'
        })
    }
});

app.use((error, req, res, next) => {
    res.status(res.statusCode || 500);
    res.json({
        message: error.message
    });
});

// Socketio area
let numClients = 0;

io.on('connection', socket => {
    socket.emit('announcements', { message: 'A new user has joined!' });
});

io.on('connection', socket => {
    numClients++;
    socket.emit('stats', { numClients: numClients });

    console.log('Connected clients:', numClients);

    socket.on('disconnect', function() {
        numClients--;
        socket.emit('stats', { numClients: numClients });

        console.log('Connected clients:', numClients);
    });
});

io.on("connection", socket => {
    socket.on("message", data => {
        io.emit("message", { message: data });
    });
});

server.listen(5000, () => {
    console.log('App Listen');
});