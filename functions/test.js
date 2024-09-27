const COMMON = require("modules/common");
const DB = require("modules/DB");

module.exports.handler = (event, context, callback) => {
  console.log(event);

  return DB.insert("User", { username: "V", password: "LVX_V0419!!" })
    .then((result) => {
      console.log(result);
      return COMMON.response(200, result);
    })
    .catch((error) => {
      console.log(error);
      return COMMON.ERROR(error);
    });
};
