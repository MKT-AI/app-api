const COMMON = require("modules/common");
const ERROR = require("modules/error");
const DB = require("modules/DB");
const PRE = require("modules/preprocess");
const UTIL = require("modules/util");
const S3 = require("modules/S3");
const FZ = require("modules/freezed");

module.exports.new = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;

  const body = UTIL.jsonParser(event.body);
  console.log("processing body: %j", body);

  const { name, description = "", members = [], isPublic = false } = body;

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    return DB.insert("Project", {
      _p_owner: _p_user,
      name,
      description,
      _r_members: [
        ...new Set([_p_user, ...members.map((userId) => `User$${userId}`)]),
      ],
      isPublic,
      status: FZ.PROJECT_STATUS.ACTIVE,
    })
      .then((result) => {
        const { _id: projectId } = result;
        return S3.createFolder(`project/${projectId}`);
      })
      .then((result) => {
        return COMMON.response(200, { result });
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
  const { brief } = event.queryStringParameters || {};

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    const projects = await DB.findAll(
      "Project",
      {
        $or: [
          {
            _r_members: _p_user,
          },
          {
            isPublic: true,
          },
        ],
        isDeleted: { $ne: true },
        status: { $ne: FZ.PROJECT_STATUS.BLIND },
      },
      { ...(!!brief && { projection: { name: 1 } }) }
    );
    const users = await DB.findAll(
      "User",
      {
        _id: {
          $in: projects
            .map(({ _r_members }) =>
              _r_members.map((_p_user) => _p_user.split("$")[1])
            )
            .flat(),
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

    const items = await DB.findAll(
      "Item",
      {
        _p_project: { $in: projects.map(({ _id }) => `Project$${_id}`) },
        isDeleted: { $ne: true },
      },
      { projection: { _p_project: 1 } }
    );
    const itemCountMap = items.reduce((map, { _p_project }) => {
      const [, projectId] = _p_project.split("$");
      map[projectId] = (map[projectId] || 0) + 1;
      return map;
    }, {});
    const data = projects.map((project) => {
      const { _r_members, ...args } = project;
      const members = _r_members.map((_p_user) => {
        const [, userId] = _p_user.split("$");
        const username = usernameMap[userId] || "no name";
        return { _id: userId, username, _p_user: `User$${userId}` };
      });
      const itemCount = itemCountMap[project._id] || 0;
      return { ...args, members, count: { item: itemCount } };
    });
    return COMMON.response(200, { projects: data });
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};

module.exports.detail = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;
  const { projectId } = event.pathParameters;

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    return Promise.all([
      DB.first("Project", {
        _id: projectId,
        $or: [
          {
            _r_members: _p_user,
          },
          {
            isPublic: true,
          },
        ],
        isDeleted: { $ne: true },
        status: { $ne: FZ.PROJECT_STATUS.BLIND },
      }),
      DB.count("Item", {
        _p_project: `Project$${projectId}`,
        isDeleted: { $ne: true },
      }),
    ])
      .then(([project, itemCount]) => {
        return COMMON.response(200, { ...project, count: { item: itemCount } });
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

module.exports.update = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;
  const { projectId } = event.pathParameters;

  const body = UTIL.jsonParser(event.body);
  console.log("processing body: %j", body);

  const {
    name,
    description = "",
    members = [],
    isPublic,
    apiKey,
    status,
  } = body;

  try {
    if (!!status && !FZ.PROJECT_STATUS.isValid(status))
      throw Error(ERROR.INVALID_PARAMS);
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    const project = await DB.first("Project", {
      _id: projectId,
      _r_members: _p_user
    });

    if (!project) throw Error(ERROR.TARGET_NOT_FOUND);

    return DB.update(
      "Project",
      {
        $set: {
          name,
          description,
          _r_members: [
            ...new Set([...members.map((userId) => `User$${userId}`)]),
          ],
          isPublic,
          ...(!!apiKey && { apiKey }),
          ...(!!status && { status }),
        },
      },
      { _id: projectId, _r_members: _p_user }
    )
      .then((result) => {
        return COMMON.response(200, { result });
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

module.exports.delete = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;

  const { projectId } = event.pathParameters;

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    const project = await DB.first("Project", {
      _id: projectId,
      _r_members: _p_user
    });

    if (!project) throw Error(ERROR.TARGET_NOT_FOUND);

    return DB.update(
      "Project",
      {
        $set: { status: FZ.PROJECT_STATUS.BLIND, isDeleted: true },
      },
      { _id: projectId, _r_members: _p_user }
    )
      .then((result) => {
        return COMMON.response(200, { result });
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
