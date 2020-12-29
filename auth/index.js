const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

require('dotenv').config();

const db = require('../db/connection');
const users = db.get('users');
users.createIndex('username', { unique: true });

const router = express.Router();

const schema = Joi.object().keys({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required(),

  password: Joi.string()
    .pattern(new RegExp('^[a-zA-Z0-9]{6,30}$')).required(),
});

function createTokenSendResponse(user, res, next) {
  const payload = {
    id: user.id,
    username: user.username,
  };

  jwt.sign(payload, process.env.TOKEN_SECRET, {
    expiresIn: '1d',
  }, (err, token) => {
    if (err) {
      respondError422(res, next);
    } else {
      res.json({ 
        token: token,
        username: user.username
      });
    }
  });
}

router.get('/', (req, res) => {
  res.json({
    message: 'Hello Router',
  });
});

router.post('/signup', (req, res, next) => {
  const { error, result } = schema.validate(req.body);
  if (error == null) {
    users.findOne({
      username: req.body.username,
    }).then(user => {
      if (user) {
        const error = new Error('That username is not OG. Please choose another one.');
        res.status(409);
        next(error);
      } else {
        bcrypt.hash(req.body.password.trim(), 12).then(hashedPassword => {
          const newUser = {
            username: req.body.username,
            password: hashedPassword,
          };
          users.insert(newUser).then(insertedUser => {
            createTokenSendResponse(insertedUser, res, next);
          });
        });
      }
    })
  } else {
    res.status(422);
    next(error);
  }
});

function respondError422(res, next) {
  res.status(422);
  const error = new Error('Unable to login.');
  next(error);
}

router.post('/login', (req, res, next) => {
  const { error, result } = schema.validate(req.body);
  if (error == null) {
    users.findOne({
      username: req.body.username,
    }).then(user => {
      if (user) {
        bcrypt.compare(req.body.password, user.password).then((result) => {
          if (result) {
            createTokenSendResponse(user, res, next);
          } else {
            respondError422(res, next);
          }
        });
      } else {
        respondError422(res, next);
      }
    })
  } else {
    respondError422(res, next);
  }
});

module.exports = router;