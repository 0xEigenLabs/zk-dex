// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./range_proof_verifier.sol";

contract RangeProof is PlonkVerifier {
    function verifyRangeProof(
                  bytes memory proof,
                  uint[] memory input) public view returns(bool) {
        return verifyProof(proof, input);
    }
}


