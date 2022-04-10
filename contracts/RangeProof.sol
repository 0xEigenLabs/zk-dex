// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./range_proof_verifier.sol";

contract RangeProof is RangeProofVerifier {
    function verifyRangeProof(
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[2] memory input
    ) public view returns(bool) {
        return verifyProof(a, b, c, input);
    }
}