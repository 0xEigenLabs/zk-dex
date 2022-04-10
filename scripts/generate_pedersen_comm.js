const fs = require('fs');
//const pc = require("@ieigen/anonmisc/lib/pedersen");
const crypto = require('crypto');
const secp256k1 = require('@noble/secp256k1')
const CURVE = secp256k1.CURVE
const Point = secp256k1.Point
var BN = require('bn.js');


var G = new Point(CURVE.Gx, CURVE.Gy)

function generateRandom() {
    let random;
    do {
        random = BigInt("0x" + crypto.randomBytes(32).toString('hex'));
    } while (random >= CURVE.n); // make sure it's in the safe range
    return random;
}

function generateH() {
    return G.multiply(generateRandom());
}

var H = generateH()

// commit to a Value X
//   r - private Key used as blinding factor
//   H - shared private? point on the curve
function commitTo(H, r, x) {
    // console.log("gr:", ec.g.mul(r))
    // console.dir(ec.g.mul(r))
    // console.log("hv:", H.mul(x))
    // console.dir(H.mul(x))
    return G.multiply(r).add(H.multiply(x));
}

BigInt.prototype.toJSON = function() {       
  return this.toString()
}

function bigint_to_array(n, k, x) {
    let mod = 1n;
    for (var idx = 0; idx < n; idx++) {
        mod = mod * 2n;
    }

    let ret = [];
    var x_temp = x;
    for (var idx = 0; idx < k; idx++) {
        ret.push(x_temp % mod);
        x_temp = x_temp / mod;
    }
    return ret;
}

async function main() {
    let r = BigInt(generateRandom())
    let v = BigInt("900719925474099211111123001930401839340208102030230")
    var r_array = bigint_to_array(64, 4, r)
    var v_array = bigint_to_array(64, 4, v)

    var hx_array = bigint_to_array(64, 4, H.x)
    var hy_array = bigint_to_array(64, 4, H.y)
    var h = [hx_array, hy_array]

    var gx_array = bigint_to_array(64, 4, G.x)
    var gy_array = bigint_to_array(64, 4, G.y)
    var g = [gx_array, gy_array]

    let res = commitTo(H, r, v)
    var comm_x_array = bigint_to_array(64, 4, res.x)
    var comm_y_array = bigint_to_array(64, 4, res.y)
    var comm = [comm_x_array, comm_y_array]

    // let gr = G.mul(r)
    // var gr_x_array = bigint_to_array(64, 4, BigInt(gr.getX().toString()))
    // var gr_y_array = bigint_to_array(64, 4, BigInt(gr.getY().toString()))
    // console.log("gr x array:", gr_x_array)
    // console.log("gr y array:", gr_y_array)
    // let gr_array = [gr_x_array, gr_y_array]

    // let hv = H.mul(v)
    // var hv_x_array = bigint_to_array(64, 4, BigInt(hv.getX().toString()))
    // var hv_y_array = bigint_to_array(64, 4, BigInt(hv.getY().toString()))
    // console.log("hv x array:", hv_x_array)
    // console.log("hv y array:", hv_y_array)

    const inputs = {
        "r": r_array,
        "v": v_array,
        "H": h,
        "G": g,
        "comm": comm
    };

    console.info(inputs)

    fs.writeFileSync(
        "./input.json",
        JSON.stringify(inputs),
        "utf-8"
    );
}

// async function main() {
//     let r = BigInt(generateRandom())
//     let v = BigInt("90071992547409921111112300193040183934020810203023023883983902992287828919912928878")

//     let res = commitTo(H, r, v)
//     x = BigInt(res.getX().toString())
//     y = BigInt(res.getY().toString())
//     var comm_x_array = bigint_to_array(64, 4, x)
//     var comm_y_array = bigint_to_array(64, 4, y)
//     var comm = [comm_x_array, comm_y_array]

//     let gr = G.mul(r)
//     var gr_x_array = bigint_to_array(64, 4, BigInt(gr.getX().toString()))
//     var gr_y_array = bigint_to_array(64, 4, BigInt(gr.getY().toString()))
//     console.log("gr x array:", gr_x_array)
//     console.log("gr y array:", gr_y_array)
//     gr = [gr_x_array, gr_y_array]

//     let hv = H.mul(v)
//     var hv_x_array = bigint_to_array(64, 4, BigInt(hv.getX().toString()))
//     var hv_y_array = bigint_to_array(64, 4, BigInt(hv.getY().toString()))
//     console.log("hv x array:", hv_x_array)
//     console.log("hv y array:", hv_y_array)
//     hv = [hv_x_array, hv_y_array]

//     const inputs = {
//         "Hv": hv,
//         "Gr": gr,
//         "comm": comm
//     }

//     console.info(inputs)

//     fs.writeFileSync(
//         "./input.json",
//         JSON.stringify(inputs),
//         "utf-8"
//     );
// }

// async function main() {
//     let r = BigInt(generateRandom())
//     let value = BigInt("90071992547409921111112300193040183934020810203023023883983902992287828919912928878")

//     let val = H.mul(value)
//     var gr_x_array = bigint_to_array(64, 4, BigInt(val.getX().toString()))
//     var gr_y_array = bigint_to_array(64, 4, BigInt(val.getY().toString()))
//     console.log("v x array:", gr_x_array)
//     console.log("v y array:", gr_y_array)
//     v = [gr_x_array, gr_y_array]

//     let v2 = val.mul(2)
//     var hv_x_array = bigint_to_array(64, 4, BigInt(v2.getX().toString()))
//     var hv_y_array = bigint_to_array(64, 4, BigInt(v2.getY().toString()))
//     console.log("v2 x array:", hv_x_array)
//     console.log("v2 y array:", hv_y_array)
//     v2 = [hv_x_array, hv_y_array]

//     const inputs = {
//         "v": v,
//         "v2": v2
// }

//     console.info(inputs)

//     fs.writeFileSync(
//         "./input.json",
//         JSON.stringify(inputs),
//         "utf-8"
//     );
// }

main().then(() => {
    console.log("Done")
})
