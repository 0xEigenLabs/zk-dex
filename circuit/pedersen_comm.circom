pragma circom 2.0.0;
include "../circomlib/circuits/comparators.circom";

// check if a <= m < b;
template PedersenComm (n) {
    signal input r; // private
    signal input v; // public

    component lessor = LessThan(n);
    lessor.in[0] <== m;
    lessor.in[1] <== b;

    lessor.out === 1;

    component greater = GreaterEqThan(n);
    greater.in[0] <== m;
    greater.in[1] <== a;

    1 === greater.out;s
}

component main { public[a, b] } = RangeProof(252);
