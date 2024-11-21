const TAG = "FZ";
const LTAG = (...args) => console.log(`[${TAG}]`, ...args);

module.exports.PROJECT_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  BLIND: "blind",
  isValid: function (key) {
    return Object.values(this).includes(key);
  },
});

module.exports.ITEM_TYPE = Object.freeze({
  IMAGE: "image",
  VIDEO: "video",
  STORYBOARD: "storyboard",
  BRIEF: "brief",
  isValid: function (key) {
    return Object.values(this).includes(key);
  },
});

module.exports.USER_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  isValid: function (key) {
    return Object.values(this).includes(key);
  },
});

module.exports.USAGE_GROUP = Object.freeze({
  USER: "user",
  PROJECT: "project",
  isValid: function (key) {
    return Object.values(this).includes(key);
  },
});
