const COMMON = require("modules/common");
const DB = require("modules/DB");

module.exports.handler = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log(event);

  const { "session-token": token } = event.headers || {};

  if (!token) return callback(null, COMMON.ERROR(510));

  return DB.first("Session", { token })
    .then((session) => {
      console.log(session);
      if (!session) throw Error(512);

      const { _p_user } = session;
      const [, userId] = _p_user.split("$");
      return DB.first("User", { _id: userId });
    })
    .then((user) => {
      console.log(user);
      if (!user) throw Error(511);
      return COMMON.response(200, { user });
    })
    .catch((error) => {
      console.log(error);
      return COMMON.ERROR(error);
    });
};
