// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./pedersen_bjj_verifier.sol";

contract PedersenComm is PlonkVerifier {
    function verifyPedersenComm(bytes memory proof,
                  uint[] memory input) public view returns(bool) {
        return verifyProof(proof, input);
    }
}
