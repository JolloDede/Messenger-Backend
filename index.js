const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const volleyball = require('volleyball');

const app = express();
const db = require('./db/connection');
const messages = db.get('messages');

const auth = require('./auth');
const middlewares = require('./auth/middlewares');

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
    // let skip = Number(req.query.skip) || 0;
    // let limit = Number(req.query.limit) || 10;
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
        .then(([count, messages]) => {
            res.json({
                messages,
                meta: {
                    count,
                    skip,
                    limit,
                    has_more: total - (skip + limit) > 0,
                }
            });
        }).catch(next);
});


function isValidMessage(messageOb) {
    return messageOb.message && messageOb.message.toString().trim() !== '';
}

// Todo
// app.use(rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 100 // limit each IP to 100 requests per windowMs
// }));

app.post('/messages', (req, res, next) => {
    console.log(req.body);
    if (isValidMessage(req.body)) {
        const messageRec = {
            name: req.user.username.toString(),
            message: req.body.message.toString(),
            created: new Date()
        };

        messages
            .insert(messageRec)
            .then(createdMessage => {
                res.json(createdMessage);
            }).catch(next);
    } else {
        res.status(422);
        res.json({
            message: 'Hey, name and Message are required'
        })
    }
})

app.use((error, req, res, next) => {
    res.status(res.statusCode || 500);
    res.json({
        message: error.message
    });
});

app.listen(5000, () => {
    console.log('App Listen');
});