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

  const {
    type,
    name,
    description = "",
    projectId,
    metadata,
    externalUrl,
    fileExt,
  } = body;

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    const project = await DB.first(
      "Project",
      {
        _id: projectId,
        _r_members: _p_user,
        isDeleted: { $ne: true },
      },
      {
        projection: { name: 1 },
      }
    );

    if (!project) throw Error(ERROR.TARGET_NOT_FOUND);

    const insertResult = await DB.insert("Item", {
      _p_owner: _p_user,
      type,
      fileExt,
      name,
      description,
      _p_project: `Project$${projectId}`,
      metadata,
      externalUrl,
    });

    const { _id: itemId, _p_owner, _p_project } = insertResult;
    const uploadUrl = await S3.createUploadUrl(
      `project/${projectId}/${type}/${itemId}.${fileExt}`
    );

    const ownerName = session.user.username || COMMON.DELETED_USER_NAME;
    const projectName = project.name || COMMON.DELETED_PROJECT_NAME;

    return COMMON.response(200, {
      ...insertResult,
      owner: { _p_owner, name: ownerName },
      project: { _p_project, name: projectName },
      uploadUrl,
    });
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};

module.exports.list = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const {
    project_id: projectId,
    search_text: searchText,
    search_type: searchType,
    task_type: taskType,
    show_public,
    limit,
    page,
  } = event.queryStringParameters || {};

  const SHOULD_PAGENATION = !!limit && !!page;
  const PAGE_LENGTH = SHOULD_PAGENATION ? Number(limit) : undefined;
  const PAGE = SHOULD_PAGENATION ? Number(page) : undefined;

  const showPublic = show_public == "true" || show_public == 1;

  try {
    if (!projectId) throw Error(ERROR.INVALID_PARAMS);

    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    const projects = await DB.findAll(
      "Project",
      {
        $or: [
          {
            _id: projectId,
            _r_members: _p_user,
          },
          {
            _id: projectId,
            isPublic: true,
          },
          showPublic
            ? {
                isPublic: true,
                ...(!!searchText && {
                  $or: [
                    {
                      name: { $regex: searchText, $options: "i" },
                    },
                    {
                      description: { $regex: searchText, $options: "i" },
                    },
                  ],
                }),
              }
            : undefined,
        ].filter(Boolean),
        isDeleted: { $ne: true },
        status: { $ne: FZ.PROJECT_STATUS.BLIND },
      },
      { projection: { name: 1 } }
    );

    if (projects.length == 0) throw Error(ERROR.TARGET_NOT_FOUND);

    const itemQuery = {
      _p_project: {
        $in: projects.map((project) => `Project$${project._id}`),
      },
      ...(!!searchType && { type: searchType }),
      ...(!!taskType && { "metadata.task_type": taskType }),
      ...(!!searchText && {
        $or: [
          {
            name: { $regex: searchText, $options: "i" },
          },
          {
            description: { $regex: searchText, $options: "i" },
          },
          // showPublic ? { } : undefined
        ].filter(Boolean),
      }),
      isDeleted: { $ne: true },
    };

    const [items, itemCount] = await Promise.all([
      DB.findAll("Item", itemQuery, {
        sort: { _updated_at: -1 },
        ...(SHOULD_PAGENATION && {
          limit: PAGE_LENGTH,
          skip: PAGE_LENGTH * (PAGE - 1),
        }),
      }),
      DB.count("Item", itemQuery),
    ]);

    const ownerUsers = await DB.findAll(
      "User",
      {
        _id: {
          $in: items.map(({ _p_owner: _p_user }) => _p_user.split("$")[1]),
        },
        isDeleted: { $ne: true },
      },
      {
        projection: { username: 1 },
      }
    );
    const usernameMap = ownerUsers.reduce((map, { _id, username }) => {
      map[_id] = username;
      return map;
    }, {});
    const projectNameMap = projects.reduce((map, { _id, name }) => {
      map[_id] = name;
      return map;
    }, {});

    const pageCount = SHOULD_PAGENATION
      ? Math.ceil(itemCount / PAGE_LENGTH)
      : 0;

    const refinedItems = items.map((item) => {
      const { _p_owner, _p_project } = item;
      const ownerName =
        usernameMap[_p_owner.split("$")[1]] || COMMON.DELETED_USER_NAME;
      const projectName =
        projectNameMap[_p_project.split("$")[1]] || COMMON.DELETED_PROJECT_NAME;
      return {
        ...item,
        owner: { name: ownerName, _p_owner },
        project: { name: projectName, _p_project },
      };
    });

    return COMMON.response(200, {
      items: refinedItems,
      count: { page: pageCount, item: itemCount },
    });
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};

module.exports.detail = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;

  const { projectId } = event.queryStringParameters || {};
  const { itemId } = event.pathParameters;

  try {
    if (!projectId) throw Error(ERROR.INVALID_PARAMS);

    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    const project = await DB.first(
      "Project",
      {
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
      },
      {
        projection: { name: 1 },
      }
    );

    if (!project) throw Error(ERROR.TARGET_NOT_FOUND);

    const item = await DB.first("Item", {
      _p_project: `Project$${projectId}`,
      _id: itemId,
      isDeleted: { $ne: true },
    });
    const { _p_owner, _p_project } = item;
    const [, userId] = _p_owner.split("$");

    const owner = await DB.first(
      "User",
      {
        _id: userId,
      },
      { projection: { username: 1 } }
    );

    const ownerName = owner.username || COMMON.DELETED_USER_NAME;
    const projectName = project.name || COMMON.DELETED_PROJECT_NAME;

    return COMMON.response(200, {
      ...item,
      owner: { _p_owner, name: ownerName },
      project: { _p_project, name: projectName },
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

  const { itemId } = event.pathParameters;

  const body = UTIL.jsonParser(event.body);
  console.log("processing body: %j", body);

  const {
    type,
    name,
    description = "",
    projectId,
    metadata,
    externalUrl,
    fileExt,
  } = body;

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    return DB.first("Project", {
      _id: projectId,
      $or: [
        {
          _r_members: _p_user,
        },
      ],
      isDeleted: { $ne: true },
    })
      .then((project) => {
        if (!project) throw Error(ERROR.TARGET_NOT_FOUND);

        return DB.update(
          "Item",
          {
            $set: {
              fileExt,
              name,
              description,
              metadata,
              externalUrl,
            },
          },
          { _id: itemId }
        );
      })
      .then((result) => {
        return S3.createUploadUrl(
          `project/${projectId}/${type}/${itemId}.${fileExt}`
        );
      })
      .then((uploadUrl) => {
        return COMMON.response(200, { uploadUrl });
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

  const { itemId } = event.pathParameters;

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    return DB.first("Item", {
      _id: itemId,
      _p_owner: _p_user,
      isDeleted: { $ne: true },
    })
      .then((item) => {
        if (!item) throw Error(ERROR.TARGET_NOT_FOUND);

        return DB.update(
          "Item",
          {
            $set: { isDeleted: true },
          },
          { _id: itemId }
        );
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
