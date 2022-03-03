const fs = require('fs');
const {randomBytes} = require("crypto");
const BigNumber = require("bignumber.js");

const cls = require("circomlibjs");

const F1Field = require("ffjavascript").F1Field;
const Scalar = require("ffjavascript").Scalar;

async function main() {

  const inputs = {
    "a": 1,
    "b": 10000,
    "m": 20
  }

  console.info(inputs)

  fs.writeFileSync(
    "./input.json",
    JSON.stringify(inputs),
    "utf-8"
  );
}

main().then(() => {
  console.log("Done")
})
