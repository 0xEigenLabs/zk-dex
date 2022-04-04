const path = require("path");
const { waffle, ethers } = require("hardhat");
const fs = require("fs");
const snarkjs = require("snarkjs");

const Scalar = require("ffjavascript").Scalar;
import {expect} from "chai";

const buildBabyjub = require("circomlibjs").buildBabyjub;


describe("Double Pedersen test", function() {
    let babyJub;
    let circuit;
    let zkey
    let contract
    before( async() => {
        babyJub = await buildBabyjub();
        let wasm = path.join(__dirname, "../circuit/pedersen_bjj_js", "pedersen_bjj.wasm");
        zkey = path.join(__dirname, "../circuit/pedersen_bjj_js", "circuit_final.zkey");
        let vkeypath = path.join(__dirname, "../circuit/pedersen_bjj_js", "verification_key.json");
        const wc = require("../circuit/pedersen_bjj_js/witness_calculator");
        const buffer = fs.readFileSync(wasm);
        circuit = await wc(buffer);

        let F = await ethers.getContractFactory("PedersenComm");
        contract = await F.deploy();
        await contract.deployed();
    });

    // refer: https://github.com/iden3/circomlib/blob/master/test/pedersen.js
    it("Should pedersen at zero", async () => {

        const input = {
            "in": ["1", "0"]
        }
        const witnessBuffer = await circuit.calculateWTNSBin(
            input,
            0
        );
        const { proof, publicSignals } = await snarkjs.plonk.prove(zkey, witnessBuffer);
        console.log(publicSignals)
        const res = await snarkjs.plonk.exportSolidityCallData(proof, "");
        let result = res.substring(0, res.length - 3);
        console.log(res)

        let ok = await contract.verifyPedersenComm(
            result,
            publicSignals
        )
        console.log(ok)
        expect(ok).to.eq(true)
    });
});
