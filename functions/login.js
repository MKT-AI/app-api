const COMMON = require("modules/common");
const DB = require("modules/DB");

module.exports.handler = (event, context, callback) => {
  console.log(event);

  const { id: username, pwd: password } = event.queryStringParameters || {};

  if (!username || !password) return COMMON.ERROR(510);

  return DB.first("User", { username, password })
    .then((user) => {
      console.log(user);
      if (!user) throw Error(511);
      const { _id: userId } = user;
      const token = COMMON.generateSessionToken();
      console.log(token);
      return DB.insert("Session", { token, _p_user: `User$${userId}` });
    })
    .then((session) => {
      console.log(session);
      const { token } = session;
      DB.close();
      return COMMON.response(200, { token });
    })
    .catch((error) => {
      console.log(error);
      DB.close();
      return COMMON.ERROR(error);
    });
};

module.exports.validation = (event, context, callback) => {
  console.log(event);

  const { "session-token": token } = event.headers || {};

  if (!token) return COMMON.ERROR(510);

  return DB.first("Session", { token })
    .then((session) => {
      console.log(session);
      if (!session) throw Error(512);
      return COMMON.response(200, { validUntil: 80000 });
    })
    .catch((error) => {
      console.log(error);
      return COMMON.ERROR(error);
    });
};
