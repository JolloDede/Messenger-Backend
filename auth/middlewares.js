const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const users = db.get('users');

function checkTokenSetUser(req, res, next) {
  console.log("Hallo");
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        let decoded = jwt.verify(token, process.env.TOKEN_SECRET);
        users.findOne({
              username: decoded.username,
            }).then(user => {
                req.user = user;
                next();
            });
      } catch (error) {
        next();
      }
    } else {
      next();
    }
  } else {
    next();
  }
}

function isLoggedIn(req, res, next) {
  if (req.user) {
    next();
  } else {
    const error = new Error('Hey, your not authorized');
    res.status(401);
    next(error);
  }
}

module.exports = {
  checkTokenSetUser,
  isLoggedIn
};