const path = require("path");
const { waffle, ethers } = require("hardhat");
const fs = require("fs");
const snarkjs = require("snarkjs");

const Scalar = require("ffjavascript").Scalar;
import {expect} from "chai";

const buildBabyjub = require("circomlibjs").buildBabyjub;

import { ContractFactory, BigNumberish } from "ethers";
interface Proof {
    a: [BigNumberish, BigNumberish];
    b: [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]];
    c: [BigNumberish, BigNumberish];
}

function parseProof(proof: any): Proof {
    return {
        a: [proof.pi_a[0], proof.pi_a[1]],
        b: [
            [proof.pi_b[0][1], proof.pi_b[0][0]],
            [proof.pi_b[1][1], proof.pi_b[1][0]],
        ],
        c: [proof.pi_c[0], proof.pi_c[1]],
    };
}

describe("Pedersen Commitment Test", function() {
    let circuit;
    let zkey
    let contract
    before( async() => {
        let wasm = path.join(__dirname, "../circuit/pedersen_comm_babyjubjub_js", "pedersen_comm_babyjubjub.wasm");
        zkey = path.join(__dirname, "../circuit/pedersen_comm_babyjubjub_js", "circuit_final.zkey");
        const wc = require("../circuit/pedersen_comm_babyjubjub_js/witness_calculator");
        const buffer = fs.readFileSync(wasm);
        circuit = await wc(buffer);

        let factory = await ethers.getContractFactory("PedersenCommBabyJubjubVerifier");
        contract = await factory.deploy();
        await contract.deployed();
    });

    // refer: https://github.com/iden3/circomlib/blob/master/test/pedersen.js
    it("Should verify pedersen commitment correctly", async () => {
        const input = {
            "H": [
              "6230554789957970145215337505398881261822212318664924668379426670874097221003",
              "5398230348265168451715249421208726036420771114427148549530635721570527592474"
            ],
            "r": "15234991401612976859424945774878329190532666920322606448273387428648700648199",
            "v": "805",
            "comm": [
              "5434698982234190249305374094631383876778256933564855719986344407296692881880",
              "15114311991195134539210677959285812356643640052349155301332867067573555804389"
            ]
        }
        const witnessBuffer = await circuit.calculateWTNSBin(
            input,
            0
        );
        const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, witnessBuffer);
        console.log(proof)

        const {a, b, c} = parseProof(proof);
        let ok = await contract.verifyProof(
            a, b, c,
            publicSignals
        )
        console.log(publicSignals)
        console.log(publicSignals[3])
        console.log(publicSignals[4])
        expect(ok).to.eq(true)
    });
});
