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

    return DB.first("Project", {
      _id: projectId,
      $or: [
        {
          _r_members: _p_user,
        },
      ],
      isDeleted: { $ne: true },
      status: { $ne: FZ.PROJECT_STATUS.BLIND },
    })
      .then((project) => {
        if (!project) throw Error(ERROR.TARGET_NOT_FOUND);

        return DB.insert("Item", {
          _p_owner: _p_user,
          type,
          fileExt,
          name,
          description,
          _p_project: `Project$${projectId}`,
          metadata,
          externalUrl,
        });
      })
      .then((result) => {
        const { _id: itemId } = result;

        return Promise.all([
          result,
          S3.createUploadUrl(
            `project/${projectId}/${type}/${itemId}.${fileExt}`
          ),
        ]);
      })
      .then(([result, uploadUrl]) => {
        return COMMON.response(200, { ...result, uploadUrl });
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

    return DB.findAll("Project", {
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
    })
      .then((projects) => {
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
        return Promise.all([
          DB.findAll("Item", itemQuery, {
            sort: { _updated_at: -1 },
            ...(SHOULD_PAGENATION && {
              limit: PAGE_LENGTH,
              skip: PAGE_LENGTH * (PAGE - 1),
            }),
          }),
          DB.count("Item", itemQuery),
        ]);
      })
      .then(([items, itemCount]) => {
        const pageCount = SHOULD_PAGENATION
          ? Math.ceil(itemCount / PAGE_LENGTH)
          : 0;
        return COMMON.response(200, {
          items,
          count: { page: pageCount, item: itemCount },
        });
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

    return DB.first("Project", {
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
    })
      .then((project) => {
        if (!project) throw Error(ERROR.TARGET_NOT_FOUND);
        return DB.first("Item", {
          _p_project: `Project$${projectId}`,
          _id: itemId,
          isDeleted: { $ne: true },
        });
      })
      .then((item) => {
        return COMMON.response(200, item);
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
      });
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};
