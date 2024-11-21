const TAG = "UTL";
const LTAG = (...args) => console.log(`[${TAG}]`, ...args);

module.exports.jsonParser = data => {
  let result = data || {};
  if (typeof result === 'string') result = JSON.parse(result);
  if (!!result.body) result.body = JSON.parse(result.body);
  if (!!result.payload && typeof result.payload === 'string') result.payload = JSON.parse(result.payload);
  return result;
};