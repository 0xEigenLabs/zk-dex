const fs = require("fs");

const inputs = {
  'in': ["1", "0"]
}
fs.writeFileSync(
  "./input.json",
  JSON.stringify(inputs),
  "utf-8"
);
