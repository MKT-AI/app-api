const moment = require("moment-timezone");
moment.locale("ko");
moment.tz.setDefault("Asia/Seoul");

const COMMON = require("modules/common");
const ERROR = require("modules/error");
const DB = require("modules/DB");
const PRE = require("modules/preprocess");
const UTIL = require("modules/util");
const FZ = require("modules/freezed");

module.exports.new = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;

  const body = UTIL.jsonParser(event.body);
  console.log("processing body: %j", body);

  const { userId, projectId, type, metadata } = body;

  try {
    // [userId, projectId, type].forEach((param) => {
    //   if (!param) throw Error(ERROR.INVALID_PARAMS);
    // });

    return DB.insert("Usage", {
      _p_user: `User$${userId}`,
      _p_project: `Project$${projectId}`,
      type,
      metadata,
    })
      .then((result) => {
        return COMMON.response(200, result);
      })
      .catch((e) => {
        console.error("Error: ", e.message);
        return ERROR(e);
      });
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};

module.exports.track = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;

  const body = UTIL.jsonParser(event.body);
  console.log("processing body: %j", body);

  const { projectId, type, metadata } = body;

  try {
    if (!projectId) throw Error(ERROR.INVALID_PARAMS);

    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    return DB.insert("Usage", {
      _p_user,
      _p_project: `Project$${projectId}`,
      type,
      metadata,
    })
      .then((result) => {
        return COMMON.response(200, result);
      })
      .catch((e) => {
        console.error("Error: ", e.message);
        return ERROR(e);
      });
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};

module.exports.list = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;

  const { group, start_date, end_date, type } =
    event.queryStringParameters || {};

  try {
    if (!FZ.USAGE_GROUP.isValid(group)) throw Error(ERROR.INVALID_PARAMS);
    if (!FZ.ITEM_TYPE.isValid(type)) throw Error(ERROR.INVALID_PARAMS);
    if (!moment(start_date, "YYYY-MM-DD", true).isValid())
      throw Error(ERROR.INVALID_PARAMS);
    if (!moment(end_date, "YYYY-MM-DD", true).isValid())
      throw Error(ERROR.INVALID_PARAMS);

    const usages = await DB.aggregate("Usage", [
      {
        $match: {
          type,
          _created_at: {
            $gte: moment(start_date).startOf("d").toDate(),
            $lte: moment(end_date).endOf("d").toDate(),
          },
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: {
            [FZ.USAGE_GROUP.USER]: "$_p_user",
            [FZ.USAGE_GROUP.PROJECT]: "$_p_project",
          }[group],
          count: { $sum: 1 },
        },
      },
    ]);
    switch (group) {
      case FZ.USAGE_GROUP.USER: {
        const users = await DB.findAll(
          "User",
          {
            _id: {
              $in: usages.map(({ _id: _p_user }) => _p_user.split("$")[1]),
            },
            isDeleted: { $ne: true },
          },
          {
            projection: { username: 1 },
          }
        );
        const usernameMap = users.reduce((map, { _id, username }) => {
          map[_id] = username;
          return map;
        }, {});

        const result = usages.map((usage) => {
          const [, userId] = usage._id.split("$");
          const name = usernameMap[userId] || COMMON.DELETED_USER_NAME;
          return { ...usage, name };
        });

        return COMMON.response(200, { usages: result });
      }
      case FZ.USAGE_GROUP.PROJECT: {
        const projects = await DB.findAll(
          "Project",
          {
            _id: {
              $in: usages.map(
                ({ _id: _p_project }) => _p_project.split("$")[1]
              ),
            },
            isDeleted: { $ne: true },
          },
          {
            projection: { name: 1 },
          }
        );
        const nameMap = projects.reduce((map, { _id, name }) => {
          map[_id] = name;
          return map;
        }, {});

        const refinedUsages = usages.map((usage) => {
          const [, projectId] = usage._id.split("$");
          const name = nameMap[projectId] || COMMON.DELETED_PROJECT_NAME;
          return { ...usage, name };
        });

        return COMMON.response(200, { usages: refinedUsages });
      }
    }
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};
