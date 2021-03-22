const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const volleyball = require('volleyball');
const multer  = require('multer');
const path = require("path");

const app = express();
const db = require('./db/connection');
const messages = db.get('messages');

const auth = require('./auth');
const middlewares = require('./auth/middlewares');
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },

    // By default, multer removes file extensions so let's add them back
    filename: function(req, file, cb) {
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

function isValidMessage(messageOb) {
    if (messageOb.message && messageOb.message.toString().trim() !== '') {
        return true;
    }else if(messageOb.img) {
        return true;
    }else {
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
    if (isValidMessage(msg)){
        const rec = {
            name: req.user.username.toString(),
            message: msg.message ? msg.message.toString(): "",
            img: msg.img ? msg.img.filename.toString(): "",
            created: new Date()
        }
        messages
            .insert(rec)
            .then(createdMessage => {
                res.json(createdMessage);
            }).catch(next);
    }else {
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

app.listen(5000, () => {
    console.log('App Listen');
});