const TAG = "PPS";
const LTAG = (...args) => console.log(`[${TAG}]`, ...args);

const moment = require("moment-timezone");
moment.locale("ko");
moment.tz.setDefault("Asia/Seoul");

const COMMON = require("modules/common");
const ERROR = require("modules/error");
const DB = require("modules/DB");
const FZ = require("modules/freezed");

module.exports.sync = (event, context, callback) => {
  LTAG("on sync");

  const { "x-mktai-session-token": token } = event.headers || {};

  if (!token) return Promise.reject(ERROR.INVALID_AUTH);

  return DB.first("Session", {
    token,
    expiresAt: { $gte: moment().toDate() },
    restricted: { $ne: true },
  })
    .then((session) => {
      LTAG("session = ", session);
      if (!session) throw Error(ERROR.SESSION_NOT_FOUND);
      const { _p_user } = session;
      const [, userId] = _p_user.split("$");
      return Promise.all([
        session,
        DB.first(
          "User",
          {
            _id: userId,
            status: FZ.USER_STATUS.ACTIVE,
            isDeleted: { $ne: true },
          },
          { projection: { username: 1 } }
        ),
      ]);
    })
    .then(([session, user]) => {
      LTAG("user = ", user);
      if (!user) throw Error(ERROR.USER_NOT_FOUND);
      return { ...session, user };
    })
    .catch((error) => {
      console.log(error);
      return ERROR(error);
    });
};
