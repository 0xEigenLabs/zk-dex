#!/bin/bash
set -e

export NODE_OPTIONS=--max_old_space_size=40960
circuit_name=$1
base_dir=${circuit_name}_js

circom ${circuit_name}.circom --r1cs --wasm --sym

mv ${circuit_name}.r1cs ${circuit_name}.sym  ./$base_dir/
cd $base_dir
node ../../scripts/generate_${circuit_name}.js

#Prapare phase 1
node generate_witness.js ${circuit_name}.wasm input.json witness.wtns

#Start a new zkey and make a contribution (enter some random text)
snarkjs plonk setup ${circuit_name}.r1cs ~/Downloads/powersOfTau28_hez_final_24.ptau circuit_final.zkey

snarkjs zkey export verificationkey circuit_final.zkey verification_key.json
snarkjs plonk prove circuit_final.zkey witness.wtns proof.json public.json
snarkjs plonk verify verification_key.json public.json proof.json
snarkjs zkey export soliditycalldata public.json proof.json
cp public.json proof.json ../

cd ..
snarkjs zkey export solidityverifier ${base_dir}/circuit_final.zkey ../contracts/${circuit_name}_verifier.sol



# #!/bin/bash
# set -e

# circuit_name=$1
# base_dir=${circuit_name}_js

# circom ${circuit_name}.circom --r1cs --wasm --sym

# mv ${circuit_name}.r1cs ${circuit_name}.sym  ./$base_dir/
# cd $base_dir
# node ../../scripts/generate_${circuit_name}.js

# #Prapare phase 1
# node generate_witness.js ${circuit_name}.wasm input.json witness.wtns

# snarkjs powersoftau new bn128 23 pot23_0000.ptau -v
# #snarkjs powersoftau new bn128 12 pot12_0000.ptau -v

# snarkjs powersoftau contribute pot23_0000.ptau pot23_0001.ptau --name="First contribution" -v

# #Prapare phase 2
# snarkjs powersoftau prepare phase2 pot23_0001.ptau pot23_final.ptau -v

# #Start a new zkey and make a contribution (enter some random text)
# snarkjs zkey new ${circuit_name}.r1cs pot12_final.ptau circuit_0000.zkey
# snarkjs zkey contribute circuit_0000.zkey circuit_final.zkey --name="1st Contributor Name" -v

# snarkjs zkey export verificationkey circuit_final.zkey verification_key.json
# snarkjs plonk prove circuit_final.zkey witness.wtns proof.json public.json
# snarkjs plonk verify verification_key.json public.json proof.json

# cd ..
# snarkjs zkey export solidityverifier ${base_dir}/circuit_final.zkey ../contracts/${circuit_name}_verifier.sol
