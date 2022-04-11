pragma circom 2.0.0;
include "../circom-ecdsa/circuits/secp256k1.circom";

template PedersenComm (n, k) {
    signal input r[k];
    signal input v[k];
    signal input H[2][k];
    signal input G[2][k];
    signal input comm[2][k];

    component multGr = Secp256k1ScalarMult(n, k);
    for (var idx = 0; idx < k; idx++) {
        multGr.scalar[idx] <== r[idx];
        multGr.point[0][idx] <== G[0][idx];
        multGr.point[1][idx] <== G[1][idx];
    }

    component multHv = Secp256k1ScalarMult(n, k);
    for (var idx = 0; idx < k; idx++) {
        multHv.scalar[idx] <== v[idx];
        multHv.point[0][idx] <== H[0][idx];
        multHv.point[1][idx] <== H[1][idx];
    }

    component adder = Secp256k1AddUnequal(n, k);
    for (var idx = 0; idx < k; idx++) {
        adder.a[0][idx] <== multGr.out[0][idx];
        adder.a[1][idx] <== multGr.out[1][idx];
        adder.b[0][idx] <== multHv.out[0][idx];
        adder.b[1][idx] <== multHv.out[1][idx];
    }

    for (var idx = 0; idx < k; idx++) {
        log(idx);
        log(comm[0][idx]);
        log(adder.out[0][idx]);
        log(comm[1][idx]);
        log(adder.out[1][idx]);
    }

    for (var idx = 0; idx < k; idx++) {
        comm[0][idx] === adder.out[0][idx];
        comm[1][idx] === adder.out[1][idx];
    }
}

component main { public[v, H, G, comm] } = PedersenComm(64, 4);
// component main { public[Hv, Gr, comm] } = PedersenComm(64, 4);

// template PedersenComm (n, k) {
//     signal input r[k];
//     // signal input v[k];
//     // signal input H[2][k];
//     signal input G[2][k];
//     signal input gr[2][k];

//     component multGr = Secp256k1ScalarMult(n, k);
//     for (var idx = 0; idx < k; idx++) {
//         multGr.scalar[idx] <== r[idx];
//         multGr.point[0][idx] <== G[0][idx];
//         multGr.point[1][idx] <== G[1][idx];
//     }

//     // component multHv = Secp256k1ScalarMult(n, k);
//     // for (var idx = 0; idx < k; idx++) {
//     //     multHv.scalar[idx] <== v[idx];
//     //     multHv.point[0][idx] <== H[0][idx];
//     //     multHv.point[1][idx] <== H[1][idx];
//     // }

//     // component doubler = Secp256k1Double(n, k);
//     // for (var idx = 0; idx < k; idx++) {
//     //     doubler.in[0][idx] <== v[0][idx];
//     //     doubler.in[1][idx] <== v[1][idx];
//     // }

//     for (var idx = 0; idx < k; idx++) {
//         log(idx);
//         log(gr[0][idx]);
//         log(multGr.out[0][idx]);
//         log(gr[1][idx]);
//         log(multGr.out[1][idx]);
//     }

//     for (var idx = 0; idx < k; idx++) {
//         gr[0][idx] === multGr.out[0][idx];
//         gr[1][idx] === multGr.out[1][idx];
//     }
// }

// // component main { public[v, H, G, comm] } = PedersenComm(64, 4);
// component main { public[r, G, gr] } = PedersenComm(64, 4);
